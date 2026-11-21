import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'
const { createSceneFixture, fakeImageProvider } = setupPageContractFixtures()

const baseOptions = { model: 'gpt-image-2.6-flare', size: '1536x1024', quality: 'high', force: false, concurrency: 1 } as const
const RETIRED_VARIATION_PREFIXES = [
  'Render as clean production animation stills with stable volumes and readable silhouettes.',
  'Add cinematic depth with layered foreground and background while preserving the comic contract.',
]

const expectAnchorContract = (prompt: string | undefined): void => {
  expect(prompt).toContain('immutable canonical location reference')
  expect(prompt).toContain('Preserve canonical anchor assemblies component by component.')
  expect(prompt).toContain('Loose tools, generic clutter, speakers, lamps, or other plausible props never substitute for a named computer, keyboard')
  expect(prompt).toContain('Occlusion is not an allowed continuity outcome')
  expect(prompt).toContain('move its entire canonical region outside the crop instead of hiding it')
}

describe('canonical location anchor prompt contract', () => {
  test('an individual panel dispatches the base prompt with its prose shot plan, anchor guidance and no guide, ledger or variation prefix', async () => {
    const sceneSlug = `anchor-panel-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const provider = fakeImageProvider()
    await generatePanelImages(sceneSlug, { ...baseOptions, runId: 'run-a', panels: [1] }, provider)
    expect(provider.calls).toHaveLength(1)
    const prompt = provider.calls[0]?.normalizedPrompt
    expect(prompt?.startsWith('Create one final comic page image from the ordered panel data below.')).toBe(true)
    expect(prompt).toContain('Exhaustive prose shot plan: Medium eye-level shot 1; hero is screen left, facing right; exclude all unlisted cast.')
    expect(prompt).toContain('This is a trailing single-panel page.')
    expectAnchorContract(prompt)
    for (const retired of [...RETIRED_VARIATION_PREFIXES, 'Blocking ledger', 'blocking layout', 'Off-frame exclusion', 'roster']) {
      expect(prompt).not.toContain(retired)
    }
    expect(provider.calls[0]?.referenceImages).toHaveLength(2)
    expect(await readdir(join(runDirectory, 'panels', 'run-a'))).toEqual(['panel-01.png'])
  })

  test('a grouped page carries the same anchor guidance for every sub-panel without an environment-anchor artifact', async () => {
    const sceneSlug = `anchor-page-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const provider = fakeImageProvider()
    await generateComicPages(sceneSlug, { ...baseOptions, runId: 'run-a', panels: [1, 2], panelsPerImage: 2 }, provider)
    expect(provider.calls).toHaveLength(1)
    const prompt = provider.calls[0]?.normalizedPrompt
    expectAnchorContract(prompt)
    expect(prompt).toContain('Use a strict left-to-right two-panel layout')
    for (const retired of RETIRED_VARIATION_PREFIXES) expect(prompt).not.toContain(retired)
    expect(await Bun.file(join(runDirectory, 'panels', 'run-a', 'environment-anchor.png')).exists()).toBe(false)
    expect(await Bun.file(join(runDirectory, 'pages', 'run-a', 'environment-anchor.png')).exists()).toBe(false)
  })
})
