import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'
const { tinyPng, sha, createSceneFixture, createMultiLocationFixture, fakeImageProvider } = setupPageContractFixtures()

const baseOptions = { model: 'gpt-image-2.6-flare', size: '1536x1024', quality: 'high', force: false, concurrency: 1 } as const

describe('canonical page reference assembly', () => {
  test('maps grouped and individual requests to distinct per-panel location references in deterministic order', async () => {
    const sceneSlug = `multi-location-${crypto.randomUUID()}`
    const { runDirectory, locationSheets } = await createMultiLocationFixture(sceneSlug)
    const provider = fakeImageProvider()
    await generateComicPages(sceneSlug, { ...baseOptions, runId: 'pages', panels: [1, 2], panelsPerImage: 2 }, provider)
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0]?.model).toBe('gpt-image-2.6-flare')
    expect(provider.calls[0]?.referenceImages.slice(-2)).toEqual(locationSheets)
    expect(provider.calls[0]?.normalizedPrompt).toContain('locationKey=quarters; use only for sub-panels 1')
    expect(provider.calls[0]?.normalizedPrompt).toContain('locationKey=hallway; use only for sub-panels 2')
    expect(provider.calls[0]?.normalizedPrompt).toContain('Canonical location specification: quarters')
    expect(provider.calls[0]?.normalizedPrompt).toContain('Canonical location specification: hallway')
    expect(await Bun.file(join(runDirectory, 'pages', 'pages', 'page-01-panels-01-02.png')).exists()).toBe(true)

    await generatePanelImages(sceneSlug, { ...baseOptions, runId: 'panels', panels: [2] }, provider)
    expect(provider.calls).toHaveLength(2)
    expect(provider.calls[1]?.referenceImages.at(-1)).toBe(locationSheets[1])
    expect(provider.calls[1]?.referenceImages).not.toContain(locationSheets[0])
    expect(provider.calls[1]?.normalizedPrompt).toContain('Canonical location: hallway (Reference 2).')
  })

  test('uses each canonical character image once followed by the current canonical location image for a grouped page', async () => {
    const sceneSlug = `location-contract-${crypto.randomUUID()}`
    const { runDirectory, locationSheet } = await createSceneFixture(sceneSlug)
    const provider = fakeImageProvider()
    const stats = await generateComicPages(sceneSlug, { ...baseOptions, runId: 'test-run', concurrency: 2, panels: [1, 2], panelsPerImage: 2 }, provider)
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0]?.referenceImages).toEqual([join(runDirectory, 'input', 'characters', 'hero.png'), locationSheet])
    expect(provider.calls[0]?.normalizedPrompt).toContain('Exhaustive prose shot plan: Medium eye-level shot 1')
    expect(provider.calls[0]?.normalizedPrompt).toContain('Exhaustive prose shot plan: Medium eye-level shot 2')
    expect(provider.calls[0]?.normalizedPrompt).toContain('A loading door stays left of a fixed control booth; camera angles and crops may vary.')
    expect(stats.imagesGenerated).toBe(1)
    expect(await readdir(join(runDirectory, 'pages', 'test-run'))).toEqual(['page-01-panels-01-02.png'])
  })

  test('individual panels write run candidates at panels/<run-id>/panel-NN.png and fill empty canonical slots with decodable bytes (transport fake, decoded integrity checked)', async () => {
    const sceneSlug = `panel-paths-${crypto.randomUUID()}`
    const { runDirectory, locationSheet } = await createSceneFixture(sceneSlug)
    const provider = fakeImageProvider()
    const stats = await generatePanelImages(sceneSlug, { ...baseOptions, runId: 'run-a', panels: [1, 2] }, provider)
    expect(provider.calls).toHaveLength(2)
    expect(stats.imagesGenerated).toBe(2)
    for (const call of provider.calls) {
      expect(call.referenceImages).toEqual([join(runDirectory, 'input', 'characters', 'hero.png'), locationSheet])
      expect(call.referenceImages.some(path => /guide|ledger|roster|blocking|environment-anchor/.test(path))).toBe(false)
    }
    expect((await readdir(join(runDirectory, 'panels', 'run-a'))).sort()).toEqual(['panel-01.png', 'panel-02.png'])
    for (const panel of ['panel-01.png', 'panel-02.png']) {
      const canonical = new Uint8Array(await Bun.file(join(runDirectory, 'panels', panel)).arrayBuffer())
      expect(new Bun.CryptoHasher('sha256').update(canonical).digest('hex')).toBe(sha)
      expect(Buffer.from(canonical)).toEqual(tinyPng)
    }
    expect(await Bun.file(join(runDirectory, 'panels', 'gpt-image-2.6-flare')).exists()).toBe(false)
  })
})
