import { describe, expect, test } from 'bun:test'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { generateComicBaseImage } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-base-image-request'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import { createImageRunStats } from '~/cli/commands/visuals/comic/comic-image-services/image-costs'
import type { ComicBaseImageRequestInput, ComicImageGenerationDependencies, ComicImageRequestInput, GeneratedImageResponse, GeneratePanelImagesOptions } from '~/types'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { redDotPng } from '../../../../test-utils/media-fixtures'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'
const { tinyPng, createSceneFixture, fakeImageProvider, temporaryDirectories } = setupPageContractFixtures()

const replacementPng = Buffer.from(redDotPng)
const sha256 = (bytes: Uint8Array): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const readBytes = async (path: string): Promise<Buffer> => Buffer.from(await Bun.file(path).arrayBuffer())
const listAll = async (directory: string): Promise<string[]> => (await readdir(directory, { recursive: true })).map(String).sort()

const makeRequest = async (overrides: Partial<ComicBaseImageRequestInput> & { force?: boolean } = {}) => {
  const root = await makeTempDir('autoshow-comic-base-image-')
  temporaryDirectories.push(root)
  const directory = join(root, 'panels', 'run-a')
  const calls: ComicImageRequestInput[] = []
  const events: string[] = []
  const stats = createImageRunStats()
  const input: ComicBaseImageRequestInput = {
    kind: 'panel',
    itemNumber: 1,
    outputPath: join(directory, 'panel-01.png'),
    model: 'gpt-image-2.6-flare',
    prompt: 'Create one final comic page image from the ordered panel data below.',
    referenceImages: ['/refs/hero.png', '/refs/cargo-bay.png'],
    sceneSlug: 'base-image',
    options: { model: 'gpt-image-2.6-flare', size: '1536x1024', quality: 'high', force: overrides.force ?? false, runId: 'run-a', concurrency: 1 },
    requestImage: async request => {
      calls.push(request)
      events.push('request')
      return { mode: 'generate', result: { imageBase64: replacementPng.toString('base64'), mimeType: 'image/png' }, usage: { outputUnits: 1000, textInputUnits: 10, imageInputUnits: 20 } } as GeneratedImageResponse
    },
    writeImage: async (outputPath, imageBase64) => {
      events.push(`write:imagesGenerated=${stats.imagesGenerated}:outputUnits=${stats.totalOutputImageTokens}`)
      await mkdir(dirname(outputPath), { recursive: true })
      await Bun.write(outputPath, Buffer.from(imageBase64, 'base64'))
    },
    nextHostedIndex: () => 0,
    stats,
    ...overrides,
  }
  return { input, calls, events, stats, directory }
}

describe('generateComicBaseImage single request contract', () => {
  test('dispatches exactly one request with the prompt, ordered references and selected model, records usage before writing, and leaves no pending file (transport fake)', async () => {
    const { input, calls, events, stats, directory } = await makeRequest()
    const result = await generateComicBaseImage(input)
    expect(calls).toEqual([{ normalizedPrompt: input.prompt, referenceImages: ['/refs/hero.png', '/refs/cargo-bay.png'], model: 'gpt-image-2.6-flare', size: '1536x1024', quality: 'high' }])
    expect(events).toEqual(['request', 'write:imagesGenerated=1:outputUnits=1000'])
    expect(stats.imagesGenerated).toBe(1)
    expect(stats.totalInputTextTokens).toBe(10)
    expect(stats.totalInputImageTokens).toBe(20)
    expect(result.status).toBe('generated')
    expect(result.generatedEvidence).toMatchObject({ sha256: sha256(replacementPng), width: 1, height: 1 })
    expect(result.preservedPriorPath).toBeUndefined()
    expect(sha256(await readBytes(input.outputPath))).toBe(sha256(replacementPng))
    expect(await listAll(directory)).toEqual(['panel-01.png'])
  })

  test('skips an existing output with zero requests unless forced', async () => {
    const { input, calls, stats } = await makeRequest()
    await mkdir(dirname(input.outputPath), { recursive: true })
    await Bun.write(input.outputPath, tinyPng)
    const result = await generateComicBaseImage(input)
    expect(result).toEqual({ status: 'skipped', outputPath: input.outputPath, durationMs: 0 })
    expect(calls).toHaveLength(0)
    expect(stats.imagesGenerated).toBe(0)
    expect(await readBytes(input.outputPath)).toEqual(tinyPng)
  })

  test('a successful forced regeneration moves the prior paid bytes to superseded/ before placing the new image', async () => {
    const { input, calls, directory } = await makeRequest({ force: true })
    await mkdir(directory, { recursive: true })
    await Bun.write(input.outputPath, tinyPng)
    const result = await generateComicBaseImage(input)
    expect(calls).toHaveLength(1)
    expect(result.status).toBe('generated')
    expect(result.preservedPriorPath).toBeDefined()
    expect(dirname(result.preservedPriorPath!)).toBe(join(directory, 'superseded'))
    expect(await readBytes(result.preservedPriorPath!)).toEqual(tinyPng)
    expect(await readBytes(input.outputPath)).toEqual(replacementPng)
    expect((await listAll(directory)).filter(path => path.includes('.pending'))).toEqual([])
  })

  test('a failed provider request under --force keeps the prior bytes and creates no pending or superseded files', async () => {
    const { input, directory } = await makeRequest({
      force: true,
      requestImage: async () => { throw new Error('provider unavailable') },
    })
    await mkdir(directory, { recursive: true })
    await Bun.write(input.outputPath, tinyPng)
    await expect(generateComicBaseImage(input)).rejects.toThrow('provider unavailable')
    expect(await readBytes(input.outputPath)).toEqual(tinyPng)
    expect(await listAll(directory)).toEqual(['panel-01.png'])
    expect(input.stats.imagesGenerated).toBe(0)
  })

  test('a failed write under --force keeps the prior bytes, removes the partial pending file, retains the paid response bytes and still accounts for the paid image', async () => {
    const { input, directory, stats } = await makeRequest({ force: true })
    input.writeImage = async outputPath => {
      await Bun.write(outputPath, 'partial')
      throw new Error('disk full')
    }
    await mkdir(directory, { recursive: true })
    await Bun.write(input.outputPath, tinyPng)
    await expect(generateComicBaseImage(input)).rejects.toThrow(/Writing generated panel 1 failed\. Paid response bytes saved at .*panel-01\.png\.[0-9a-f-]+\.rejected\. disk full/)
    expect(await readBytes(input.outputPath)).toEqual(tinyPng)
    const files = await listAll(directory)
    expect(files.filter(path => path.includes('.pending'))).toEqual([])
    const rejected = files.filter(path => path.endsWith('.rejected'))
    expect(rejected).toHaveLength(1)
    expect(files).toHaveLength(2)
    expect(await readBytes(join(directory, rejected[0]!))).toEqual(replacementPng)
    expect(stats.imagesGenerated).toBe(1)
    expect(stats.totalOutputImageTokens).toBe(1000)
  })

  test('an unsupported response MIME type that the writer rejects still retains the decoded paid bytes outside candidate discovery', async () => {
    const { input, directory } = await makeRequest()
    const avifBytes = Buffer.from('not-really-avif-but-paid-bytes')
    input.requestImage = async () => ({ mode: 'generate', result: { imageBase64: avifBytes.toString('base64'), mimeType: 'image/avif' }, usage: { outputUnits: 1000 } })
    input.writeImage = async (_outputPath, _imageBase64, mimeType) => { throw new Error(`Unsupported image MIME type: ${mimeType}`) }
    await expect(generateComicBaseImage(input)).rejects.toThrow(/Paid response bytes saved at .*\.rejected\. Unsupported image MIME type: image\/avif/)
    const files = await listAll(directory)
    expect(files.filter(path => path.endsWith('.png'))).toEqual([])
    const rejected = files.filter(path => path.endsWith('.rejected'))
    expect(rejected).toHaveLength(1)
    expect(await readBytes(join(directory, rejected[0]!))).toEqual(avifBytes)
  })

  test('a PNG missing its final chunk fails verification before forced panel replacement and retains the rejected bytes and usage', async () => {
    const { input, directory, stats } = await makeRequest({ force: true })
    const damaged = replacementPng.subarray(0, -12)
    input.requestImage = async () => ({
      mode: 'generate', result: { imageBase64: damaged.toString('base64'), mimeType: 'image/png' }, usage: { outputUnits: 1000 },
    })
    await mkdir(directory, { recursive: true })
    await Bun.write(input.outputPath, tinyPng)
    await expect(generateComicBaseImage(input)).rejects.toThrow(/panel 1 failed PNG verification.*\.rejected/)
    const files = await listAll(directory)
    const rejected = files.filter(path => path.endsWith('.rejected'))
    expect(rejected).toHaveLength(1)
    expect(files).toHaveLength(2)
    expect(await readBytes(join(directory, rejected[0]!))).toEqual(damaged)
    expect(await readBytes(input.outputPath)).toEqual(tinyPng)
    expect(stats).toMatchObject({ imagesGenerated: 1, totalOutputImageTokens: 1000 })
  })

  test('has no judge, comparison, repair or QA dependency in the base request or panel and page generators', async () => {
    const directory = join(PROJECT_ROOT, 'src', 'cli', 'commands', 'visuals', 'comic', 'comic-commands', 'generate-images')
    for (const file of ['comic-base-image-request.ts', 'generate-panel-images.ts', 'generate-comic-pages.ts', 'comic-panel-request-preparation.ts']) {
      const source = await Bun.file(join(directory, file)).text()
      expect(source).not.toMatch(/judge|comparison|repair|page-qa|continuity|revision|variation/i)
    }
  })
})

describe('panel generation forced replacement through the run directory', () => {
  test('dispatches one request per missing panel, ignores injected judge/comparison/repair hooks and preserves prior run bytes and the selection on --force', async () => {
    const sceneSlug = `base-force-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const provider = fakeImageProvider()
    const forbidden = { judgePage: 0, requestRepairComparison: 0, runRevisionEvaluation: 0 }
    const hooks = Object.fromEntries(Object.keys(forbidden).map(key => [key, async () => { forbidden[key as keyof typeof forbidden]++; throw new Error(`${key} must not run`) }]))
    const options: GeneratePanelImagesOptions = { model: 'gpt-image-2.6-flare', size: '1536x1024', quality: 'high', force: false, runId: 'run-a', concurrency: 1, panels: [1, 2] }
    await generatePanelImages(sceneSlug, options, { ...provider, ...hooks } as ComicImageGenerationDependencies)
    expect(provider.calls).toHaveLength(2)
    const candidate = join(runDirectory, 'panels', 'run-a', 'panel-01.png')
    const canonical = join(runDirectory, 'panels', 'panel-01.png')
    expect(await readBytes(canonical)).toEqual(tinyPng)

    await generatePanelImages(sceneSlug, options, provider)
    expect(provider.calls).toHaveLength(2)

    const replacing: ComicImageGenerationDependencies = {
      requestImage: async input => { provider.calls.push(input); return { mode: 'generate', result: { imageBase64: replacementPng.toString('base64') } } },
      writeImage: async (outputPath, imageBase64) => { await Bun.write(outputPath, Buffer.from(imageBase64, 'base64')) },
    }
    await generatePanelImages(sceneSlug, { ...options, force: true, panels: [1] }, replacing)
    expect(provider.calls).toHaveLength(3)
    expect(await readBytes(candidate)).toEqual(replacementPng)
    const superseded = await readdir(join(runDirectory, 'panels', 'run-a', 'superseded'))
    expect(superseded).toHaveLength(1)
    expect(await readBytes(join(runDirectory, 'panels', 'run-a', 'superseded', superseded[0]!))).toEqual(tinyPng)
    expect(await readBytes(canonical)).toEqual(tinyPng)

    await expect(generatePanelImages(sceneSlug, { ...options, force: true, panels: [1] }, {
      requestImage: async () => { throw new Error('provider unavailable') },
      writeImage: provider.writeImage,
    })).rejects.toThrow()
    expect(await readBytes(candidate)).toEqual(replacementPng)
    expect((await readdir(join(runDirectory, 'panels', 'run-a'))).filter(name => name.includes('.pending'))).toEqual([])
    expect(await readdir(join(runDirectory, 'panels', 'run-a', 'superseded'))).toHaveLength(1)
    expect(forbidden).toEqual({ judgePage: 0, requestRepairComparison: 0, runRevisionEvaluation: 0 })
  })
})

describe('decoded integrity before image completion and reuse', () => {
  const options = { model: 'gpt-image-2.6-flare', size: '1536x1024', quality: 'high', force: false, runId: 'run-a', concurrency: 1 } as const

  test('a truncated grouped-page response leaves the completed slot empty so a retry can publish a verified page', async () => {
    const sceneSlug = `page-integrity-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const damaged = tinyPng.subarray(0, -12)
    const pageOptions = { ...options, panels: [1, 2], panelsPerImage: 2 }
    let calls = 0
    const provider: ComicImageGenerationDependencies = {
      requestImage: async () => {
        calls++
        return { mode: 'generate', result: { imageBase64: (calls === 1 ? damaged : tinyPng).toString('base64'), mimeType: 'image/png' } }
      },
    }
    const directory = join(runDirectory, 'pages', options.runId)
    const pagePath = join(directory, 'page-01-panels-01-02.png')
    const storePath = join(runDirectory, 'metadata', 'panel-selections.json')
    const { events } = await captureLogEvents(async () => {
      await expect(generateComicPages(sceneSlug, pageOptions, provider)).rejects.toThrow('comic page generation task(s) failed')
    })
    expect(calls).toBe(1)
    expect(events.some(event => event.message.includes('page 1 failed PNG verification'))).toBe(true)
    expect(await Bun.file(pagePath).exists()).toBe(false)
    expect(await Bun.file(storePath).exists()).toBe(false)
    const rejected = await readdir(directory)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toEndWith('.rejected')
    expect(await readBytes(join(directory, rejected[0]!))).toEqual(damaged)

    expect(await generateComicPages(sceneSlug, pageOptions, provider)).toMatchObject({ imagesGenerated: 1, imagesSkipped: 0 })
    expect(calls).toBe(2)
    expect(await readBytes(pagePath)).toEqual(tinyPng)
    const store = await Bun.file(storePath).json()
    expect(store.runs[0].pages).toEqual([{ candidatePath: 'pages/run-a/page-01-panels-01-02.png', kind: 'provider-page', pageNumber: 1, panelNumbers: [1, 2] }])
    await Bun.write(pagePath, damaged)
    const reused = await captureLogEvents(async () => {
      await expect(generateComicPages(sceneSlug, pageOptions, provider)).rejects.toThrow('comic page generation task(s) failed')
    })
    expect(reused.events.some(event => event.message.includes('Cannot reuse page 1'))).toBe(true)
    expect(calls).toBe(2)
    expect(await readBytes(pagePath)).toEqual(damaged)
    expect(await Bun.file(storePath).json()).toEqual(store)
  })

  test('an unrecorded corrupt canonical panel blocks the entire batch before dispatch and a restored valid copy is reusable', async () => {
    const sceneSlug = `canonical-integrity-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const damaged = tinyPng.subarray(0, -12)
    const panelPath = join(runDirectory, 'panels', 'panel-02.png')
    const panelOptions = { ...options, panels: [1, 2] }
    const provider = fakeImageProvider()
    await mkdir(dirname(panelPath), { recursive: true })
    await Bun.write(panelPath, damaged)
    await expect(generatePanelImages(sceneSlug, panelOptions, provider)).rejects.toThrow(/Cannot reuse selected panel 2.*panel-02\.png\. Restore a valid PNG/)
    expect(provider.calls).toHaveLength(0)
    expect(await readBytes(panelPath)).toEqual(damaged)
    expect(await listAll(dirname(panelPath))).toEqual(['panel-02.png'])
    expect(await Bun.file(join(runDirectory, 'metadata', 'panel-selections.json')).exists()).toBe(false)

    await Bun.write(panelPath, tinyPng)
    expect(await generatePanelImages(sceneSlug, { ...panelOptions, panels: [2] }, provider)).toMatchObject({ imagesGenerated: 0, imagesSkipped: 1 })
    expect(provider.calls).toHaveLength(0)
  })

  test('a different valid PNG in a recorded selection slot is kept as an unrecorded selection: never bought, overwritten or re-recorded, and it does not block other panels', async () => {
    const sceneSlug = `canonical-checksum-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const provider = fakeImageProvider()
    await generatePanelImages(sceneSlug, { ...options, panels: [2] }, provider)
    const selectedPath = join(runDirectory, 'panels', 'panel-02.png')
    const storePath = join(runDirectory, 'metadata', 'panel-selections.json')
    const storeBefore = await Bun.file(storePath).json()
    await Bun.write(selectedPath, replacementPng)
    const { result, events } = await captureLogEvents(async () => await generatePanelImages(sceneSlug, { ...options, runId: 'run-b', panels: [1, 2] }, provider))
    expect(result).toMatchObject({ imagesGenerated: 1, imagesSkipped: 1 })
    expect(provider.calls).toHaveLength(2)
    expect(events.filter(event => event.message.includes('Selected panel 2 at panels/panel-02.png differs from its recorded selection'))).toHaveLength(1)
    expect(await readBytes(selectedPath)).toEqual(replacementPng)
    expect(await Bun.file(join(runDirectory, 'panels', 'run-b', 'panel-02.png')).exists()).toBe(false)
    expect(await Bun.file(join(runDirectory, 'panels', 'run-b', 'panel-01.png')).exists()).toBe(true)
    const storeAfter = await Bun.file(storePath).json()
    expect(storeAfter.selections.find((selection: { panelNumber: number }) => selection.panelNumber === 2)).toEqual(storeBefore.selections.find((selection: { panelNumber: number }) => selection.panelNumber === 2))
  })
})
