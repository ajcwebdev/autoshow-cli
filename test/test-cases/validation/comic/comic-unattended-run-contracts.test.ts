import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { generatePanelImages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-panel-images'
import { isComicProviderError, runComicImageWorkItems } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-image-work-items'
import { runComicCreditPreflight } from '~/cli/commands/process-steps/step-8-comic/comic-utils/credit-preflight'
import { createImageRunStats } from '~/cli/commands/process-steps/step-8-comic/comic-image-services/image-costs'
import { coerceAndValidateGenerateImages } from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import { generateImagesCommandDefinition } from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import { AppProviderError } from '~/utils/error-handler'
import promptsConfig from '~/cli/commands/process-steps/step-8-comic/comic-prompts/prompts.json'
import type { ComicImageRunStop, ComicImageWorkItemResult, PageQaEntry, PageQaRequest, PanelBundleData } from '~/types'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const temporaryDirectories: string[] = []
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const sha = new Bun.CryptoHasher('sha256').update(tinyPng).digest('hex')
const cargoBayLocation = { key: 'cargo-bay', raw: 'cargo-bay' }

const panelBundle = (panelNumber: number): PanelBundleData => ({
  schemaVersion: 4, snapshotId: 'character-snapshot', title: 'Unattended', location: 'Cargo Bay',
  panels: [{
    number: panelNumber, description: `Authored staging ${panelNumber}.`,
    shotPlan: `Medium eye-level shot ${panelNumber}; hero is screen left.`,
    characterKeys: ['hero'], speech: [], sourceSegmentIds: [`beat-${panelNumber}`],
    sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Authored staging ${panelNumber}.`, sourceSpans: [], beatIndex: panelNumber, location: cargoBayLocation }],
    locationKey: 'cargo-bay', locationSnapshotId: 'location-snapshot',
  }],
})

const createSceneFixture = async (sceneSlug: string, panelNumbers: number[]): Promise<{ runDirectory: string }> => {
  const runDirectory = await makeTempDir('autoshow-comic-unattended-')
  temporaryDirectories.push(runDirectory)
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  const characterRoot = join(runDirectory, 'assets', 'character-references', 'character-snapshot', 'hero')
  await mkdir(characterRoot, { recursive: true })
  await Bun.write(join(characterRoot, 'reference.png'), tinyPng)
  await Bun.write(join(runDirectory, 'assets', 'character-references.json'), JSON.stringify({ schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt: '2026-01-01T00:00:00.000Z', characters: [{ key: 'hero', name: 'Hero', description: 'Test hero', sourceSketchVersion: 'v1', assets: [{ role: 'sketch-sheet', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: sha }, { role: 'source-image', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: sha }] }] }))
  const locationSheet = join(runDirectory, 'assets', 'location-references', 'location-snapshot', 'cargo-bay.png')
  await mkdir(dirname(locationSheet), { recursive: true })
  await Bun.write(locationSheet, tinyPng)
  await Bun.write(join(runDirectory, 'assets', 'location-references.json'), JSON.stringify({ schemaVersion: 2, snapshots: [{ schemaVersion: 2, snapshotId: 'location-snapshot', locationKey: 'cargo-bay', specification: 'A loading door stays left of a fixed control booth.', sourceScripts: [], sourceViews: [{ view: 'establishing', generationId: 'v1', imageSha256: sha }], sheet: { path: 'assets/location-references/location-snapshot/cargo-bay.png', sha256: sha } }] }))
  for (const panelNumber of panelNumbers) {
    const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-${String(panelNumber).padStart(2, '0')}`)
    await mkdir(directory, { recursive: true })
    await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panelNumber), null, 2)}\n\`\`\`\n`)
  }
  return { runDirectory }
}

const parseArgs = (args: string[]) => coerceAndValidateGenerateImages(parseCommandInvocation([generateImagesCommandDefinition.name, ...args], generateImagesCommandDefinition, GLOBAL_FLAG_DEFINITIONS))

describe('unattended comic image runs', () => {
  afterEach(async () => {
    resetSceneRunContext()
    while (temporaryDirectories.length > 0) await rm(temporaryDirectories.pop()!, { recursive: true, force: true })
  })

  test('classifies provider failures and leaves other errors alone', () => {
    expect(isComicProviderError(new AppProviderError('insufficient credit', { status: 402, stage: 'openai' }))).toBe(true)
    expect(isComicProviderError(new Error('wrapped', { cause: new AppProviderError('quota', { status: 429, stage: 'openai' }) }))).toBe(true)
    expect(isComicProviderError(new Error('a local filesystem problem'))).toBe(false)
    expect(isComicProviderError('not an error')).toBe(false)
  })

  test('aborts the remaining work items on the first provider error and preserves what was written', async () => {
    const rendered: string[] = []
    const ok = (): ComicImageWorkItemResult => ({ stats: createImageRunStats(), qaEntries: [] })
    let stopRecord: ComicImageRunStop | undefined
    await expect(runComicImageWorkItems({
      concurrency: 1,
      items: ['panel-01', 'panel-02', 'panel-03'],
      render: async item => {
        rendered.push(item)
        return item === 'panel-02' ? { ...ok(), error: new AppProviderError('You have insufficient credit.', { status: 402, stage: 'openai' }) } : ok()
      },
      stats: createImageRunStats(),
      qaEnabled: false,
      stopOnProviderError: true,
      describeItem: item => item,
      onStop: stop => { stopRecord = stop },
      itemFailure: { message: count => `${count} image generation task(s) failed`, stage: 'comic:generate-images' },
    })).rejects.toThrow('stopped=panel-02 reason=You have insufficient credit. abandoned=1')
    expect(rendered).toEqual(['panel-01', 'panel-02'])
    expect(stopRecord).toEqual({ item: 'panel-02', reason: 'You have insufficient credit.', abandoned: 1 })
  })

  test('keeps the default behavior of continuing past a provider error', async () => {
    const rendered: string[] = []
    const ok = (): ComicImageWorkItemResult => ({ stats: createImageRunStats(), qaEntries: [] })
    await expect(runComicImageWorkItems({
      concurrency: 1,
      items: ['panel-01', 'panel-02', 'panel-03'],
      render: async item => {
        rendered.push(item)
        return item === 'panel-02' ? { ...ok(), error: new AppProviderError('You have insufficient credit.', { status: 402, stage: 'openai' }) } : ok()
      },
      stats: createImageRunStats(),
      qaEnabled: false,
      itemFailure: { message: count => `${count} image generation task(s) failed`, stage: 'comic:generate-images' },
    })).rejects.toThrow('1 image generation task(s) failed')
    expect(rendered).toEqual(['panel-01', 'panel-02', 'panel-03'])
  })

  test('never requests a third panel image once the second panel hits a provider error', async () => {
    const sceneSlug = `stop-on-error-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, [1, 2, 3])
    const requestedPanels: number[] = []
    const judgePage = async (request: PageQaRequest): Promise<PageQaEntry> => ({
      pageNumber: request.pageNumber, panelNumbers: [request.pageNumber], outputFile: 'attempt.png', judgeModel: request.model, hardFailure: false,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [request.pageNumber], issues: [] }, panels: [{ panelNumber: request.pageNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, blockingMatch: true, axisSideMatch: true, blockingAudit: [], dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' }], summary: 'Pass.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await expect(generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2, 3], qa: true, maxRepairs: 0, stopOnProviderError: true }, {
      requestImage: async input => {
        const panelNumber = Number(/Sub-panel (\d+)/.exec(input.normalizedPrompt)?.[1] ?? 0)
        requestedPanels.push(panelNumber)
        if (panelNumber === 2) throw new AppProviderError('You have insufficient credit.', { status: 402, stage: 'openai' })
        return { mode: 'generate', result: { imageBase64: tinyPng.toString('base64') } }
      },
      writeImage: async (outputPath, imageBase64) => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, Buffer.from(imageBase64, 'base64')) },
      judgePage,
    })).rejects.toThrow('stopped=panel-02')
    expect(requestedPanels).toEqual([1, 2])
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'panel-01.png')).exists()).toBe(true)
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'panel-03.png')).exists()).toBe(false)
  })

  test('passes a healthy credit preflight and fails fast on a payment-required response', async () => {
    expect(await runComicCreditPreflight({}, { listModels: async () => ({ status: 200 }) })).toEqual({ provider: 'openai', status: 'ok' })
    await expect(runComicCreditPreflight({}, { listModels: async () => ({ status: 402 }) })).rejects.toThrow('the OpenAI account has insufficient credit (HTTP 402). No image was generated.')
    await expect(runComicCreditPreflight({}, { listModels: async () => ({ status: 401 }) })).rejects.toThrow('the configured OpenAI credential was rejected (HTTP 401)')
    let requests = 0
    expect(await runComicCreditPreflight({ price: true }, { listModels: async () => { requests++; return { status: 200 } } })).toEqual({ provider: 'openai', status: 'skipped-price-mode' })
    expect(requests).toBe(0)
  })

  test('parses the unattended flags and leaves them off by default', () => {
    expect(parseArgs(['script.md', '--stop-on-provider-error', '--credit-preflight']).stopOnProviderError).toBe(true)
    expect(parseArgs(['script.md', '--stop-on-provider-error', '--credit-preflight']).creditPreflight).toBe(true)
    expect(parseArgs(['script.md']).stopOnProviderError).toBeUndefined()
    expect(parseArgs(['script.md']).creditPreflight).toBeUndefined()
  })

  test('states the per-bundle truth in the retired continuation prompt text', () => {
    const scenePrompts = (promptsConfig as { 'Scene Prompts': Record<string, string> })['Scene Prompts']
    for (const key of ['2nd Panel', '3rd Panel']) {
      expect(scenePrompts[key]).toContain('Each final panel is generated from its own bundle; continuity is carried by the blocking ledger when a plan exists.')
      expect(scenePrompts[key]).not.toContain('Continue from the previous panels of the scene')
    }
  })
})
