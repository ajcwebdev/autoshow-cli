import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { runFinalPanelImageStage } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-images-command'
import { generateSceneSketches } from '~/cli/commands/visuals/comic/comic-commands/generate-sketches/generate-scene-sketches'
import { buildFinalPanelImageEstimate } from '~/cli/commands/visuals/comic/comic-utils/comic-price-final-image-estimates'
import { printFinalImageEstimate } from '~/cli/commands/visuals/comic/comic-utils/comic-price-output'
import { estimateGenerateSketchesPrice } from '~/cli/commands/visuals/comic/comic-utils/comic-price-sketch-estimates'
import { normalizeFinalImageEstimateRequest } from '~/cli/commands/visuals/comic/comic-utils/final-image-price-estimate'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import type { ComicImageGenerationDependencies, FinalImageEstimateResult, FinalPanelImageStageDependencies, GenerateImagesCommandOptions, PanelBundleData, SourceCoverageReport } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { createLiveLocationFixture } from '../../../../test-utils/live-location-reference-fixture'
import { seededPng } from '../../../../test-utils/seeded-png-fixture'

const MODEL = 'gpt-image-2.6-flare'
const temporaryDirectories: string[] = []
const cargoBayLocation = { key: 'cargo-bay', raw: 'cargo-bay' }
const generatedPng = seededPng(7)
const selectedPng = seededPng(99)

const panelBundle = (panelNumber: number): PanelBundleData => ({
  schemaVersion: 4, snapshotId: 'character-snapshot', title: 'Pricing', location: 'Cargo Bay',
  panels: [{
    number: panelNumber, description: `Authored staging ${panelNumber}.`,
    shotPlan: `Medium eye-level shot ${panelNumber}; hero is screen left.`,
    characterKeys: ['hero'], speech: [], sourceSegmentIds: [`beat-${panelNumber}`],
    sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Authored staging ${panelNumber}.`, sourceSpans: [], beatIndex: panelNumber, location: cargoBayLocation }],
    locationKey: 'cargo-bay', locationSnapshotId: 'location-snapshot',
  }],
})

const createScene = async (): Promise<{ sceneSlug: string, runDirectory: string }> => {
  const sceneSlug = `comic-pricing-${crypto.randomUUID()}`
  const runDirectory = await makeTempDir('autoshow-comic-pricing-')
  temporaryDirectories.push(runDirectory)
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  await createLiveCharacterFixture(runDirectory)
  await createLiveLocationFixture(runDirectory, [{ key: 'cargo-bay', name: 'Cargo Bay', specification: 'A loading door stays left of a fixed control booth.', sourceScripts: [] }], seededPng(1))
  for (const panelNumber of [1, 2, 3, 4]) {
    const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-0${panelNumber}`)
    await mkdir(directory, { recursive: true })
    await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panelNumber), null, 2)}\n\`\`\`\n`)
  }
  return { sceneSlug, runDirectory }
}

const writePng = async (path: string, bytes: Uint8Array): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, bytes)
}

/** Fake provider: counts every image request and returns a real decodable PNG. Transport-level only; proves nothing about image content. */
const countingProvider = () => {
  const requests: string[] = []
  const referenceCounts: number[] = []
  const dependencies: Required<ComicImageGenerationDependencies> = {
    requestImage: async input => {
      requests.push(input.normalizedPrompt)
      referenceCounts.push(input.referenceImages.length)
      return { mode: 'generate', result: { imageBase64: generatedPng.toString('base64') } }
    },
    writeImage: async (outputPath, imageBase64) => writePng(outputPath, Buffer.from(imageBase64, 'base64')),
  }
  return { requests, referenceCounts, dependencies }
}

const runOptions = (runId: string, force = false) => ({ model: MODEL, size: '1536x1024' as const, quality: 'high' as const, force, runId, concurrency: 1 })

const priceOptions = (sceneSlug: string, overrides: Partial<GenerateImagesCommandOptions> = {}): GenerateImagesCommandOptions => ({ scriptPath: 'scene.md', sceneSlug, imageModel: MODEL, ...overrides })

const coverageReport: SourceCoverageReport = { complete: true, totalSegments: 4, coveredSegments: 4, missingSegments: [], missingItems: [], promptFiles: [] }

/** Dispatches through the real generate-images final stage (panel, page or panel-plus-grid) with the same options the estimate priced. */
const runFinalStage = async (sceneSlug: string, runId: string, dependencies: FinalPanelImageStageDependencies, overrides: Partial<GenerateImagesCommandOptions> = {}) =>
  await runFinalPanelImageStage({ ...priceOptions(sceneSlug, overrides), runId, concurrency: 1 }, { checkPanelPromptSourceCoverage: async () => coverageReport, ...dependencies })

const ready = async (options: GenerateImagesCommandOptions): Promise<Extract<FinalImageEstimateResult, { status: 'ready' }>> => {
  const result = await buildFinalPanelImageEstimate(options)
  if (result.status !== 'ready') throw new Error(`Expected a ready estimate, got ${result.status}`)
  return result
}

const hashTree = async (root: string): Promise<Record<string, string>> => {
  const rows: Record<string, string> = {}
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const path = join(entry.parentPath, entry.name)
    rows[path] = new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex')
  }
  return rows
}

const sha = async (path: string): Promise<string> => new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex')

const RETIRED_PRICE_TERMS = /judge|repair|comparison|variation|\bqa\b|blooper|credit.?preflight/i

describe('comic single-model image pricing matches mocked dispatch', () => {
  afterEach(async () => {
    resetSceneRunContext()
    configureCharactersRoot('input/characters')
    while (temporaryDirectories.length > 0) await rm(temporaryDirectories.pop()!, { recursive: true, force: true })
  })

  test('requests normalize to one model with no variation, QA or model-list fields', () => {
    const request = normalizeFinalImageEstimateRequest({ scriptPath: 'scene.md', sceneSlug: 'scene' })
    expect(request).toEqual({ sceneSlug: 'scene', model: MODEL, size: '1536x1024', quality: 'high', force: false, selection: 'all', selectionSpecified: false, mode: 'panel' })
    expect(normalizeFinalImageEstimateRequest({ scriptPath: 'scene.md', sceneSlug: 'scene', imageModel: 'gemini-nano-banana-2.1', panelsPerImage: 2 })).toMatchObject({ mode: 'page', panelsPerImage: 2, model: 'gemini-nano-banana-2.1' })
    expect(normalizeFinalImageEstimateRequest({ scriptPath: 'scene.md', sceneSlug: 'scene', grid: { columns: 2, rows: 2 } })).toMatchObject({ mode: 'grid', grid: { columns: 2, rows: 2 } })
    expect(normalizeFinalImageEstimateRequest({ scriptPath: 'scene.md', sceneSlug: 'scene', recoveryRunId: 'run-r' })).toMatchObject({ runId: 'run-r' })
    for (const key of ['models', 'variations', 'variationsSpecified', 'qa']) expect(request).not.toHaveProperty(key)
  })

  test('four missing individual panels price four image calls and dispatch exactly four requests, without writes during pricing', async () => {
    const { sceneSlug, runDirectory } = await createScene()
    const before = await hashTree(runDirectory)
    const estimate = await ready(priceOptions(sceneSlug))
    expect(await hashTree(runDirectory)).toEqual(before)
    expect(estimate.modeEstimate).toMatchObject({ mode: 'panel', totalOutputs: 4, skipped: 0, grid: null })
    expect(estimate.pricing.primary).toMatchObject({ model: MODEL, outputs: 4 })
    expect(estimate.pricing.imageInput?.calls).toBe(4)

    const provider = countingProvider()
    await runFinalStage(sceneSlug, 'run-a', provider.dependencies)
    expect(provider.requests).toHaveLength(estimate.modeEstimate.totalOutputs)
    for (const panelNumber of [1, 2, 3, 4]) {
      // Decoded integrity: the canonical slot holds exactly the verified run candidate bytes.
      expect(await sha(join(runDirectory, 'panels', `panel-0${panelNumber}.png`))).toBe(await sha(join(runDirectory, 'panels', 'run-a', `panel-0${panelNumber}.png`)))
    }

    expect((await ready(priceOptions(sceneSlug, { recoveryRunId: 'run-a' }))).modeEstimate).toMatchObject({ totalOutputs: 0, skipped: 4 })
    expect((await ready(priceOptions(sceneSlug))).modeEstimate).toMatchObject({ totalOutputs: 0, skipped: 4 })
  })

  test('--panels-per-image 2 prices two page calls and dispatches exactly two requests', async () => {
    const { sceneSlug, runDirectory } = await createScene()
    const estimate = await ready(priceOptions(sceneSlug, { panelsPerImage: 2 }))
    expect(estimate.modeEstimate).toEqual({ mode: 'page', totalOutputs: 2, skipped: 0 })
    expect(estimate.pricing.primary).toMatchObject({ outputLabel: 'page', outputs: 2 })

    const provider = countingProvider()
    await runFinalStage(sceneSlug, 'run-p', provider.dependencies, { panelsPerImage: 2 })
    expect(provider.requests).toHaveLength(2)
    expect(await Bun.file(join(runDirectory, 'pages', 'run-p', 'page-01-panels-01-02.png')).exists()).toBe(true)
    expect(await Bun.file(join(runDirectory, 'pages', 'run-p', 'page-02-panels-03-04.png')).exists()).toBe(true)
    expect((await ready(priceOptions(sceneSlug, { panelsPerImage: 2, recoveryRunId: 'run-p' }))).modeEstimate).toEqual({ mode: 'page', totalOutputs: 0, skipped: 2 })
  })

  test('grouped pages are skipped only by a run-scoped page, never by filled canonical panel slots', async () => {
    const { sceneSlug, runDirectory } = await createScene()
    for (const panelNumber of [1, 2, 3, 4]) await writePng(join(runDirectory, 'panels', `panel-0${panelNumber}.png`), selectedPng)
    expect((await ready(priceOptions(sceneSlug, { panelsPerImage: 2 }))).modeEstimate).toMatchObject({ totalOutputs: 2 })
    const provider = countingProvider()
    await runFinalStage(sceneSlug, 'run-p', provider.dependencies, { panelsPerImage: 2 })
    expect(provider.requests).toHaveLength(2)
    for (const panelNumber of [1, 2, 3, 4]) expect(await Bun.file(join(runDirectory, 'panels', `panel-0${panelNumber}.png`)).bytes()).toEqual(new Uint8Array(selectedPng))
  })

  test('a local 2x2 grid adds zero provider calls and zero cost to the individual-panel run', async () => {
    const { sceneSlug, runDirectory } = await createScene()
    const panelOnly = await ready(priceOptions(sceneSlug))
    const withGrid = await ready(priceOptions(sceneSlug, { panelsPerImage: 1, grid: { columns: 2, rows: 2 } }))
    expect(withGrid.modeEstimate).toMatchObject({ mode: 'grid', totalOutputs: 4, grid: { totalOutputs: 1, skipped: 0, capacity: 4 } })
    expect(withGrid.pricing.primary.outputs).toBe(4)
    expect(withGrid.pricing.estimatedTotal).toBe(panelOnly.pricing.estimatedTotal)

    const { events } = await captureLogEvents(() => printFinalImageEstimate(withGrid))
    expect(events.find(event => event.message.startsWith('Comic Grid Pages'))?.metadata).toMatchObject({ totalOutputs: 1, providerCalls: 0, totalCost: 0 })

    const provider = countingProvider()
    const compositions: string[][] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (() => { throw new Error('Local grid composition must not reach the network') }) as unknown as typeof fetch
    try {
      await runFinalStage(sceneSlug, 'run-g', {
        ...provider.dependencies,
        composeGridPage: async input => {
          compositions.push(input.sources)
          await writePng(input.outputPath, generatedPng)
          return { width: 2, height: 2 }
        },
      }, { panelsPerImage: 1, grid: { columns: 2, rows: 2 } })
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(provider.requests).toHaveLength(4)
    expect(compositions).toEqual([[1, 2, 3, 4].map(panelNumber => join(runDirectory, 'panels', 'run-g', `panel-0${panelNumber}.png`))])
  })

  test('two selected panels price and dispatch only the two missing panels; --force counts all four and preserves the selection', async () => {
    const { sceneSlug, runDirectory } = await createScene()
    for (const panelNumber of [1, 2]) await writePng(join(runDirectory, 'panels', `panel-0${panelNumber}.png`), selectedPng)
    const selectedHashes = await Promise.all([1, 2].map(panelNumber => sha(join(runDirectory, 'panels', `panel-0${panelNumber}.png`))))

    const normal = await ready(priceOptions(sceneSlug))
    expect(normal.modeEstimate).toMatchObject({ totalOutputs: 2, skipped: 2 })
    expect(normal.pricing.primary.outputs).toBe(2)
    expect(normal.inventory.mode !== 'page' && normal.inventory.panels.filter(panel => panel.pending).map(panel => panel.panelNumber)).toEqual([3, 4])

    const provider = countingProvider()
    await runFinalStage(sceneSlug, 'run-b', provider.dependencies)
    expect(provider.requests).toHaveLength(2)
    expect(provider.requests.map(prompt => Number(/Sub-panel (\d+)/.exec(prompt)?.[1]))).toEqual([3, 4])
    expect(await Bun.file(join(runDirectory, 'panels', 'run-b', 'panel-01.png')).exists()).toBe(false)

    const forced = await ready(priceOptions(sceneSlug, { force: true }))
    expect(forced.modeEstimate).toMatchObject({ totalOutputs: 4, skipped: 0 })
    const forcedProvider = countingProvider()
    await runFinalStage(sceneSlug, 'run-c', forcedProvider.dependencies, { force: true })
    expect(forcedProvider.requests).toHaveLength(4)
    expect(await Promise.all([1, 2].map(panelNumber => sha(join(runDirectory, 'panels', `panel-0${panelNumber}.png`))))).toEqual(selectedHashes)
  })

  test('two retained run candidates price and dispatch only the two missing panels and are published without new requests', async () => {
    const { sceneSlug, runDirectory } = await createScene()
    for (const panelNumber of [1, 2]) await writePng(join(runDirectory, 'panels', 'run-r', `panel-0${panelNumber}.png`), selectedPng)

    expect((await ready(priceOptions(sceneSlug))).modeEstimate).toMatchObject({ totalOutputs: 4 })
    const recovered = await ready(priceOptions(sceneSlug, { recoveryRunId: 'run-r' }))
    expect(recovered.modeEstimate).toMatchObject({ totalOutputs: 2, skipped: 2 })
    expect(recovered.pricing.primary.outputs).toBe(2)

    const provider = countingProvider()
    await runFinalStage(sceneSlug, 'run-r', provider.dependencies)
    expect(provider.requests).toHaveLength(2)
    for (const panelNumber of [1, 2]) expect(await Bun.file(join(runDirectory, 'panels', `panel-0${panelNumber}.png`)).bytes()).toEqual(new Uint8Array(selectedPng))
    expect((await ready(priceOptions(sceneSlug, { recoveryRunId: 'run-r', force: true }))).modeEstimate).toMatchObject({ totalOutputs: 4 })
  })

  test('price output has one model row and no judge, repair, comparison or variation rows', async () => {
    const { sceneSlug } = await createScene()
    for (const options of [priceOptions(sceneSlug), priceOptions(sceneSlug, { panelsPerImage: 2 }), priceOptions(sceneSlug, { grid: { columns: 2, rows: 2 } })]) {
      const { events } = await captureLogEvents(async () => printFinalImageEstimate(await buildFinalPanelImageEstimate(options)))
      expect(events.length).toBeGreaterThan(0)
      for (const event of events) {
        expect(event.message).not.toMatch(RETIRED_PRICE_TERMS)
        expect(Object.keys(event.metadata ?? {}).join(' ')).not.toMatch(RETIRED_PRICE_TERMS)
        expect(event.metadata ?? {}).not.toHaveProperty('models')
      }
      const header = events.find(event => event.message.startsWith('Comic - Price Estimate: generate-images'))
      expect(header?.metadata).toMatchObject({ model: MODEL })
      const total = events.find(event => event.message.startsWith('Estimated total'))
      expect(Object.keys(total?.metadata ?? {}).sort()).toEqual(['estimatedTotal', 'imageCalls'])
    }
  })

  test('sketch estimates price one model and match mocked sketch dispatch', async () => {
    const { sceneSlug } = await createScene()
    const { result: estimate, events } = await captureLogEvents(async () => await estimateGenerateSketchesPrice({ sceneSlug, imageModel: MODEL, panelsPerImage: 2 }))
    expect(estimate).toMatchObject({ model: MODEL, totalSketches: 2 })
    expect(estimate).not.toHaveProperty('models')
    for (const event of events) expect(event.message).not.toMatch(RETIRED_PRICE_TERMS)

    const provider = countingProvider()
    await generateSceneSketches(sceneSlug, { ...runOptions('run-s'), panelsPerImage: 2 }, provider.dependencies)
    expect(provider.requests).toHaveLength(estimate!.totalSketches)
    expect(new Set(provider.requests).size).toBe(2)
  })

  test('sketch estimates price the prior-sketch continuity references that mocked dispatch attaches', async () => {
    const { sceneSlug } = await createScene()
    const estimate = await estimateGenerateSketchesPrice({ sceneSlug, imageModel: MODEL, panelsPerImage: 1 })
    expect(estimate).toMatchObject({ totalSketches: 4 })

    const provider = countingProvider()
    await generateSceneSketches(sceneSlug, { ...runOptions('run-p'), panelsPerImage: 1 }, provider.dependencies)
    // Chunk 1 sends hero + cargo-bay; later chunks add the sketch that established hero (chunk 1) and the previous chunk's sketch, deduplicated.
    expect(provider.referenceCounts).toEqual([2, 3, 4, 4])
    expect(estimate!.referenceInputs).toBe(provider.referenceCounts.reduce((sum, count) => sum + count, 0))
  })
})
