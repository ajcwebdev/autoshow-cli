import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { estimateImageCosts, estimateOpenAIImageInputUnits, OPENAI_IMAGE_INPUT_COST_NOTE, OPENAI_IMAGE_INPUT_UNITS_PER_REFERENCE } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generateImagesCommand, runFinalPanelImageStage } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-images-command'
import { failedImageRunStatsFromError } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-image-run-statistics'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import { generateSceneSketches } from '~/cli/commands/visuals/comic/comic-commands/generate-sketches/generate-scene-sketches'
import { extractGeneratedImageUsage } from '~/cli/commands/visuals/comic/comic-image-services/comic-image-targets'
import { createImageRunStats, estimateImageOutputCost, recordBaseImageAccounting } from '~/cli/commands/visuals/comic/comic-image-services/image-costs'
import { createComicSourceIdentity, createStructuredScriptArtifactRef } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import { writeInitialComicStructureManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-manifest'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { AppProviderError } from '~/utils/error-handler'
import { buildComicAudioPhase2Structured } from './comic-audio-phase-fixture'
import { buildFinalPanelImageEstimate, estimateFinalPanelImagesPrice } from '~/cli/commands/visuals/comic/comic-utils/comic-price-final-image-estimates'
import { IMAGE_ESTIMATE_BASIS_NOTE, IMAGE_INPUT_BASIS_NOTE } from '~/cli/commands/visuals/comic/comic-utils/comic-price-output'
import { estimateFinalImageInputUnits, normalizeFinalImageEstimateRequest } from '~/cli/commands/visuals/comic/comic-utils/final-image-price-estimate'
import { getPanelComicImagePath } from '~/cli/commands/visuals/comic/comic-utils/scene-utils'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import type { ComicImageRequestInput, FinalImagePageInventory, FinalImagePanelInventory, GeneratedImageResponse, PanelBundleData, SourceCoverageReport } from '~/types'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { createLiveLocationFixture } from '../../../../test-utils/live-location-reference-fixture'
import { seededPng } from '../../../../test-utils/seeded-png-fixture'

const temporaryDirectories: string[] = []
const referencePng = seededPng(1)
const cargoBayLocation = { key: 'cargo-bay', raw: 'cargo-bay' }
const MODEL = 'gpt-image-2.6-flare' as const

const panelBundle = (panelNumber: number): PanelBundleData => ({
  schemaVersion: 4, snapshotId: 'character-snapshot',
  title: 'Usage Contract', location: 'Cargo Bay', panels: [{
    number: panelNumber, description: `Authored staging ${panelNumber}.`,
    shotPlan: `Medium eye-level shot ${panelNumber}; hero is screen left, facing right; exclude all unlisted cast.`,
    characterKeys: ['hero'], speech: [], sourceSegmentIds: [`beat-${panelNumber}`],
    sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Authored staging ${panelNumber}.`, sourceSpans: [], beatIndex: panelNumber, location: cargoBayLocation }],
    locationKey: 'cargo-bay', locationSnapshotId: 'location-snapshot',
  }],
})

const createSceneFixture = async (sceneSlug: string, panels = 2): Promise<string> => {
  const projectDirectory = await makeTempDir('autoshow-comic-usage-')
  const runDirectory = join(projectDirectory, 'scene')
  temporaryDirectories.push(projectDirectory)
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  await createLiveCharacterFixture(projectDirectory)
  await createLiveLocationFixture(projectDirectory, [{ key: 'cargo-bay', name: 'Cargo Bay', specification: 'A loading door stays left of a fixed control booth; camera angles and crops may vary.', sourceScripts: ['scripts/02-script/01.md'] }], referencePng)
  for (let panelNumber = 1; panelNumber <= panels; panelNumber++) {
    const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-${String(panelNumber).padStart(2, '0')}`)
    await mkdir(directory, { recursive: true })
    await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panelNumber), null, 2)}\n\`\`\`\n`)
  }
  return runDirectory
}

let responseSeed = 100
const usageResponse = (): GeneratedImageResponse => ({
  mode: 'edit',
  result: { imageBase64: seededPng(responseSeed++).toString('base64') },
  usage: { imageInputUnits: 645, textInputUnits: 30, totalInputUnits: 675, outputUnits: 6240, totalUnits: 6915 },
})

const writeImage = async (outputPath: string, imageBase64: string): Promise<void> => {
  await mkdir(dirname(outputPath), { recursive: true })
  await Bun.write(outputPath, Buffer.from(imageBase64, 'base64'))
}

const panelRunOptions = (overrides: Partial<Parameters<typeof generatePanelImages>[1]> = {}): Parameters<typeof generatePanelImages>[1] => ({
  model: MODEL, size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], ...overrides,
})

const coverageReport: SourceCoverageReport = { complete: true, totalSegments: 2, coveredSegments: 2, missingSegments: [], missingItems: [], promptFiles: [] }

afterEach(async () => {
  resetSceneRunContext()
  resetPinnedRunDir()
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('comic image usage contracts', () => {
  test('extracts only the unit fields the provider returned', () => {
    expect(extractGeneratedImageUsage({ imageInputUnits: 5, outputUnits: 7 })).toEqual({ imageInputUnits: 5, outputUnits: 7 })
    expect(extractGeneratedImageUsage({})).toBeUndefined()
  })

  test('base-image accounting counts one generated image with its returned usage and registry cost', () => {
    const stats = createImageRunStats()
    const { costLabel } = recordBaseImageAccounting(stats, { model: MODEL, quality: 'high', size: '1536x1024', durationMs: 25, usage: { imageInputUnits: 645, textInputUnits: 30, outputUnits: 6240 } })
    expect(stats).toMatchObject({ imagesGenerated: 1, imagesSkipped: 0, totalDurationMs: 25, totalInputImageTokens: 645, totalInputTextTokens: 30, totalOutputImageTokens: 6240, totalInputTokens: 0, totalOutputTokens: 0 })
    expect(stats.totalCost).toBeGreaterThan(0)
    expect(costLabel).toEndWith(' estimated')
    recordBaseImageAccounting(stats, { model: MODEL, quality: 'high', size: '1536x1024', durationMs: 5 })
    expect(stats).toMatchObject({ imagesGenerated: 2, totalDurationMs: 30, totalInputImageTokens: 645 })
  })

  test('transport: accumulates returned image usage units into the single-model panel run stats with no judge tokens', async () => {
    const sceneSlug = `usage-stats-${crypto.randomUUID()}`
    const runDirectory = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const stats = await generatePanelImages(sceneSlug, panelRunOptions(), {
      requestImage: async input => { calls.push(input); return usageResponse() },
      writeImage,
    })
    expect(calls).toHaveLength(2)
    expect(calls.every(call => call.model === MODEL)).toBe(true)
    expect(stats.imagesGenerated).toBe(2)
    expect(stats.imagesSkipped).toBe(0)
    expect(stats.totalInputImageTokens).toBe(1290)
    expect(stats.totalInputTextTokens).toBe(60)
    expect(stats.totalOutputImageTokens).toBe(12_480)
    expect(stats.totalInputTokens).toBe(0)
    expect(stats.totalOutputTokens).toBe(0)
    expect((await readdir(join(runDirectory, 'panels', 'test-run'))).filter(name => name.endsWith('.png')).sort()).toEqual(['panel-01.png', 'panel-02.png'])
  })

  test('partial completion within one single-model run accounts only for the missing panel', async () => {
    const sceneSlug = `usage-partial-${crypto.randomUUID()}`
    const runDirectory = await createSceneFixture(sceneSlug)
    const existingCandidate = getPanelComicImagePath(sceneSlug, 1, { runId: 'test-run' })
    await writeImage(existingCandidate, seededPng(7).toString('base64'))
    const calls: ComicImageRequestInput[] = []
    const stats = await generatePanelImages(sceneSlug, panelRunOptions(), {
      requestImage: async input => { calls.push(input); return usageResponse() },
      writeImage,
    })
    expect(calls).toHaveLength(1)
    expect(stats.imagesGenerated).toBe(1)
    expect(stats.imagesSkipped).toBe(1)
    expect(stats.totalInputImageTokens).toBe(645)
    expect(stats.totalOutputImageTokens).toBe(6240)
    expect(new Uint8Array(await Bun.file(join(runDirectory, 'panels', 'panel-01.png')).arrayBuffer())).toEqual(new Uint8Array(seededPng(7)))
  })

  for (const unavailable of [false, true]) test(`a four-panel retry preserves paid usage from both attempts with a ${unavailable ? 'failed' : 'writable'} usage checkpoint`, async () => {
    const sceneSlug = `usage-retry-${crypto.randomUUID()}`
    const runDirectory = await createSceneFixture(sceneSlug, 4)
    configurePinnedRunDir(runDirectory)
    const scriptPath = join(dirname(runDirectory), 'scene.md')
    const source = '# Episode\n\n## Bridge\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n'
    await Bun.write(scriptPath, source)
    const sourceIdentity = await createComicSourceIdentity(scriptPath, source)
    const bytes = JSON.stringify(buildComicAudioPhase2Structured(sourceIdentity, source))
    const structuredScript = createStructuredScriptArtifactRef(bytes)
    await Bun.write(join(runDirectory, structuredScript.path), bytes)
    await writeInitialComicStructureManifest({ sceneRunDir: runDirectory, createdAt: new Date().toISOString(), sourceIdentity, structuredScript })
    const imageState = async () => (await readManifest(runDirectory))!.items[0]!.providers.find(state => state.operation === 'comic-image')!
    const purchases: string[] = []
    const runningCounts: unknown[] = []
    let fail = true
    const invoke = () => generateImagesCommand({ scriptPath, sceneSlug, target: 'images', imageModel: MODEL, recoveryRunId: 'retry-run', concurrency: fail ? 1 : 2, stopOnProviderError: true }, {
      checkScenesExist: async () => true,
      checkPromptsExist: async () => true,
      checkPanelPromptSourceCoverage: async () => coverageReport,
      runImages: async options => {
        const running = await imageState()
        runningCounts.push(running.metadata['imagesGenerated'])
        if (unavailable && !fail) await mkdir(join(runDirectory, 'metadata/image-usage', `${running.metadata['attemptId']}.json`), { recursive: true })
        return await runFinalPanelImageStage(options, {
          checkPanelPromptSourceCoverage: async () => coverageReport,
          requestImage: async input => {
            if (fail && purchases.length === 2) throw new AppProviderError('Fixture interruption', { status: 429, stage: 'openai' })
            purchases.push(input.normalizedPrompt)
            return usageResponse()
          },
          writeImage,
        })
      },
    })

    const unitCost = estimateImageOutputCost(MODEL, 'high', '1536x1024')!
    await expect(invoke()).rejects.toThrow('Failed at image generation step')
    expect(await imageState()).toMatchObject({ status: 'failed', attempts: 1, metadata: { imagesGenerated: 2, usage: { costUsd: 2 * unitCost, imageInputUnits: 1290, textInputUnits: 60, imageOutputUnits: 12480 } } })
    fail = false
    const { events } = await captureLogEvents(invoke)
    expect(events.some(event => event.message.startsWith('summary generated=2 skipped=2 '))).toBe(true)
    expect(events.filter(event => event.message.includes('Could not persist the comic image usage checkpoint'))).toHaveLength(unavailable ? 1 : 0)
    expect(runningCounts).toEqual([0, 2])
    expect(purchases).toHaveLength(4)
    expect(new Set(purchases).size).toBe(4)
    expect(await Bun.file(join(runDirectory, 'panels/panel-04.png')).exists()).toBe(true)
    const completed = await imageState()
    expect(completed).toMatchObject({ status: 'succeeded', attempts: 2, metadata: { runId: 'retry-run', imagesGenerated: 4, imagesSkipped: 2, usage: { costUsd: 4 * unitCost, imageInputUnits: 2580, textInputUnits: 120, imageOutputUnits: 24960 } } })
    expect(Object.values(completed.metadata['usageByAttempt'] as Record<string, unknown>)).toMatchObject([
      { status: 'failed', imagesGenerated: 2, imagesSkipped: 0 },
      { status: 'succeeded', imagesGenerated: 2, imagesSkipped: 2 },
    ])
  })

  test('grid composition failure retains the usage from panel requests completed before composition', async () => {
    const sceneSlug = `usage-grid-failure-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const failure = await runFinalPanelImageStage({ sceneSlug, scriptPath: 'scene.md', imageModel: MODEL, runId: 'grid-failure', concurrency: 1, grid: { columns: 2, rows: 1 } }, {
      checkPanelPromptSourceCoverage: async () => coverageReport,
      requestImage: async () => usageResponse(),
      writeImage,
      composeGridPage: async () => { throw new Error('Fixture composition failure') },
    }).catch((error: unknown) => error)
    expect(failedImageRunStatsFromError(failure)).toMatchObject({ imagesGenerated: 2, totalInputImageTokens: 1290, totalOutputImageTokens: 12480 })
  })

  test('a sketch output write failure retains both provider responses in the failed attempt usage', async () => {
    const sceneSlug = `usage-sketch-failure-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    let writes = 0
    const failure = await generateSceneSketches(sceneSlug, { model: MODEL, size: '1536x1024', quality: 'high', force: false, runId: 'sketch-failure', concurrency: 1, panelsPerImage: 1 }, {
      requestImage: async () => usageResponse(),
      writeImage: async (path, data) => {
        if (++writes === 2) throw new Error('Fixture write failure')
        await writeImage(path, data)
      },
    }).catch((error: unknown) => error)
    expect(failedImageRunStatsFromError(failure)).toMatchObject({ imagesGenerated: 2, totalInputImageTokens: 1290, totalCost: 2 * estimateImageOutputCost(MODEL, 'high', '1536x1024')! })
  })

  test('accumulates returned image usage units into the grouped page run stats', async () => {
    const sceneSlug = `usage-pages-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const stats = await generateComicPages(sceneSlug, { model: MODEL, size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], panelsPerImage: 2 }, {
      requestImage: async input => { calls.push(input); return usageResponse() },
      writeImage,
    })
    expect(calls).toHaveLength(1)
    expect(stats.imagesGenerated).toBe(1)
    expect(stats.totalInputImageTokens).toBe(645)
    expect(stats.totalInputTextTokens).toBe(30)
    expect(stats.totalOutputImageTokens).toBe(6240)
    expect(stats.totalInputTokens).toBe(0)
    expect(stats.totalOutputTokens).toBe(0)
  })

  test('accumulates returned image usage units into the sketch run stats', async () => {
    const sceneSlug = `usage-sketches-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const stats = await generateSceneSketches(sceneSlug, { model: MODEL, size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1 }, {
      requestImage: async input => { calls.push(input); return usageResponse() },
      writeImage,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.referenceImages.length).toBeGreaterThan(0)
    expect(stats.imagesGenerated).toBe(1)
    expect(stats.totalInputImageTokens).toBe(645)
    expect(stats.totalInputTextTokens).toBe(30)
    expect(stats.totalOutputImageTokens).toBe(6240)
  })

  test('appends imageInputUnits after duration in the generate-images run summary and reports the image run ID', async () => {
    const sceneSlug = `usage-summary-${crypto.randomUUID()}`
    const runDirectory = await createSceneFixture(sceneSlug)
    configurePinnedRunDir(runDirectory)
    let runId = ''
    const { events } = await captureLogEvents(async () => {
      await generateImagesCommand({ scriptPath: 'script.md', sceneSlug, target: 'images', panels: [1] }, {
        checkScenesExist: async () => true,
        checkPromptsExist: async () => true,
        checkPanelPromptSourceCoverage: async () => coverageReport,
        runImages: async options => {
          runId = options.runId
          return await generatePanelImages(sceneSlug, panelRunOptions({ model: options.imageModel ?? MODEL, runId: options.runId, concurrency: options.concurrency, panels: [1] }), {
            requestImage: async () => usageResponse(),
            writeImage,
          })
        },
      })
    })
    const summary = events.find(event => event.message.startsWith('summary generated='))
    expect(summary?.message).toContain('summary generated=1 skipped=0 tokens=0')
    expect(summary?.message).toContain(' duration=')
    expect(summary?.message.endsWith(' imageInputUnits=645')).toBe(true)
    expect(events.some(event => event.message === `output directory: ${runDirectory}`)).toBe(true)
    expect(runId).not.toBe('')
    expect(events.some(event => event.message.startsWith(`Image run: ${runId}`) && event.message.includes(`--run ${runId}`))).toBe(true)
    expect(await Bun.file(join(runDirectory, 'panels', runId, 'panel-01.png')).exists()).toBe(true)
    expect(await Bun.file(join(runDirectory, 'panels', 'panel-01.png')).exists()).toBe(true)
  })

  test('models one thousand input units per reference, prices them at the registry rate, and stays unpriced without one', () => {
    expect(OPENAI_IMAGE_INPUT_UNITS_PER_REFERENCE).toBe(1000)
    // GPT Image 2.5 Flare registry image-input rate: 800 cents per 1M units.
    const flare = estimateOpenAIImageInputUnits(MODEL, 3)
    expect(flare).toMatchObject({ unitsPerReference: 1000, referenceInputs: 3, totalUnits: 3000, ratePer1MCents: 800, priced: true })
    expect(flare.costCents).toBeCloseTo(2.4)
    expect(estimateOpenAIImageInputUnits('unregistered-openai-image-model', 3)).toEqual({ unitsPerReference: 1000, referenceInputs: 3, totalUnits: 3000, ratePer1MCents: null, costCents: null, priced: false })
    const [withReferences] = estimateImageCosts({ openaiImageModels: [MODEL], imageSize: '1536x1024', imageQuality: 'high', imageCount: 2, imageInputs: ['a.png', 'b.png', 'c.png'] })
    expect(withReferences?.imageInputEstimate).toMatchObject({ unitsPerReference: 1000, referenceInputs: 6, totalUnits: 6000, ratePer1MCents: 800, priced: true })
    expect(withReferences?.imageInputEstimate?.costCents).toBeCloseTo(4.8)
    expect(withReferences?.note).toContain('reference inputs are modeled separately at 1,000 tokens per reference')
    expect(OPENAI_IMAGE_INPUT_COST_NOTE).toContain('1,000 units per high-detail reference')
    expect(OPENAI_IMAGE_INPUT_COST_NOTE).toContain('unpriced')
    expect(estimateImageCosts({ openaiImageModels: [MODEL] })[0]?.imageInputEstimate).toBeUndefined()
  })

  test('counts base-image reference inputs for pending panels of the one selected OpenAI model only', () => {
    const request = normalizeFinalImageEstimateRequest({ scriptPath: 'script.md', sceneSlug: 'pricing', imageModel: MODEL })
    if (request.mode !== 'panel') throw new Error('Expected panel mode')
    const absent = { outputPath: null, exists: false }
    const inventory: FinalImagePanelInventory = {
      mode: 'panel',
      panelPromptsDir: '/tmp',
      panels: [
        { directoryName: 'panel-01', panelNumber: 1, referenceCount: 3, candidate: absent, selection: { path: '/tmp/panel-01.png', exists: false }, pending: true },
        { directoryName: 'panel-02', panelNumber: 2, referenceCount: 2, candidate: absent, selection: { path: '/tmp/panel-02.png', exists: true }, pending: false },
      ],
      gridPages: [],
    }
    const estimate = estimateFinalImageInputUnits(request, inventory)
    expect(estimate).toMatchObject({ unitsPerReference: 1000, referenceInputs: 3, totalUnits: 3000, ratePer1MCents: 800, priced: true, model: MODEL, calls: 1 })
    expect(estimate).not.toHaveProperty('maximumRepairCalls')
    expect(estimate?.costCents).toBeCloseTo(2.4)
    expect(estimateFinalImageInputUnits({ ...request, model: 'gemini-nano-banana-2.1' }, inventory)).toBeNull()
  })

  test('counts page-mode base-image reference inputs only for pending grouped pages', () => {
    const request = normalizeFinalImageEstimateRequest({ scriptPath: 'script.md', sceneSlug: 'pricing', imageModel: MODEL, panelsPerImage: 2 })
    if (request.mode !== 'page') throw new Error('Expected page mode')
    const page = (pageNumber: number, referenceCount: number, exists: boolean) => ({ pageNumber, panelNumbers: [pageNumber * 2 - 1, pageNumber * 2], referenceCount, output: { outputPath: `/tmp/page-${pageNumber}.png`, exists }, pending: !exists })
    const inventory: FinalImagePageInventory = { mode: 'page', panelPromptsDir: '/tmp', pages: [page(1, 3, false), page(2, 2, true), page(3, 4, false)] }
    const estimate = estimateFinalImageInputUnits(request, inventory)
    expect(estimate).toMatchObject({ calls: 2, referenceInputs: 7, totalUnits: 7000, priced: true })
    expect(estimate?.costCents).toBeCloseTo(5.6)
  })

  test('prices partial completion within one single-model run as the missing panel only', async () => {
    const sceneSlug = `usage-partial-price-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    await writeImage(getPanelComicImagePath(sceneSlug, 1, { runId: 'resume-run' }), seededPng(9).toString('base64'))
    const result = await buildFinalPanelImageEstimate({ scriptPath: 'script.md', sceneSlug, imageModel: MODEL, recoveryRunId: 'resume-run' })
    if (result.status !== 'ready' || result.modeEstimate.mode === 'page') throw new Error('Expected a ready panel estimate')
    expect(result.modeEstimate).toMatchObject({ totalOutputs: 1, skipped: 1 })
    expect(result.pricing.primary).toMatchObject({ model: MODEL, outputs: 1 })
    expect(result.pricing.imageInput).toMatchObject({ calls: 1, referenceInputs: 2, totalUnits: 2000 })
  })

  test('prints the modeled image-input line after the grouped page total and basis note', async () => {
    const sceneSlug = `usage-page-price-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const { events } = await captureLogEvents(async () => {
      await estimateFinalPanelImagesPrice({ scriptPath: 'script.md', sceneSlug, imageModel: MODEL, panelsPerImage: 2 })
    })
    expect(events.every(event => event.category === 'pricing')).toBe(true)
    const messages = events.map(event => event.message)
    const pageIndex = messages.indexOf('Comic Page Price Estimate: 1 entries')
    expect(pageIndex).toBeGreaterThanOrEqual(0)
    const totalIndex = messages.findIndex((message, index) => index > pageIndex && message.startsWith('Total: ~$'))
    expect(totalIndex).toBeGreaterThan(pageIndex)
    expect(messages[totalIndex + 1]).toBe(IMAGE_ESTIMATE_BASIS_NOTE)
    const inputIndex = messages.indexOf('Image input (modeled): 2,000 units across 2 references (~$0.02)')
    expect(inputIndex).toBe(totalIndex + 2)
    expect(events[inputIndex]?.metadata).toMatchObject({ model: MODEL, calls: 1, imageInputUnits: 2000, priced: true })
    expect(messages[inputIndex + 1]).toBe(IMAGE_INPUT_BASIS_NOTE)
    expect(messages[inputIndex + 2]).toBe('Grouped pages use current canonical character references followed by each distinct current location reference.')
    expect(messages.some(message => /\b(?:QA|Repair|judge)\b/i.test(message))).toBe(false)
    const basisIndex = messages.indexOf(IMAGE_ESTIMATE_BASIS_NOTE)
    expect(basisIndex).toBeGreaterThanOrEqual(0)
    expect(events[basisIndex]?.metadata).toMatchObject({ imageInputUnitsReportedSeparately: true, textInputModeled: false })
    expect(events.find(event => event.message.startsWith('Estimated total:'))?.metadata).toMatchObject({ imageCalls: 1 })
  })

  test('prints the modeled image-input line in the generate-images price estimate', async () => {
    const sceneSlug = `usage-price-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const { events } = await captureLogEvents(async () => {
      await estimateFinalPanelImagesPrice({ scriptPath: 'script.md', sceneSlug, imageModel: MODEL })
    })
    expect(events.every(event => event.category === 'pricing')).toBe(true)
    const messages = events.map(event => event.message)
    const callsIndex = messages.indexOf('Image calls: 2')
    const inputIndex = messages.indexOf('Image input (modeled): 4,000 units across 4 references (~$0.03)')
    expect(callsIndex).toBeGreaterThanOrEqual(0)
    expect(inputIndex).toBe(callsIndex + 1)
    expect(events[inputIndex]?.metadata).toMatchObject({
      model: MODEL,
      calls: 2,
      unitsPerReference: 1000,
      referenceInputs: 4,
      imageInputUnits: 4000,
      ratePer1MCents: 800,
      costCents: 3.2,
      priced: true,
    })
    expect(messages.some(message => /\b(?:QA|Repair|judge)\b/i.test(message))).toBe(false)
    const basisIndex = messages.indexOf(IMAGE_ESTIMATE_BASIS_NOTE)
    expect(basisIndex).toBeGreaterThanOrEqual(0)
    expect(basisIndex).toBeLessThan(inputIndex)
    expect(IMAGE_ESTIMATE_BASIS_NOTE).toContain('Image input (modeled)')
    expect(IMAGE_ESTIMATE_BASIS_NOTE).not.toContain('Token-based')
    expect(events[basisIndex]?.metadata).toMatchObject({ imageInputUnitsReportedSeparately: true, textInputModeled: false })
  })
})
