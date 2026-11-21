import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import { isComicProviderError, runComicImageWorkItems } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-image-work-items'
import { createImageRunStats } from '~/cli/commands/visuals/comic/comic-image-services/image-costs'
import { coerceAndValidateGenerateImages } from '~/cli/commands/visuals/comic/comic-utils/cli-args'
import { generateImagesCommandDefinition } from '~/cli/commands/visuals/comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { AppProviderError } from '~/utils/error-handler'
import promptsConfig from '~/cli/commands/visuals/comic/comic-prompts/prompts.json'
import type { ComicImageGenerationDependencies, ComicImageRunStop, ComicImageWorkItemResult, PanelBundleData } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { createLiveLocationFixture } from '../../../../test-utils/live-location-reference-fixture'

const temporaryDirectories: string[] = []
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
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
  await createLiveCharacterFixture(runDirectory)
  await createLiveLocationFixture(runDirectory, [{ key: 'cargo-bay', name: 'Cargo Bay', specification: 'A loading door stays left of a fixed control booth.', sourceScripts: [] }], tinyPng)
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
    configureCharactersRoot('input/characters')
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
    const ok = (): ComicImageWorkItemResult => ({ stats: createImageRunStats() })
    let stopRecord: ComicImageRunStop | undefined
    await expect(runComicImageWorkItems({
      concurrency: 1,
      items: ['panel-01', 'panel-02', 'panel-03'],
      render: async item => {
        rendered.push(item)
        return item === 'panel-02' ? { ...ok(), error: new AppProviderError('You have insufficient credit.', { status: 402, stage: 'openai' }) } : ok()
      },
      stats: createImageRunStats(),
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
    const ok = (): ComicImageWorkItemResult => ({ stats: createImageRunStats() })
    await expect(runComicImageWorkItems({
      concurrency: 1,
      items: ['panel-01', 'panel-02', 'panel-03'],
      render: async item => {
        rendered.push(item)
        return item === 'panel-02' ? { ...ok(), error: new AppProviderError('You have insufficient credit.', { status: 402, stage: 'openai' }) } : ok()
      },
      stats: createImageRunStats(),
      itemFailure: { message: count => `${count} image generation task(s) failed`, stage: 'comic:generate-images' },
    })).rejects.toThrow('1 image generation task(s) failed')
    expect(rendered).toEqual(['panel-01', 'panel-02', 'panel-03'])
  })

  const writeImage: NonNullable<ComicImageGenerationDependencies['writeImage']> = async (outputPath, imageBase64) => {
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, Buffer.from(imageBase64, 'base64'))
  }

  test('never requests a third panel image once the second panel hits a provider error (transport mock; decoded PNG retained)', async () => {
    const sceneSlug = `stop-on-error-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, [1, 2, 3])
    const requestedPanels: number[] = []
    await expect(generatePanelImages(sceneSlug, { model: 'gpt-image-2.6-flare', size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2, 3], stopOnProviderError: true }, {
      requestImage: async input => {
        const panelNumber = Number(/Sub-panel (\d+)/.exec(input.normalizedPrompt)?.[1] ?? 0)
        requestedPanels.push(panelNumber)
        if (panelNumber === 2) throw new AppProviderError('You have insufficient credit.', { status: 402, stage: 'openai' })
        return { mode: 'generate', result: { imageBase64: tinyPng.toString('base64') } }
      },
      writeImage,
    })).rejects.toThrow('stopped=panel-02')
    expect(requestedPanels).toEqual([1, 2])
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'panel-01.png')).bytes()).toEqual(new Uint8Array(tinyPng))
    expect(await Bun.file(join(runDirectory, 'panels', 'panel-01.png')).exists()).toBe(true)
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'panel-03.png')).exists()).toBe(false)
  })

  test('never requests a third grouped page once the second page hits a provider error (transport mock)', async () => {
    const sceneSlug = `stop-on-error-pages-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, [1, 2, 3, 4, 5, 6])
    let requests = 0
    await expect(generateComicPages(sceneSlug, { model: 'gpt-image-2.6-flare', size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: 'all', panelsPerImage: 2, stopOnProviderError: true }, {
      requestImage: async () => {
        requests++
        if (requests === 2) throw new AppProviderError('You have insufficient credit.', { status: 402, stage: 'openai' })
        return { mode: 'generate', result: { imageBase64: tinyPng.toString('base64') } }
      },
      writeImage,
    })).rejects.toThrow(/stopped=.*abandoned=1/)
    expect(requests).toBe(2)
    expect(await Bun.file(join(runDirectory, 'pages', 'test-run', 'page-01-panels-01-02.png')).exists()).toBe(true)
    expect(await Bun.file(join(runDirectory, 'pages', 'test-run', 'page-03-panels-05-06.png')).exists()).toBe(false)
    // Grouped pages never fill canonical panel slots.
    expect(await Bun.file(join(runDirectory, 'panels', 'panel-01.png')).exists()).toBe(false)
  })

  test('parses --stop-on-provider-error, leaves it off by default, and rejects the retired --credit-preflight flag', () => {
    expect(parseArgs(['script.md', '--stop-on-provider-error']).stopOnProviderError).toBe(true)
    expect(parseArgs(['script.md']).stopOnProviderError).toBeUndefined()
    expect(() => parseArgs(['script.md', '--credit-preflight'])).toThrow()
  })

  test('states the per-bundle truth in the retired continuation prompt text', () => {
    const scenePrompts = (promptsConfig as { 'Scene Prompts': Record<string, string> })['Scene Prompts']
    for (const key of ['2nd Panel', '3rd Panel']) {
      expect(scenePrompts[key]).toContain('Each final panel is generated from its own bundle')
      expect(scenePrompts[key]).not.toContain('blocking')
      expect(scenePrompts[key]).not.toContain('Continue from the previous panels of the scene')
    }
  })
})
