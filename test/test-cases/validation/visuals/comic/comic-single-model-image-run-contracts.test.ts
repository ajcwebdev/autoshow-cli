import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { generateImagesCommand, runFinalPanelImageStage } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-images-command'
import { generateSceneSketches } from '~/cli/commands/visuals/comic/comic-commands/generate-sketches/generate-scene-sketches'
import { inspectComicPanelImage, readImageRunRecord, readPanelSelections } from '~/cli/commands/visuals/comic/comic-utils/panel-selection'
import { writeInitialComicStructureManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-manifest'
import { createComicSourceIdentity, createStructuredScriptArtifactRef } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { canonicalTtsJson } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { AppProviderError } from '~/utils/error-handler'
import type { ComicImageRequestInput, FinalPanelImageStageOptions, GeneratedImageResponse, ImageGenerationModel, ImageRunStats, PanelBundleData, SourceCoverageReport } from '~/types'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { createLiveLocationFixture } from '../../../../test-utils/live-location-reference-fixture'
import { seededPng } from '../../../../test-utils/seeded-png-fixture'
import { buildComicAudioPhase2Structured, COMIC_AUDIO_PHASE_2_CREATED_AT } from './comic-audio-phase-fixture'

const OPENAI_MODEL: ImageGenerationModel = 'gpt-image-2.6-flare'
const GEMINI_MODEL: ImageGenerationModel = 'gemini-nano-banana-2.1'
const RETIRED_PRESET_NAMES = ['canonical', 'animation-polish', 'cinematic-depth']
const RETIRED_PREFIX_TEXT = ['Render as clean production animation stills', 'Add cinematic depth with layered foreground']
const QA_ARTIFACT_PATTERN = /qa|judge|repair|continuity|blooper|revision|comparison/i
const PANEL_COUNT = 4
const temporaryDirectories: string[] = []
const cargoBayLocation = { key: 'cargo-bay', raw: 'cargo-bay' }

type Scene = { sceneSlug: string, runDirectory: string, characterReference: string, locationReference: string }
type RecordedRequest = ComicImageRequestInput & { bytes: Buffer }

const panelBundle = (panelNumber: number): PanelBundleData => ({
  schemaVersion: 4, snapshotId: 'character-snapshot',
  title: 'Single Model Run', location: 'Cargo Bay', panels: [{
    number: panelNumber, description: `Authored staging ${panelNumber}.`,
    shotPlan: `Medium eye-level shot ${panelNumber}; hero is screen left, facing right; exclude all unlisted cast.`,
    characterKeys: ['hero'], speech: [], sourceSegmentIds: [`beat-${panelNumber}`],
    sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Authored staging ${panelNumber}.`, sourceSpans: [], beatIndex: panelNumber, location: cargoBayLocation }],
    locationKey: 'cargo-bay', locationSnapshotId: 'location-snapshot',
  }],
})

const createScene = async (): Promise<Scene> => {
  const sceneSlug = `single-model-${crypto.randomUUID()}`
  const projectDirectory = await makeTempDir('autoshow-comic-single-model-')
  temporaryDirectories.push(projectDirectory)
  const runDirectory = join(projectDirectory, 'scene')
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  const { charactersRoot } = await createLiveCharacterFixture(projectDirectory)
  const [locationReference] = await createLiveLocationFixture(projectDirectory, [{ key: 'cargo-bay', name: 'Cargo Bay', specification: 'A loading door stays left of a fixed control booth; camera angles and crops may vary.', sourceScripts: ['scripts/02-script/01.md'] }], seededPng(1))
  for (let panelNumber = 1; panelNumber <= PANEL_COUNT; panelNumber++) {
    const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-${String(panelNumber).padStart(2, '0')}`)
    await mkdir(directory, { recursive: true })
    await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panelNumber), null, 2)}\n\`\`\`\n`)
  }
  return { sceneSlug, runDirectory, characterReference: join(charactersRoot, 'hero.png'), locationReference: locationReference! }
}

/** Fake provider: every request returns a distinct real PNG; failures can be injected by 1-based request index. */
const createFakeProvider = (options: { failOn?: (index: number) => Error | undefined } = {}) => {
  const requests: RecordedRequest[] = []
  let seed = 1000 + Math.floor(Math.random() * 1000) * 10
  const requestImage = async (input: ComicImageRequestInput): Promise<GeneratedImageResponse> => {
    const failure = options.failOn?.(requests.length + 1)
    const bytes = seededPng(seed++)
    requests.push({ ...input, bytes })
    if (failure) throw failure
    return { mode: 'edit', result: { imageBase64: bytes.toString('base64') }, usage: { imageInputUnits: 645, textInputUnits: 30, outputUnits: 6240 } }
  }
  const writeImage = async (outputPath: string, imageBase64: string): Promise<void> => {
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, Buffer.from(imageBase64, 'base64'))
  }
  return { requests, requestImage, writeImage }
}

const promptPanels = (request: ComicImageRequestInput): number[] =>
  [...request.normalizedPrompt.matchAll(/Authored staging (\d+)\./g)].map(match => Number(match[1])).filter((value, index, all) => all.indexOf(value) === index)

const stageOptions = (overrides: Partial<FinalPanelImageStageOptions> & { runId: string }): FinalPanelImageStageOptions => ({
  scriptPath: 'script.md', sceneSlug: '', imageModel: OPENAI_MODEL, size: '1536x1024', quality: 'high', concurrency: 1, ...overrides,
})

/** Runs the real generate-images final stage dispatch (individual panels, grouped pages, or individual panels plus a local grid) with injected fakes. */
const runFinalStage = async (
  scene: Scene,
  options: FinalPanelImageStageOptions,
  provider: ReturnType<typeof createFakeProvider>,
  composed: Array<{ sources: string[], outputPath: string }> = [],
): Promise<ImageRunStats> => await runFinalPanelImageStage({ ...options, sceneSlug: scene.sceneSlug }, {
  requestImage: provider.requestImage,
  writeImage: provider.writeImage,
  checkPanelPromptSourceCoverage: async () => coverageReport,
  composeGridPage: async input => {
    composed.push({ sources: [...input.sources], outputPath: input.outputPath })
    await mkdir(dirname(input.outputPath), { recursive: true })
    await Bun.write(input.outputPath, seededPng(9_000 + composed.length, 4, 4))
    return { width: 4, height: 4 }
  },
})

/** The real stage wraps generator failures in an infrastructure error whose cause carries the generator message. */
const stageFailure = (causeText: string) => ({ message: 'Failed at image generation step', cause: expect.objectContaining({ message: expect.stringContaining(causeText) }) })

const fileBytes = async (path: string): Promise<Uint8Array> => new Uint8Array(await Bun.file(path).arrayBuffer())
const panelPath = (scene: Scene, panelNumber: number, runId?: string): string =>
  join(scene.runDirectory, 'panels', ...(runId ? [runId] : []), `panel-${String(panelNumber).padStart(2, '0')}.png`)

const listTree = async (root: string): Promise<{ directories: string[], files: string[] }> => {
  const directories: string[] = []
  const files: string[] = []
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) { directories.push(relative(root, path)); await visit(path) } else files.push(relative(root, path))
    }
  }
  await visit(root)
  return { directories: directories.sort(), files: files.sort() }
}

/** New runs never create model or preset subdirectories, and never write QA, judge or repair artifacts. */
const expectSingleModelLayout = async (scene: Scene, runIds: string[]): Promise<void> => {
  const tree = await listTree(scene.runDirectory)
  const forbiddenSegments = new Set([OPENAI_MODEL, GEMINI_MODEL, ...RETIRED_PRESET_NAMES])
  for (const directory of tree.directories) {
    expect(directory.split('/').some(segment => forbiddenSegments.has(segment))).toBe(false)
  }
  for (const output of ['panels', 'pages', 'sketches']) {
    for (const directory of tree.directories.filter(path => path.startsWith(`${output}/`))) {
      expect(runIds).toContain(directory.slice(output.length + 1).split('/')[0] ?? '')
      expect(directory.split('/')).toHaveLength(2)
    }
  }
  expect(tree.files.filter(path => QA_ARTIFACT_PATTERN.test(path))).toEqual([])
}

const coverageReport: SourceCoverageReport = { complete: true, totalSegments: PANEL_COUNT, coveredSegments: PANEL_COUNT, missingSegments: [], missingItems: [], promptFiles: [] }

afterEach(async () => {
  resetSceneRunContext()
  resetPinnedRunDir()
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('comic single-model image runs', () => {
  test('individual panels: four missing panels make exactly four base requests whose decoded candidates are all auto-selected', async () => {
    const scene = await createScene()
    const provider = createFakeProvider()
    const { events } = await captureLogEvents(async () => {
      const stats = await runFinalStage(scene, stageOptions({ runId: 'run-a' }), provider)
      expect(stats).toMatchObject({ imagesGenerated: 4, imagesSkipped: 0, totalInputImageTokens: 4 * 645, totalInputTextTokens: 4 * 30, totalOutputImageTokens: 4 * 6240, totalInputTokens: 0, totalOutputTokens: 0 })
      expect(stats.totalCost).toBeGreaterThan(0)
    })

    expect(provider.requests).toHaveLength(4)
    expect(provider.requests.map(request => promptPanels(request)).sort()).toEqual([[1], [2], [3], [4]])
    const selections = await readPanelSelections(scene.sceneSlug)
    for (const request of provider.requests) {
      const [panelNumber] = promptPanels(request) as [number]
      expect(request.model).toBe(OPENAI_MODEL)
      // Generation references: canonical character reference first, then the location reference.
      expect(request.referenceImages).toEqual([scene.characterReference, scene.locationReference])
      for (const prefix of RETIRED_PREFIX_TEXT) expect(request.normalizedPrompt).not.toContain(prefix)
      // Panel-to-file mapping: the bytes returned for panel N land at panels/run-a/panel-NN.png and are copied to panels/panel-NN.png.
      const candidateBytes = await fileBytes(panelPath(scene, panelNumber, 'run-a'))
      expect(candidateBytes).toEqual(new Uint8Array(request.bytes))
      expect(await fileBytes(panelPath(scene, panelNumber))).toEqual(candidateBytes)
      const evidence = inspectComicPanelImage(candidateBytes, `panel ${panelNumber}`)
      expect(evidence).toMatchObject({ width: 2, height: 2 })
      expect(selections.get(panelNumber)).toMatchObject({ panelNumber, runId: 'run-a', model: OPENAI_MODEL, service: 'openai', origin: 'first-generation', sha256: evidence.sha256, candidatePath: `panels/run-a/panel-0${panelNumber}.png` })
    }
    const record = await readImageRunRecord(scene.sceneSlug, 'run-a')
    expect(record).toMatchObject({ runId: 'run-a', model: OPENAI_MODEL, service: 'openai' })
    expect(record.panels.map(panel => panel.panelNumber)).toEqual([1, 2, 3, 4])
    expect(record.pages ?? []).toEqual([])
    for (let panelNumber = 1; panelNumber <= PANEL_COUNT; panelNumber++) {
      expect(events.some(event => event.message.startsWith(`Panel ${panelNumber} selected`) && event.message.includes('run=run-a'))).toBe(true)
    }
    await expectSingleModelLayout(scene, ['run-a'])
  })

  test('two panels per image: four panels make two provider-page requests under pages/<run-id>/ and publish no panel slot', async () => {
    const scene = await createScene()
    const provider = createFakeProvider()
    const stats = await runFinalStage(scene, stageOptions({ runId: 'run-pages', panelsPerImage: 2 }), provider)

    expect(stats.imagesGenerated).toBe(2)
    expect(provider.requests).toHaveLength(2)
    expect(provider.requests.map(request => promptPanels(request)).sort()).toEqual([[1, 2], [3, 4]])
    expect(provider.requests.every(request => request.model === OPENAI_MODEL)).toBe(true)
    const pageFiles = (await readdir(join(scene.runDirectory, 'pages', 'run-pages'))).sort()
    expect(pageFiles).toEqual(['page-01-panels-01-02.png', 'page-02-panels-03-04.png'])
    for (const request of provider.requests) {
      const panels = promptPanels(request)
      const page = panels[0] === 1 ? 'page-01-panels-01-02.png' : 'page-02-panels-03-04.png'
      expect(await fileBytes(join(scene.runDirectory, 'pages', 'run-pages', page))).toEqual(new Uint8Array(request.bytes))
    }
    expect(await readdir(join(scene.runDirectory, 'panels')).catch(() => [])).toEqual([])
    expect((await readPanelSelections(scene.sceneSlug)).size).toBe(0)
    const record = await readImageRunRecord(scene.sceneSlug, 'run-pages')
    expect(record.panels).toEqual([])
    expect(record.pages?.map(page => ({ pageNumber: page.pageNumber, panelNumbers: page.panelNumbers, kind: page.kind }))).toEqual([
      { pageNumber: 1, panelNumbers: [1, 2], kind: 'provider-page' },
      { pageNumber: 2, panelNumbers: [3, 4], kind: 'provider-page' },
    ])
    await expectSingleModelLayout(scene, ['run-pages'])
  })

  test('individual panels plus a 2x2 grid: four base requests and one local composite with zero extra provider calls; grid inputs stay selected', async () => {
    const scene = await createScene()
    const provider = createFakeProvider()
    const composed: Array<{ sources: string[], outputPath: string }> = []
    await runFinalStage(scene, stageOptions({ runId: 'run-grid', grid: { columns: 2, rows: 2 } }), provider, composed)

    expect(provider.requests).toHaveLength(4)
    expect(composed).toHaveLength(1)
    expect(composed[0]?.sources).toEqual([1, 2, 3, 4].map(panelNumber => panelPath(scene, panelNumber, 'run-grid')))
    expect(composed[0]?.outputPath).toBe(join(scene.runDirectory, 'pages', 'run-grid', 'page-01-panels-01-04.png'))
    const selections = await readPanelSelections(scene.sceneSlug)
    expect([...selections.keys()].sort()).toEqual([1, 2, 3, 4])
    expect([...selections.values()].every(selection => selection.runId === 'run-grid' && selection.origin === 'first-generation')).toBe(true)
    const record = await readImageRunRecord(scene.sceneSlug, 'run-grid')
    expect(record.panels.map(panel => panel.panelNumber)).toEqual([1, 2, 3, 4])
    expect(record.pages?.map(page => ({ panelNumbers: page.panelNumbers, kind: page.kind }))).toEqual([{ panelNumbers: [1, 2, 3, 4], kind: 'local-grid' }])
    await expectSingleModelLayout(scene, ['run-grid'])
  })

  test('two already-selected panels are skipped: only the two missing panels are requested and the later run records no candidate for them', async () => {
    const scene = await createScene()
    const first = createFakeProvider()
    await runFinalStage(scene, stageOptions({ runId: 'run-a', panels: [1, 2] }), first)
    expect(first.requests).toHaveLength(2)
    const before = await readPanelSelections(scene.sceneSlug)

    const second = createFakeProvider()
    const composed: Array<{ sources: string[], outputPath: string }> = []
    const stats = await runFinalStage(scene, stageOptions({ runId: 'run-b', grid: { columns: 2, rows: 2 } }), second, composed)

    expect(second.requests).toHaveLength(2)
    expect(second.requests.map(request => promptPanels(request)).sort()).toEqual([[3], [4]])
    // The real stage merges the local grid composite into the run totals: two new panels plus one composite page.
    expect(stats).toMatchObject({ imagesGenerated: 3, imagesSkipped: 2 })
    expect(await Bun.file(panelPath(scene, 1, 'run-b')).exists()).toBe(false)
    expect(await Bun.file(panelPath(scene, 2, 'run-b')).exists()).toBe(false)
    expect((await readImageRunRecord(scene.sceneSlug, 'run-b')).panels.map(panel => panel.panelNumber)).toEqual([3, 4])
    const after = await readPanelSelections(scene.sceneSlug)
    expect(after.get(1)).toEqual(before.get(1)!)
    expect(after.get(2)).toEqual(before.get(2)!)
    expect(after.get(3)).toMatchObject({ runId: 'run-b', origin: 'first-generation' })
    // The local grid composes skipped panels from their current selection and new panels from this run.
    expect(composed[0]?.sources).toEqual([panelPath(scene, 1), panelPath(scene, 2), panelPath(scene, 3, 'run-b'), panelPath(scene, 4, 'run-b')])
  })

  test('--force with an existing selection saves a new candidate and preserves the current selection', async () => {
    const scene = await createScene()
    await runFinalStage(scene, stageOptions({ runId: 'run-a', panels: [1] }), createFakeProvider())
    const selectedBefore = await fileBytes(panelPath(scene, 1))
    const recordBefore = (await readPanelSelections(scene.sceneSlug)).get(1)

    const provider = createFakeProvider()
    const { events } = await captureLogEvents(async () => {
      await runFinalStage(scene, stageOptions({ runId: 'run-b', panels: [1], force: true }), provider)
    })

    expect(provider.requests).toHaveLength(1)
    expect(await fileBytes(panelPath(scene, 1, 'run-b'))).toEqual(new Uint8Array(provider.requests[0]!.bytes))
    expect(await fileBytes(panelPath(scene, 1))).toEqual(selectedBefore)
    expect((await readPanelSelections(scene.sceneSlug)).get(1)).toEqual(recordBefore!)
    expect(events.some(event => event.message.startsWith('New version of panel 1 saved. Current selection preserved.') && event.message.includes('outcome=preserved'))).toBe(true)
    expect((await readImageRunRecord(scene.sceneSlug, 'run-b')).panels.map(panel => panel.panelNumber)).toEqual([1])
  })

  test('forced regeneration inside the same run moves the prior paid candidate aside instead of discarding it', async () => {
    const scene = await createScene()
    const first = createFakeProvider()
    await runFinalStage(scene, stageOptions({ runId: 'run-a', panels: [1] }), first)
    const priorBytes = await fileBytes(panelPath(scene, 1, 'run-a'))

    const second = createFakeProvider()
    await runFinalStage(scene, stageOptions({ runId: 'run-a', panels: [1], force: true }), second)

    expect(await fileBytes(panelPath(scene, 1, 'run-a'))).toEqual(new Uint8Array(second.requests[0]!.bytes))
    const superseded = await readdir(join(scene.runDirectory, 'panels', 'run-a', 'superseded'))
    expect(superseded).toHaveLength(1)
    expect(await fileBytes(join(scene.runDirectory, 'panels', 'run-a', 'superseded', superseded[0]!))).toEqual(priorBytes)
    // The first publication stays selected; the forced candidate is only an alternative.
    expect(await fileBytes(panelPath(scene, 1))).toEqual(priorBytes)
  })

  test('a failed forced replacement keeps the prior candidate and selection byte-for-byte', async () => {
    const scene = await createScene()
    await runFinalStage(scene, stageOptions({ runId: 'run-a', panels: [1, 2] }), createFakeProvider())
    const priorCandidate = await fileBytes(panelPath(scene, 1, 'run-a'))
    const priorSelection = await fileBytes(panelPath(scene, 1))
    const priorRecord = (await readPanelSelections(scene.sceneSlug)).get(1)

    const failingRequest = createFakeProvider({ failOn: () => new AppProviderError('provider unavailable', { status: 503, stage: 'openai' }) })
    await expect(runFinalStage(scene, stageOptions({ runId: 'run-a', panels: [1], force: true }), failingRequest)).rejects.toMatchObject(stageFailure('image generation task(s) failed'))
    expect(failingRequest.requests).toHaveLength(1)

    const failingWrite = createFakeProvider()
    await expect(runFinalStage(scene, stageOptions({ runId: 'run-a', panels: [1], force: true }), { ...failingWrite, writeImage: async () => { throw new Error('disk full') } })).rejects.toMatchObject(stageFailure('image generation task(s) failed'))
    expect(failingWrite.requests).toHaveLength(1)

    expect(await fileBytes(panelPath(scene, 1, 'run-a'))).toEqual(priorCandidate)
    expect(await fileBytes(panelPath(scene, 1))).toEqual(priorSelection)
    expect((await readPanelSelections(scene.sceneSlug)).get(1)).toEqual(priorRecord!)
    const runEntries = await readdir(join(scene.runDirectory, 'panels', 'run-a'))
    expect(runEntries.filter(name => name.includes('.pending'))).toEqual([])
    expect(runEntries).not.toContain('superseded')
  })

  test('interrupted first run: two completed panels are reused and selected once on resume; only the missing panels are requested', async () => {
    const scene = await createScene()
    const interrupted = createFakeProvider({ failOn: index => index === 3 ? new AppProviderError('quota exhausted', { status: 429, stage: 'openai' }) : undefined })
    await expect(runFinalStage(scene, stageOptions({ runId: 'run-a', stopOnProviderError: true }), interrupted)).rejects.toMatchObject(stageFailure('stopped=panel-03'))
    expect(interrupted.requests).toHaveLength(3)
    expect(interrupted.requests.map(request => promptPanels(request))).toEqual([[1], [2], [3]])
    const afterInterrupt = await readPanelSelections(scene.sceneSlug)
    expect([...afterInterrupt.keys()].sort()).toEqual([1, 2])
    expect(await Bun.file(panelPath(scene, 3, 'run-a')).exists()).toBe(false)
    const paidBytes = [await fileBytes(panelPath(scene, 1, 'run-a')), await fileBytes(panelPath(scene, 2, 'run-a'))]

    const resumed = createFakeProvider()
    const stats = await runFinalStage(scene, stageOptions({ runId: 'run-a', stopOnProviderError: true }), resumed)

    expect(resumed.requests.map(request => promptPanels(request))).toEqual([[3], [4]])
    expect(stats).toMatchObject({ imagesGenerated: 2, imagesSkipped: 2 })
    expect(await fileBytes(panelPath(scene, 1, 'run-a'))).toEqual(paidBytes[0]!)
    expect(await fileBytes(panelPath(scene, 2, 'run-a'))).toEqual(paidBytes[1]!)
    const afterResume = await readPanelSelections(scene.sceneSlug)
    expect(afterResume.get(1)).toEqual(afterInterrupt.get(1)!)
    expect(afterResume.get(2)).toEqual(afterInterrupt.get(2)!)
    expect([...afterResume.values()].every(selection => selection.runId === 'run-a' && selection.origin === 'first-generation')).toBe(true)
    const store = JSON.parse(await Bun.file(join(scene.runDirectory, 'metadata', 'panel-selections.json')).text()) as { runs: Array<{ runId: string, panels: Array<{ panelNumber: number }> }>, selections: unknown[], history: unknown[] }
    expect(store.history).toEqual([])
    expect(store.selections).toHaveLength(4)
    expect(store.runs.map(run => run.runId)).toEqual(['run-a'])
    expect(store.runs[0]?.panels.map(panel => panel.panelNumber)).toEqual([1, 2, 3, 4])
  })

  test('sketches use the one run model at sketches/<run-id>/panels-SS-EE.png and never fill panel slots', async () => {
    const scene = await createScene()
    const provider = createFakeProvider()
    const stats = await generateSceneSketches(scene.sceneSlug, { model: OPENAI_MODEL, size: '1536x1024', quality: 'high', force: false, runId: 'run-sketch', concurrency: 1, panelsPerImage: 2 }, { requestImage: provider.requestImage, writeImage: provider.writeImage })

    expect(stats.imagesGenerated).toBe(2)
    expect(provider.requests).toHaveLength(2)
    expect(provider.requests.every(request => request.model === OPENAI_MODEL)).toBe(true)
    expect((await readdir(join(scene.runDirectory, 'sketches', 'run-sketch'))).sort()).toEqual(['panels-01-02.png', 'panels-03-04.png'])
    expect(await fileBytes(join(scene.runDirectory, 'sketches', 'run-sketch', 'panels-01-02.png'))).toEqual(new Uint8Array(provider.requests[0]!.bytes))
    // Later chunks receive this run's earlier sketch as a continuity reference after the canonical references.
    expect(provider.requests[1]?.referenceImages).toContain(join(scene.runDirectory, 'sketches', 'run-sketch', 'panels-01-02.png'))
    expect(await Bun.file(join(scene.runDirectory, 'panels')).exists()).toBe(false)
    expect((await readPanelSelections(scene.sceneSlug)).size).toBe(0)
    await expectSingleModelLayout(scene, ['run-sketch'])
  })

  test('a failure before the first candidate reports the error without advertising an empty run', async () => {
    const scene = await createScene()
    configurePinnedRunDir(scene.runDirectory)
    await mkdir(dirname(panelPath(scene, 1)), { recursive: true })
    await Bun.write(panelPath(scene, 1), seededPng(900))
    const { events } = await captureLogEvents(async () => {
      await expect(generateImagesCommand({ scriptPath: 'scene.md', sceneSlug: scene.sceneSlug, target: 'images' }, {
        checkScenesExist: async () => true,
        checkPromptsExist: async () => true,
        checkPanelPromptSourceCoverage: async () => coverageReport,
        runImages: async () => { throw new Error('first request failed') },
      })).rejects.toThrow('first request failed')
    })
    expect(events.some(event => event.message.includes('produced no review candidates') && event.message.includes('comic review'))).toBe(true)
    expect(events.some(event => event.message.includes('--run '))).toBe(false)
  })

  test('separate invocations with different models get distinct run IDs, separate candidate directories and recorded base-image usage', async () => {
    const scene = await createScene()
    const scriptPath = join(scene.runDirectory, '..', 'scene.md')
    const source = '# Episode\n\n## Bridge\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n'
    await writeFile(scriptPath, source)
    const sourceIdentity = await createComicSourceIdentity(scriptPath, source)
    const structuredBytes = `${canonicalTtsJson(buildComicAudioPhase2Structured(sourceIdentity, source))}\n`
    const structuredScript = createStructuredScriptArtifactRef(structuredBytes)
    await mkdir(dirname(join(scene.runDirectory, structuredScript.path)), { recursive: true })
    await writeFile(join(scene.runDirectory, structuredScript.path), structuredBytes)
    await writeInitialComicStructureManifest({ sceneRunDir: scene.runDirectory, createdAt: COMIC_AUDIO_PHASE_2_CREATED_AT, sourceIdentity, structuredScript })
    configurePinnedRunDir(scene.runDirectory)

    const invoke = async (imageModel: ImageGenerationModel, provider: ReturnType<typeof createFakeProvider>) => {
      let runId = ''
      const { events } = await captureLogEvents(async () => {
        await generateImagesCommand({ scriptPath, sceneSlug: scene.sceneSlug, target: 'images', imageModel, concurrency: 1 }, {
          checkScenesExist: async () => true,
          checkPromptsExist: async () => true,
          checkPanelPromptSourceCoverage: async () => coverageReport,
          runImages: async options => {
            runId = options.runId
            return await runFinalStage(scene, options, provider)
          },
        })
      })
      return { runId, events }
    }

    const openai = createFakeProvider()
    const first = await invoke(OPENAI_MODEL, openai)
    await Bun.sleep(5)
    const gemini = createFakeProvider()
    const second = await invoke(GEMINI_MODEL, gemini)

    expect(first.runId).not.toBe('')
    expect(second.runId).not.toBe(first.runId)
    expect(first.events.some(event => event.message.startsWith(`Image run: ${first.runId}`))).toBe(true)
    expect(second.events.some(event => event.message.includes('Current selections reused') && event.message.includes('comic review'))).toBe(true)
    expect(second.events.some(event => event.message.includes(`--run ${second.runId}`))).toBe(false)
    expect(openai.requests).toHaveLength(4)
    expect(openai.requests.every(request => request.model === OPENAI_MODEL)).toBe(true)
    // Every panel is already selected from the first run, so the second model buys nothing without --force.
    expect(gemini.requests).toHaveLength(0)
    expect((await readdir(join(scene.runDirectory, 'panels', first.runId))).filter(name => name.endsWith('.png')).sort()).toEqual(['panel-01.png', 'panel-02.png', 'panel-03.png', 'panel-04.png'])
    expect(await Bun.file(join(scene.runDirectory, 'panels', second.runId)).exists()).toBe(false)

    const forcedGemini = createFakeProvider()
    let forcedRunId = ''
    await captureLogEvents(async () => {
      await generateImagesCommand({ scriptPath, sceneSlug: scene.sceneSlug, target: 'images', imageModel: GEMINI_MODEL, concurrency: 1, force: true }, {
        checkScenesExist: async () => true,
        checkPromptsExist: async () => true,
        checkPanelPromptSourceCoverage: async () => coverageReport,
        runImages: async options => { forcedRunId = options.runId; return await runFinalStage(scene, options, forcedGemini) },
      })
    })
    expect(forcedRunId).not.toBe(first.runId)
    expect(forcedGemini.requests).toHaveLength(4)
    expect(forcedGemini.requests.every(request => request.model === GEMINI_MODEL)).toBe(true)
    for (let panelNumber = 1; panelNumber <= PANEL_COUNT; panelNumber++) {
      const firstBytes = await fileBytes(panelPath(scene, panelNumber, first.runId))
      expect(await fileBytes(panelPath(scene, panelNumber, forcedRunId))).not.toEqual(firstBytes)
      expect(await fileBytes(panelPath(scene, panelNumber))).toEqual(firstBytes)
    }
    expect((await readImageRunRecord(scene.sceneSlug, forcedRunId)).model).toBe(GEMINI_MODEL)
    await expectSingleModelLayout(scene, [first.runId, forcedRunId])

    const manifest = await readManifest(scene.runDirectory)
    const imageProviders = manifest!.items[0]!.providers.filter(provider => provider.operation === 'comic-image')
    expect(imageProviders).toHaveLength(1)
    expect(imageProviders[0]).toMatchObject({ service: 'gemini', model: GEMINI_MODEL, status: 'succeeded', metadata: { runId: forcedRunId, imagesGenerated: 4, imagesSkipped: 0, usage: { imageInputUnits: 4 * 645, textInputUnits: 4 * 30, imageOutputUnits: 4 * 6240 } } })
    const history = manifest!.items[0]!.metadata['comicImageRunHistory'] as Array<{ model: string, metadata: { runId: string, imagesGenerated: number, usage: { imageInputUnits: number } } }> | undefined
    const openaiRun = history?.find(entry => entry.metadata.runId === first.runId)
    expect(openaiRun).toMatchObject({ model: OPENAI_MODEL, metadata: { imagesGenerated: 4, usage: { imageInputUnits: 4 * 645 } } })
    const settingsText = JSON.stringify(imageProviders[0]?.settings ?? {})
    expect(settingsText).not.toMatch(/judge|qa|repair|variation|credit/i)
  })
})
