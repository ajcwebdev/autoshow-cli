import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import type { ComicImageRequestInput } from '~/types'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'
const { tinyPng, createSceneFixture, createMultiLocationFixture } = setupPageContractFixtures()

describe('canonical page reference assembly', () => {
  test('maps grouped and individual requests to distinct per-panel location references in deterministic order', async () => {
    const sceneSlug = `multi-location-${crypto.randomUUID()}`
    const { locationSheets } = await createMultiLocationFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const qaRequests: Array<{ locationSheets: string[]; locationSpecifications: string[] }> = []
    await generateComicPages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'pages', concurrency: 1, panels: [1, 2], panelsPerImage: 2, qa: true, maxRepairs: 0 }, {
      requestImage: async input => { calls.push(input); return { mode: 'generate', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) },
      judgePage: async request => {
        qaRequests.push({ locationSheets: request.locationSheets, locationSpecifications: request.locationReferences?.map(reference => reference.specification) ?? [] })
        return { pageNumber: 1, panelNumbers: [1, 2], outputFile: 'page.png', judgeModel: request.model, hardFailure: false, result: { panelStructure: { pass: true, observedPanelCount: 2, observedPanelOrder: [1, 2], issues: [] }, panels: [1, 2].map(panelNumber => ({ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' })), summary: 'Pass.' }, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 } }
      },
    })
    expect(calls[0]?.referenceImages.slice(-2)).toEqual(locationSheets)
    expect(calls[0]?.normalizedPrompt).toContain('locationKey=quarters; use only for sub-panels 1')
    expect(calls[0]?.normalizedPrompt).toContain('locationKey=hallway; use only for sub-panels 2')
    expect(calls[0]?.normalizedPrompt).toContain('Canonical location specification: quarters')
    expect(calls[0]?.normalizedPrompt).toContain('Canonical location specification: hallway')
    expect(qaRequests[0]?.locationSheets).toEqual(locationSheets)
    expect(qaRequests[0]?.locationSpecifications).toEqual(['quarters', 'hallway'])

    await generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'panels', concurrency: 1, panels: [2], qa: false }, {
      requestImage: async input => { calls.push(input); return { mode: 'generate', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) },
    })
    expect(calls[1]?.referenceImages.at(-1)).toBe(locationSheets[1])
    expect(calls[1]?.referenceImages).not.toContain(locationSheets[0])
  })

  test('uses each canonical character image once followed by the immutable scene location image', async () => {
    const sceneSlug = `location-contract-${crypto.randomUUID()}`
    const { runDirectory, locationSheet } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const stats = await generateComicPages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 2, panels: [1, 2], panelsPerImage: 2, qa: false }, {
      requestImage: async input => { calls.push(input); return { mode: 'generate', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.referenceImages.at(-1)).toBe(locationSheet)
    expect(calls[0]?.referenceImages[0]).toEndWith('hero/reference.png')
    expect(calls[0]?.referenceImages).toHaveLength(2)
    expect(calls[0]?.normalizedPrompt).toContain('Exhaustive prose shot plan')
    expect(calls[0]?.normalizedPrompt).toContain('immutable canonical location reference')
    expect(calls[0]?.normalizedPrompt).toContain('A loading door stays left of a fixed control booth; camera angles and crops may vary.')
    expect(calls[0]?.normalizedPrompt).toContain('Preserve canonical anchor assemblies component by component.')
    expect(calls[0]?.normalizedPrompt).toContain('Loose tools, generic clutter, speakers, lamps, or other plausible props never substitute for a named computer, keyboard')
    expect(calls[0]?.normalizedPrompt).toContain('Occlusion is not an allowed continuity outcome')
    expect(calls[0]?.normalizedPrompt).toContain('move its entire canonical region outside the crop instead of hiding it')
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'environment-anchor.png')).exists()).toBe(false)
    expect(stats.imagesGenerated).toBe(1)
  })
})
