import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { estimateImageCosts, estimateOpenAIImageInputUnits, OPENAI_IMAGE_INPUT_COST_NOTE, OPENAI_IMAGE_INPUT_UNITS_PER_REFERENCE } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { generateComicPages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-comic-pages'
import { generateImagesCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-images-command'
import { generatePanelImages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-panel-images'
import { generateSceneSketches } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-sketches/generate-scene-sketches'
import { extractGeneratedImageUsage } from '~/cli/commands/process-steps/step-8-comic/comic-image-services/comic-image-targets'
import { createImageRunStats } from '~/cli/commands/process-steps/step-8-comic/comic-image-services/image-costs'
import { estimateFinalPanelImagesPrice } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-price-final-image-estimates'
import { IMAGE_ESTIMATE_BASIS_NOTE, PANEL_QA_BASIS_NOTE } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-price-output'
import { estimateFinalImageInputUnits, estimateFinalImagePricing, estimatePageMode, estimatePanelMode, estimateQaWork, normalizeFinalImageEstimateRequest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/final-image-price-estimate'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import type { ComicImageRequestInput, FinalImageOutputInventory, FinalImagePageInventory, FinalImagePanelInventory, GeneratedImageResponse, PageQaEntry, PanelBundleData, SourceCoverageReport } from '~/types'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const temporaryDirectories: string[] = []
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const sha = new Bun.CryptoHasher('sha256').update(tinyPng).digest('hex')
const cargoBayLocation = { key: 'cargo-bay', raw: 'cargo-bay' }

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

const createSceneFixture = async (sceneSlug: string): Promise<string> => {
  const runDirectory = await makeTempDir('autoshow-comic-usage-')
  temporaryDirectories.push(runDirectory)
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  const characterRoot = join(runDirectory, 'assets', 'character-references', 'character-snapshot', 'hero')
  await mkdir(characterRoot, { recursive: true })
  await Bun.write(join(characterRoot, 'reference.png'), tinyPng)
  await Bun.write(join(runDirectory, 'assets', 'character-references.json'), JSON.stringify({ schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt: '2026-01-01T00:00:00.000Z', characters: [{ key: 'hero', name: 'Hero', description: 'Test hero', sourceSketchVersion: 'v1', assets: [{ role: 'sketch-sheet', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: sha }, { role: 'source-image', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: sha }] }] }))
  const locationSheet = join(runDirectory, 'assets', 'location-references', 'location-snapshot', 'cargo-bay.png')
  await mkdir(dirname(locationSheet), { recursive: true })
  await Bun.write(locationSheet, tinyPng)
  await Bun.write(join(runDirectory, 'assets', 'location-references.json'), JSON.stringify({ schemaVersion: 2, snapshots: [{ schemaVersion: 2, snapshotId: 'location-snapshot', locationKey: 'cargo-bay', specification: 'A loading door stays left of a fixed control booth; camera angles and crops may vary.', sourceScripts: ['scripts/02-script/01.md'], sourceViews: [{ view: 'establishing', generationId: 'v1', imageSha256: sha }], sheet: { path: 'assets/location-references/location-snapshot/cargo-bay.png', sha256: sha } }] }))
  for (const panelNumber of [1, 2]) {
    const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-${String(panelNumber).padStart(2, '0')}`)
    await mkdir(directory, { recursive: true })
    await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panelNumber), null, 2)}\n\`\`\`\n`)
  }
  return runDirectory
}

const usageResponse = (): GeneratedImageResponse => ({
  mode: 'edit',
  result: { imageBase64: tinyPng.toString('base64') },
  usage: { imageInputUnits: 645, textInputUnits: 30, totalInputUnits: 675, outputUnits: 6240, totalUnits: 6915 },
})

const writeImage = async (outputPath: string): Promise<void> => {
  await mkdir(dirname(outputPath), { recursive: true })
  await Bun.write(outputPath, tinyPng)
}

const passingJudge = async (): Promise<PageQaEntry> => ({
  pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.6-sol', hardFailure: false,
  result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' }], summary: 'Pass.' },
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
})

const passingPageJudge = async (): Promise<PageQaEntry> => ({
  pageNumber: 1, panelNumbers: [1, 2], outputFile: 'attempt.png', judgeModel: 'gpt-5.6-sol', hardFailure: false,
  result: { panelStructure: { pass: true, observedPanelCount: 2, observedPanelOrder: [1, 2], issues: [] }, panels: [1, 2].map(panelNumber => ({ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' })), summary: 'Pass.' },
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
})

const pageOutput = (exists: boolean, qaReportReusable: boolean): FinalImageOutputInventory => ({ model: 'gpt-image-2', variation: 'canonical', outputPath: '/tmp/page.png', exists, qaReportReusable })

const coverageReport: SourceCoverageReport = { complete: true, totalSegments: 2, coveredSegments: 2, missingSegments: [], missingItems: [], promptFiles: [] }

afterEach(async () => {
  resetSceneRunContext()
  resetPinnedRunDir()
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('comic image usage contracts', () => {
  test('extracts only the unit fields the provider returned', () => {
    expect(extractGeneratedImageUsage({ imageInputUnits: 5, outputUnits: 7 })).toEqual({ imageInputUnits: 5, outputUnits: 7 })
    expect(extractGeneratedImageUsage({})).toBeUndefined()
  })

  test('accumulates returned image usage units into the panel run stats', async () => {
    const sceneSlug = `usage-stats-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const stats = await generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], qa: true, maxRepairs: 0 }, {
      requestImage: async input => { calls.push(input); return usageResponse() },
      writeImage,
      judgePage: passingJudge,
    })
    expect(calls).toHaveLength(2)
    expect(stats.imagesGenerated).toBe(2)
    expect(stats.totalInputImageTokens).toBe(1290)
    expect(stats.totalInputTextTokens).toBe(60)
    expect(stats.totalOutputImageTokens).toBe(12_480)
    expect(stats.totalInputTokens).toBe(2)
    expect(stats.totalOutputTokens).toBe(2)
  })

  test('accumulates returned image usage units into the grouped page run stats', async () => {
    const sceneSlug = `usage-pages-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const stats = await generateComicPages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], panelsPerImage: 2, qa: true, maxRepairs: 0 }, {
      requestImage: async input => { calls.push(input); return usageResponse() },
      writeImage,
      judgePage: passingPageJudge,
    })
    expect(calls).toHaveLength(1)
    expect(stats.imagesGenerated).toBe(1)
    expect(stats.totalInputImageTokens).toBe(645)
    expect(stats.totalInputTextTokens).toBe(30)
    expect(stats.totalOutputImageTokens).toBe(6240)
    expect(stats.totalInputTokens).toBe(1)
    expect(stats.totalOutputTokens).toBe(1)
  })

  test('accumulates returned image usage units into the sketch run stats', async () => {
    const sceneSlug = `usage-sketches-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const stats = await generateSceneSketches(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1 }, {
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

  test('appends imageInputUnits after duration in the revision-plan run summary', async () => {
    const sceneSlug = `usage-revision-${crypto.randomUUID()}`
    const runDirectory = await createSceneFixture(sceneSlug)
    configurePinnedRunDir(runDirectory)
    let revisionCalls = 0
    const { events } = await captureLogEvents(async () => {
      await generateImagesCommand({ scriptPath: 'script.md', sceneSlug, target: 'images', panels: [1], panelsPerImage: 1, revisionPlan: 'revision-plan.json', comparisonPasses: 2, promote: 'clear-winners', maxRepairs: 0 }, {
        checkScenesExist: async () => true,
        checkPromptsExist: async () => true,
        checkPanelPromptSourceCoverage: async () => coverageReport,
        runRevisionEvaluation: async () => { revisionCalls += 1; return { ...createImageRunStats(), imagesGenerated: 1, totalInputTokens: 10, totalOutputTokens: 5, totalInputImageTokens: 730, totalInputTextTokens: 35, totalOutputImageTokens: 6240 } },
      })
    })
    expect(revisionCalls).toBe(1)
    const summary = events.find(event => event.message.startsWith('summary generated='))
    expect(summary?.message).toContain('summary generated=1 skipped=0 comparisons=recorded tokens=15')
    expect(summary?.message).toContain(' duration=')
    expect(summary?.message.endsWith(' imageInputUnits=730')).toBe(true)
  })

  test('appends imageInputUnits after duration in the generate-images run summary', async () => {
    const sceneSlug = `usage-summary-${crypto.randomUUID()}`
    const runDirectory = await createSceneFixture(sceneSlug)
    configurePinnedRunDir(runDirectory)
    let runId = ''
    const { events } = await captureLogEvents(async () => {
      await generateImagesCommand({ scriptPath: 'script.md', sceneSlug, target: 'images', panels: [1], maxRepairs: 0 }, {
        checkScenesExist: async () => true,
        checkPromptsExist: async () => true,
        checkPanelPromptSourceCoverage: async () => coverageReport,
        runImages: async options => {
          runId = options.runId
          return await generatePanelImages(sceneSlug, { models: [...(options.imageModels ?? ['gpt-image-2'])], size: options.size ?? '1536x1024', quality: options.quality ?? 'high', force: false, runId: options.runId, concurrency: options.concurrency, panels: [1], qa: true, maxRepairs: 0 }, {
            requestImage: async () => usageResponse(),
            writeImage,
            judgePage: passingJudge,
          })
        },
      })
    })
    const summary = events.find(event => event.message.startsWith('summary generated='))
    expect(summary?.message).toContain('summary generated=1 skipped=0 tokens=2')
    expect(summary?.message).toContain(' duration=')
    expect(summary?.message.endsWith(' imageInputUnits=645')).toBe(true)
    expect(events.some(event => event.message === `output directory: ${runDirectory}`)).toBe(true)
    expect(runId).not.toBe('')
    expect(await Bun.file(join(runDirectory, 'panels', runId, 'panel-01.png')).exists()).toBe(true)
  })

  test('models one thousand input units per reference and stays unpriced without a registry rate', () => {
    expect(OPENAI_IMAGE_INPUT_UNITS_PER_REFERENCE).toBe(1000)
    expect(estimateOpenAIImageInputUnits('gpt-image-2', 3)).toEqual({ unitsPerReference: 1000, referenceInputs: 3, totalUnits: 3000, ratePer1MCents: null, costCents: null, priced: false })
    const [withReferences] = estimateImageCosts({ openaiImageModels: ['gpt-image-2'], imageSize: '1536x1024', imageQuality: 'high', imageCount: 2, imageInputs: ['a.png', 'b.png', 'c.png'] })
    expect(withReferences?.imageInputEstimate).toEqual({ unitsPerReference: 1000, referenceInputs: 6, totalUnits: 6000, ratePer1MCents: null, costCents: null, priced: false })
    expect(withReferences?.note).toContain(OPENAI_IMAGE_INPUT_COST_NOTE)
    expect(OPENAI_IMAGE_INPUT_COST_NOTE).toContain('1,000 units per high-detail reference')
    expect(OPENAI_IMAGE_INPUT_COST_NOTE).toContain('unpriced')
    expect(estimateImageCosts({ openaiImageModels: ['gpt-image-2'] })[0]?.imageInputEstimate).toBeUndefined()
  })

  test('counts initial and repair reference inputs for OpenAI models only', () => {
    const request = normalizeFinalImageEstimateRequest({ scriptPath: 'script.md', sceneSlug: 'pricing', imageModels: ['gpt-image-2', 'gemini-3.1-flash-lite-image'], maxRepairs: 2 })
    if (request.mode !== 'panel') throw new Error('Expected panel mode')
    const inventory: FinalImagePanelInventory = {
      mode: 'panel',
      panelPromptsDir: '/tmp',
      panels: [
        { directoryName: 'panel-01', panelNumber: 1, referenceCount: 3, variations: [{ variation: 'canonical', allModelsExist: false }] },
        { directoryName: 'panel-02', panelNumber: 2, referenceCount: 2, variations: [{ variation: 'canonical', allModelsExist: true }] },
      ],
      gridPages: [],
    }
    expect(estimateFinalImageInputUnits(request, inventory)).toEqual({
      unitsPerReference: 1000, referenceInputs: 11, totalUnits: 11_000, ratePer1MCents: null, costCents: null, priced: false,
      models: ['gpt-image-2'], initialCalls: 1, initialReferenceInputs: 3, maximumRepairCalls: 2, maximumRepairReferenceInputs: 8,
    })
    expect(estimateFinalImageInputUnits({ ...request, models: ['gemini-3.1-flash-lite-image'] }, inventory)).toBeNull()
    expect(estimateFinalImageInputUnits({ ...request, qa: { enabled: false } }, inventory)).toMatchObject({ referenceInputs: 3, maximumRepairCalls: 0 })
    const modeEstimate = estimatePanelMode(request, inventory)
    const qaWork = estimateQaWork(request, modeEstimate, inventory)
    expect(estimateFinalImagePricing(request, modeEstimate, qaWork).imageInput).toBeNull()
    expect(estimateFinalImagePricing(request, modeEstimate, qaWork, inventory).imageInput).toMatchObject({ referenceInputs: 11, totalUnits: 11_000, priced: false })
  })

  test('models page-mode repair inputs for every output without a reusable QA report', () => {
    const request = normalizeFinalImageEstimateRequest({ scriptPath: 'script.md', sceneSlug: 'pricing', imageModels: ['gpt-image-2'], panelsPerImage: 2, maxRepairs: 2 })
    if (request.mode !== 'page') throw new Error('Expected page mode')
    const inventory: FinalImagePageInventory = {
      mode: 'page',
      panelPromptsDir: '/tmp',
      pages: [
        { pageNumber: 1, panelNumbers: [1, 2], referenceCount: 3, outputs: [pageOutput(false, false)] },
        { pageNumber: 2, panelNumbers: [3, 4], referenceCount: 2, outputs: [pageOutput(true, false)] },
        { pageNumber: 3, panelNumbers: [5, 6], referenceCount: 4, outputs: [pageOutput(true, true)] },
      ],
    }
    const estimate = estimateFinalImageInputUnits(request, inventory)
    expect(estimate).toMatchObject({ initialCalls: 1, initialReferenceInputs: 3, maximumRepairCalls: 4, maximumRepairReferenceInputs: 14, referenceInputs: 17, totalUnits: 17_000, priced: false })
    const qaWork = estimateQaWork(request, estimatePageMode(request, inventory), inventory)
    expect(qaWork?.maximumAdditionalImageEdits).toBe(4)
    expect(qaWork?.maximumAdditionalImageEdits).toBe(estimate?.maximumRepairCalls)
    const forced = estimateFinalImageInputUnits({ ...request, force: true }, inventory)
    const forcedQaWork = estimateQaWork({ ...request, force: true }, estimatePageMode({ ...request, force: true }, inventory), inventory)
    expect(forced).toMatchObject({ initialCalls: 3, initialReferenceInputs: 9, maximumRepairCalls: 6, maximumRepairReferenceInputs: 24 })
    expect(forcedQaWork?.maximumAdditionalImageEdits).toBe(forced?.maximumRepairCalls)
    expect(estimateFinalImageInputUnits({ ...request, qa: { enabled: false } }, inventory)).toMatchObject({ initialCalls: 1, maximumRepairCalls: 0, referenceInputs: 3 })
  })

  test('prints the modeled image-input line after the grouped page subtotal', async () => {
    const sceneSlug = `usage-page-price-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const { events } = await captureLogEvents(async () => {
      await estimateFinalPanelImagesPrice({ scriptPath: 'script.md', sceneSlug, imageModels: ['gpt-image-2'], panelsPerImage: 2, maxRepairs: 1 })
    })
    expect(events.every(event => event.category === 'pricing')).toBe(true)
    const messages = events.map(event => event.message)
    const pageIndex = messages.indexOf('Comic Page Price Estimate: 1 entries')
    expect(pageIndex).toBeGreaterThanOrEqual(0)
    const subtotalIndex = messages.findIndex((message, index) => index > pageIndex && message.startsWith('Subtotal: ~$'))
    expect(subtotalIndex).toBeGreaterThan(pageIndex)
    const inputIndex = messages.indexOf('Image input (modeled): 5,000 units across 5 references (unpriced)')
    expect(inputIndex).toBe(subtotalIndex + 1)
    expect(messages[inputIndex + 1]).toBe('Grouped pages use canonical character references followed by each distinct immutable location reference.')
    expect(events[inputIndex]?.metadata).toMatchObject({ models: ['gpt-image-2'], initialCalls: 1, initialReferenceInputs: 2, maximumRepairCalls: 1, maximumRepairReferenceInputs: 3, imageInputUnits: 5000, priced: false })
    expect(messages).toContain('Comic Page QA Price Estimate')
    expect(events.find(event => event.message === 'Comic Page QA Price Estimate')?.metadata).toMatchObject({ maximumAdditionalImageEdits: 1 })
    const basisIndex = messages.indexOf(IMAGE_ESTIMATE_BASIS_NOTE)
    expect(basisIndex).toBeGreaterThan(messages.indexOf('Comic Page Repair Price Estimate: 1 entries'))
    expect(events[basisIndex]?.metadata).toMatchObject({ imageInputUnitsReportedSeparately: true, textInputModeled: false })
  })

  test('prints the modeled image-input line in the generate-images price estimate', async () => {
    const sceneSlug = `usage-price-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug)
    const { events } = await captureLogEvents(async () => {
      await estimateFinalPanelImagesPrice({ scriptPath: 'script.md', sceneSlug, imageModels: ['gpt-image-2'], maxRepairs: 1 })
    })
    expect(events.every(event => event.category === 'pricing')).toBe(true)
    const messages = events.map(event => event.message)
    const initialIndex = messages.indexOf('Initial image calls: 2')
    const inputIndex = messages.indexOf('Image input (modeled): 10,000 units across 10 references (unpriced)')
    expect(initialIndex).toBeGreaterThanOrEqual(0)
    expect(inputIndex).toBe(initialIndex + 1)
    expect(events[inputIndex]?.metadata).toMatchObject({
      models: ['gpt-image-2'],
      unitsPerReference: 1000,
      referenceInputs: 10,
      imageInputUnits: 10_000,
      initialCalls: 2,
      initialReferenceInputs: 4,
      maximumRepairCalls: 2,
      maximumRepairReferenceInputs: 6,
      ratePer1MCents: null,
      costCents: null,
      priced: false,
    })
    expect(messages).toContain(PANEL_QA_BASIS_NOTE)
    const basisIndex = messages.indexOf(IMAGE_ESTIMATE_BASIS_NOTE)
    expect(basisIndex).toBeGreaterThanOrEqual(0)
    expect(basisIndex).toBeLessThan(inputIndex)
    expect(IMAGE_ESTIMATE_BASIS_NOTE).toContain('Image input (modeled)')
    expect(IMAGE_ESTIMATE_BASIS_NOTE).not.toContain('Token-based')
    expect(events[basisIndex]?.metadata).toMatchObject({ imageInputUnitsReportedSeparately: true, textInputModeled: false })
    expect(events.find(event => event.message === 'Comic Panel QA Price Estimate')?.metadata).toMatchObject({ maximumAdditionalImageEdits: 2 })
  })
})
