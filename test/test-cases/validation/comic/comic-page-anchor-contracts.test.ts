import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { generateComicPages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-panel-images'
import {
  advancePageQaRepairStagnation,
  applyPageQaRepairPolicy,
  applyPageQaTolerancePolicy,
  buildComicPageQaPrompt,
  createPageQaRepairStagnationState,
  hasHardPageQaFailure,
  parseComicPageQaResult,
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-qa'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import type { ComicImageRequestInput, PanelBundleData } from '~/types'
import type { PageQaEntry } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-qa'

const temporaryDirectories: string[] = []
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const sha = createHash('sha256').update(tinyPng).digest('hex')

const panelBundle = (panelNumber: number): PanelBundleData => ({
  schemaVersion: 3, snapshotId: 'character-snapshot', locationSnapshotId: 'location-snapshot',
  title: 'Location Contract', location: 'Cargo Bay', panels: [{
    number: panelNumber, description: `Authored staging ${panelNumber}.`,
    shotPlan: `Medium eye-level shot ${panelNumber}; hero is screen left, facing right; exclude all unlisted cast.`,
    characterKeys: ['hero'], speech: [], sourceSegmentIds: [`beat-${panelNumber}`],
    sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Authored staging ${panelNumber}.`, beatIndex: panelNumber }],
  }],
})

const createSceneFixture = async (sceneSlug: string): Promise<{ runDirectory: string; locationSheet: string }> => {
  const runDirectory = await mkdtemp(join(tmpdir(), 'autoshow-comic-location-'))
  temporaryDirectories.push(runDirectory)
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  const characterRoot = join(runDirectory, 'character-references', 'character-snapshot', 'hero')
  await mkdir(characterRoot, { recursive: true })
  await Bun.write(join(characterRoot, 'reference.png'), tinyPng)
  await Bun.write(join(runDirectory, 'character-references.json'), JSON.stringify({ schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt: '2026-01-01T00:00:00.000Z', characters: [{ key: 'hero', name: 'Hero', description: 'Test hero', sourceSketchVersion: 'v1', assets: [{ role: 'sketch-sheet', path: 'character-references/character-snapshot/hero/reference.png', sha256: sha }, { role: 'source-image', path: 'character-references/character-snapshot/hero/reference.png', sha256: sha }] }] }))
  const locationSheet = join(runDirectory, 'location-references', 'location-snapshot', 'cargo-bay.png')
  await mkdir(dirname(locationSheet), { recursive: true })
  await Bun.write(locationSheet, tinyPng)
  await Bun.write(join(runDirectory, 'location-reference.json'), JSON.stringify({ schemaVersion: 1, snapshotId: 'location-snapshot', locationKey: 'cargo-bay', specification: 'A loading door stays left of a fixed control booth; camera angles and crops may vary.', sourceScripts: ['episode-scripts/02-script/01.md'], sourceGenerationId: 'v1', sheet: { path: 'location-references/location-snapshot/cargo-bay.png', sha256: sha } }))
  for (const panelNumber of [1, 2]) {
    const directory = join(runDirectory, 'panel-prompts', `panel-${String(panelNumber).padStart(2, '0')}`)
    await mkdir(directory, { recursive: true })
    await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panelNumber), null, 2)}\n\`\`\`\n`)
  }
  return { runDirectory, locationSheet }
}

const createMultiLocationFixture = async (sceneSlug: string): Promise<{ runDirectory: string; locationSheets: string[] }> => {
  const runDirectory = await mkdtemp(join(tmpdir(), 'autoshow-comic-multi-location-'))
  temporaryDirectories.push(runDirectory)
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  const characterRoot = join(runDirectory, 'character-references', 'character-snapshot', 'hero')
  await mkdir(characterRoot, { recursive: true })
  await Bun.write(join(characterRoot, 'reference.png'), tinyPng)
  await Bun.write(join(runDirectory, 'character-references.json'), JSON.stringify({ schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt: '2026-01-01T00:00:00.000Z', characters: [{ key: 'hero', name: 'Hero', description: 'Test hero', sourceSketchVersion: 'v1', assets: [{ role: 'sketch-sheet', path: 'character-references/character-snapshot/hero/reference.png', sha256: sha }, { role: 'source-image', path: 'character-references/character-snapshot/hero/reference.png', sha256: sha }] }] }))
  const locations = [
    { key: 'quarters', snapshotId: 'location-quarters' },
    { key: 'hallway', snapshotId: 'location-hallway' },
  ]
  const locationSheets: string[] = []
  const snapshots = []
  for (const location of locations) {
    const path = join(runDirectory, 'location-references', location.snapshotId, `${location.key}.png`)
    await mkdir(dirname(path), { recursive: true })
    await Bun.write(path, tinyPng)
    locationSheets.push(path)
    snapshots.push({ schemaVersion: 1, snapshotId: location.snapshotId, locationKey: location.key, specification: location.key, sourceScripts: [], sourceGenerationId: 'v1', sheet: { path: `location-references/${location.snapshotId}/${location.key}.png`, sha256: sha } })
  }
  await Bun.write(join(runDirectory, 'location-references.json'), JSON.stringify({ schemaVersion: 2, snapshots }))
  for (const [index, location] of locations.entries()) {
    const panelNumber = index + 1
    const directory = join(runDirectory, 'panel-prompts', `panel-0${panelNumber}`)
    await mkdir(directory, { recursive: true })
    const locationData = { key: location.key, raw: location.key }
    const bundle: PanelBundleData = {
      schemaVersion: 4,
      snapshotId: 'character-snapshot',
      title: 'Two locations',
      location: 'quarters then hallway',
      panels: [{
        number: panelNumber,
        description: `Panel ${panelNumber}.`,
        shotPlan: `Panel ${panelNumber} shot.`,
        characterKeys: ['hero'],
        speech: [],
        sourceSegmentIds: [`beat-${panelNumber}`],
        sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Panel ${panelNumber}.`, beatIndex: panelNumber, location: locationData }],
        locationKey: location.key,
        locationSnapshotId: location.snapshotId,
      }],
    }
    await Bun.write(join(directory, 'prompt.md'), `\`\`\`json\n${JSON.stringify(bundle)}\n\`\`\``)
  }
  return { runDirectory, locationSheets }
}

afterEach(async () => {
  resetSceneRunContext()
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('canonical location references and grouped QA repairs', () => {
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
        return { pageNumber: 1, panelNumbers: [1, 2], outputFile: 'page.png', judgeModel: request.model, hardFailure: false, result: { panelStructure: { pass: true, observedPanelCount: 2, observedPanelOrder: [1, 2], issues: [] }, panels: [1, 2].map(panelNumber => ({ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, locationMatch: true, sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' })), summary: 'Pass.' }, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 } }
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
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'environment-anchor.png')).exists()).toBe(false)
    expect(stats.imagesGenerated).toBe(1)
  })

  test('edits the failed exact image, preserves attempts, and promotes only a passing repair', async () => {
    const sceneSlug = `page-repair-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    let judges = 0
    const judgePage = async (): Promise<PageQaEntry> => {
      judges++
      const failed = judges === 1
      return { pageNumber: 1, panelNumbers: [1, 2], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: failed, result: { panelStructure: { pass: true, observedPanelCount: 2, observedPanelOrder: [1, 2], issues: [] }, panels: [1, 2].map(panelNumber => ({ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, locationMatch: true, sourcePrecedence: true, shotPlanMatch: !failed, dialogueAccuracy: true, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: failed ? ['framing'] : [], editInstructions: failed ? 'Correct the framing.' : '' })), summary: failed ? 'Repair framing.' : 'Pass.' }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    }
    await generateComicPages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], panelsPerImage: 2, qa: true, maxRepairs: 2 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) }, judgePage,
    })
    const output = join(runDirectory, 'pages', 'test-run', 'page-01-panels-01-02.png')
    expect(calls).toHaveLength(2)
    expect(calls[1]?.referenceImages[0]).toContain('attempt-0.png')
    expect(calls[1]?.referenceImages.at(-1)).toContain('cargo-bay.png')
    expect(await Bun.file(output).exists()).toBe(true)
    expect(await Bun.file(join(dirname(output), 'attempts', 'page-01', 'attempt-0.png')).exists()).toBe(true)
    expect(await Bun.file(join(dirname(output), 'attempts', 'page-01', 'attempt-1-qa.json')).exists()).toBe(true)
  })

  test('applies the same bounded promotion loop to default individual panels', async () => {
    const sceneSlug = `panel-repair-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    let judges = 0
    const judgePage = async (): Promise<PageQaEntry> => {
      judges++
      const failed = judges === 1
      return { pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: failed, result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, locationMatch: true, sourcePrecedence: true, shotPlanMatch: !failed, dialogueAccuracy: true, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: failed ? ['angle'] : [], editInstructions: failed ? 'Use the specified angle.' : '' }], summary: failed ? 'Repair.' : 'Pass.' }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    }
    await generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 2 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) }, judgePage,
    })
    const output = join(runDirectory, 'panels', 'test-run', 'panel-01.png')
    expect(calls).toHaveLength(2)
    expect(calls[1]?.model).toBe('gpt-image-2')
    expect(calls[1]?.referenceImages[0]).toContain('attempt-0.png')
    expect(await Bun.file(output).exists()).toBe(true)
  })

  test('waives a persistent individual-panel shot-plan mismatch after one edit', async () => {
    const sceneSlug = `panel-shot-plan-waiver-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const judgePage = async (): Promise<PageQaEntry> => ({
      pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, locationMatch: true, sourcePrecedence: true, shotPlanMatch: false, dialogueAccuracy: true, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 7, issues: ['depth staging'], editInstructions: 'Move the hero deeper.' }], summary: 'Shot-plan staging remains unresolved.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 4 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) }, judgePage,
    })
    const output = join(runDirectory, 'panels', 'test-run', 'panel-01.png')
    const repairedQa = JSON.parse(await Bun.file(join(dirname(output), 'attempts', 'panel-01', 'attempt-1-qa.json')).text()) as PageQaEntry
    expect(calls).toHaveLength(2)
    expect(repairedQa.result.panels[0]?.shotPlanMatch).toBe(false)
    expect(repairedQa.hardFailure).toBe(false)
    expect(repairedQa.waivedChecks).toEqual([{ panelNumber: 1, check: 'shotPlanMatch', reason: 'Shot-plan framing/staging remained unresolved after one image edit and is advisory from this attempt onward.' }])
    expect(await Bun.file(output).exists()).toBe(true)
  })

  test('applies the one-edit shot-plan waiver to grouped pages', async () => {
    const sceneSlug = `page-shot-plan-waiver-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const judgePage = async (): Promise<PageQaEntry> => ({
      pageNumber: 1, panelNumbers: [1, 2], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 2, observedPanelOrder: [1, 2], issues: [] }, panels: [1, 2].map(panelNumber => ({ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, locationMatch: true, sourcePrecedence: true, shotPlanMatch: false, dialogueAccuracy: true, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 7, issues: ['framing'], editInstructions: 'Correct framing.' })), summary: 'Grouped framing remains unresolved.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await generateComicPages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], panelsPerImage: 2, qa: true, maxRepairs: 4 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) }, judgePage,
    })
    const output = join(runDirectory, 'pages', 'test-run', 'page-01-panels-01-02.png')
    const repairedQa = JSON.parse(await Bun.file(join(dirname(output), 'attempts', 'page-01', 'attempt-1-qa.json')).text()) as PageQaEntry
    expect(calls).toHaveLength(2)
    expect(repairedQa.hardFailure).toBe(false)
    expect(repairedQa.waivedChecks?.map(check => check.panelNumber)).toEqual([1, 2])
    expect(await Bun.file(output).exists()).toBe(true)
  })

  test('never waives strict identity failures', () => {
    const entry: PageQaEntry = {
      pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: false, locationMatch: true, sourcePrecedence: true, shotPlanMatch: false, dialogueAccuracy: true, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 7, issues: ['identity and framing'], editInstructions: 'Fix identity and framing.' }], summary: 'Strict identity failure.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    }
    const repaired = applyPageQaRepairPolicy(entry, 1)
    expect(repaired.hardFailure).toBe(true)
    expect(repaired.waivedChecks?.map(check => check.check)).toEqual(['shotPlanMatch'])
  })

  test('treats harmless typography substitutions and minor recognizable identity variance as advisory', () => {
    const prompt = buildComicPageQaPrompt(panelBundle(1), [{ key: 'hero', description: 'A free-standing hologram above a projector base.' }], [{ key: 'cargo-bay', specification: 'The loading door remains left of the control booth.' }])
    expect(prompt).toContain('Unicode ellipsis (…) and three consecutive periods (...)')
    expect(prompt).toContain('Never fail dialogueAccuracy for a harmless typography-only substitution.')
    expect(prompt).toContain('Minor body-width or proportion variance')
    expect(prompt).toContain('Set identityMatch=false only for an unmistakably wrong person')
    expect(prompt).toContain('highest visual precedence for identity, physical embodiment, projection/display medium')
    expect(prompt).toContain('violates this canon is a hard identity failure')
    expect(prompt).toContain('hero: A free-standing hologram above a projector base.')
    expect(prompt).toContain('cargo-bay: The loading door remains left of the control booth.')
    expect(prompt).toContain('A different camera side, angle, distance, elevation, perspective, character blocking, or crop is desirable shot variation')
    expect(prompt).toContain('Perform a mandatory anchor-by-anchor continuity audit')
    expect(prompt).toContain('Use physically-occluded only when a visible foreground object geometrically covers the anchor\'s entire expected silhouette')
    expect(prompt).toContain('If any part of the anchor\'s support surface, wall zone, footprint, or expected silhouette is exposed')
    expect(prompt).toContain('explicitly compare footprint, silhouette, connectedness, orientation, visible edge geometry, and wall relationships')
    expect(prompt).toContain('may not turn a straight run into a corner, L-shaped, wraparound, split, or freestanding form')
    expect(prompt).toContain('A wide or otherwise revealing view that shows an anchor\'s canonical region but omits the anchor is a hard failure')
    const tolerantResult = applyPageQaTolerancePolicy({
      panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] },
      panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: false, identityIssueKind: 'minor-variance', locationMatch: true, sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: false, dialogueIssueKind: 'typography-only', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['minor proportions', 'ellipsis glyph'], editInstructions: '' }],
      summary: 'Advisory differences only.',
    })
    expect(tolerantResult.panels[0]?.identityMatch).toBe(true)
    expect(tolerantResult.panels[0]?.dialogueAccuracy).toBe(true)
    expect(hasHardPageQaFailure(tolerantResult)).toBe(false)
    const strictResult = applyPageQaTolerancePolicy({
      panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] },
      panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'unmistakable-mismatch', locationMatch: true, sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, dialogueIssueKind: 'content', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['wrong person', 'missing words'], editInstructions: 'Restore the character and dialogue.' }],
      summary: 'Material failures.',
    })
    expect(strictResult.panels[0]?.identityMatch).toBe(false)
    expect(strictResult.panels[0]?.dialogueAccuracy).toBe(false)
    expect(hasHardPageQaFailure(strictResult)).toBe(true)
  })

  test('keeps set continuity strict without treating camera variation as a failure', () => {
    const setDrift = {
      panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] },
      panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, locationMatch: true, setContinuityMatch: false, setContinuityAudit: [{ anchor: 'fixed control booth', status: 'relocated' as const, evidence: 'It appears on the opposite side of the loading door.' }], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['The fixed control booth moved to the other side of the loading door.'], editInstructions: 'Restore the canonical world-space relationship while retaining this camera angle.' }],
      summary: 'The location identity is recognizable, but its permanent topology drifted.',
    }
    expect(hasHardPageQaFailure(setDrift)).toBe(true)
    const entry: PageQaEntry = { pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true, result: setDrift, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    expect(applyPageQaRepairPolicy(entry, 1).hardFailure).toBe(true)
    expect(advancePageQaRepairStagnation(createPageQaRepairStagnationState(), entry).state.consecutiveFailures).toEqual({ 'panel-1:setContinuityMatch': 1 })

    const variedCamera = { ...setDrift, panels: [{ ...setDrift.panels[0]!, setContinuityMatch: true, setContinuityAudit: [{ anchor: 'fixed control booth', status: 'outside-crop' as const, evidence: 'The entire booth wall is beyond the right frame edge.' }], issues: [], editInstructions: '' }], summary: 'A different crop preserves the canonical set topology.' }
    expect(hasHardPageQaFailure(variedCamera)).toBe(false)

    const inconsistentAudit = { ...variedCamera, panels: [{ ...variedCamera.panels[0]!, setContinuityAudit: [{ anchor: 'fixed control booth', status: 'missing' as const, evidence: 'Its wall zone is visible and empty.' }] }] }
    expect(hasHardPageQaFailure(inconsistentAudit)).toBe(true)

    const strictPayload = { ...setDrift, panels: [{ ...setDrift.panels[0]!, identityIssueKind: 'none' as const, dialogueIssueKind: 'none' as const }] }
    expect(parseComicPageQaResult(JSON.stringify(strictPayload), [1]).panels[0]?.setContinuityMatch).toBe(false)
    const { setContinuityMatch: _omitted, ...missingContinuityField } = strictPayload.panels[0]!
    expect(() => parseComicPageQaResult(JSON.stringify({ ...strictPayload, panels: [missingContinuityField] }), [1])).toThrow('missing or unexpected fields')
    const { setContinuityAudit: _auditOmitted, ...missingAuditField } = strictPayload.panels[0]!
    expect(() => parseComicPageQaResult(JSON.stringify({ ...strictPayload, panels: [missingAuditField] }), [1])).toThrow('missing or unexpected fields')
  })

  test('restarts once and then stops when the same hard check keeps stagnating', () => {
    const failedEntry: PageQaEntry = {
      pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, locationMatch: true, sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: false, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['typography'], editInstructions: 'Correct dialogue.' }], summary: 'Dialogue mismatch.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    }
    let state = createPageQaRepairStagnationState()
    const first = advancePageQaRepairStagnation(state, failedEntry)
    expect(first.action).toBe('edit')
    state = first.state
    const second = advancePageQaRepairStagnation(state, failedEntry)
    expect(second.action).toBe('restart')
    expect(second.repeatedHardFailures).toEqual(['panel-1:dialogueAccuracy'])
    state = second.state
    const afterRestart = advancePageQaRepairStagnation(state, failedEntry)
    expect(afterRestart.action).toBe('edit')
    state = afterRestart.state
    const stopped = advancePageQaRepairStagnation(state, failedEntry)
    expect(stopped.action).toBe('stop')
    expect(stopped.repeatedHardFailures).toEqual(['panel-1:dialogueAccuracy'])
  })

  test('restarts a stagnated panel from canonical references and stops a second stagnant cycle', async () => {
    const sceneSlug = `panel-stagnation-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const failedEntry = (): PageQaEntry => ({
      pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, locationMatch: true, sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: false, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['wording'], editInstructions: 'Correct the wording.' }], summary: 'Persistent dialogue mismatch.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await expect(generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 7 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 || calls.length === 3 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) },
      judgePage: async () => failedEntry(),
    })).rejects.toThrow('1 image generation task(s) failed')
    expect(calls).toHaveLength(4)
    expect(calls[1]?.referenceImages[0]).toContain('attempt-0.png')
    expect(calls[2]?.referenceImages).toHaveLength(2)
    expect(calls[2]?.referenceImages.some(path => path.includes('/attempts/'))).toBe(false)
    expect(calls[2]?.normalizedPrompt).toContain('Generate a completely new image from the canonical references')
    expect(calls[3]?.referenceImages[0]).toContain('attempt-2.png')
    const attempts = join(runDirectory, 'panels', 'test-run', 'attempts', 'panel-01')
    const restartQa = JSON.parse(await Bun.file(join(attempts, 'attempt-1-qa.json')).text()) as PageQaEntry
    const stopQa = JSON.parse(await Bun.file(join(attempts, 'attempt-3-qa.json')).text()) as PageQaEntry
    expect(restartQa.repairPolicy).toEqual({ action: 'restart', repeatedHardFailures: ['panel-1:dialogueAccuracy'] })
    expect(stopQa.repairPolicy).toEqual({ action: 'stop', repeatedHardFailures: ['panel-1:dialogueAccuracy'] })
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'panel-01.png')).exists()).toBe(false)
  })

  test('applies the same canonical-reference restart policy to grouped pages', async () => {
    const sceneSlug = `page-stagnation-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const failedEntry = (): PageQaEntry => ({
      pageNumber: 1, panelNumbers: [1, 2], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 2, observedPanelOrder: [1, 2], issues: [] }, panels: [1, 2].map(panelNumber => ({ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, locationMatch: true, sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: panelNumber !== 1, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: panelNumber === 1 ? ['wording'] : [], editInstructions: panelNumber === 1 ? 'Correct the wording.' : '' })), summary: 'Persistent grouped dialogue mismatch.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await expect(generateComicPages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], panelsPerImage: 2, qa: true, maxRepairs: 7 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 || calls.length === 3 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) },
      judgePage: async () => failedEntry(),
    })).rejects.toThrow()
    expect(calls).toHaveLength(4)
    expect(calls[1]?.referenceImages[0]).toContain('attempt-0.png')
    expect(calls[2]?.referenceImages).toHaveLength(2)
    expect(calls[2]?.referenceImages.some(path => path.includes('/attempts/'))).toBe(false)
    expect(calls[2]?.normalizedPrompt).toContain('Generate a completely new image from the canonical references')
    expect(calls[3]?.referenceImages[0]).toContain('attempt-2.png')
    const attempts = join(runDirectory, 'pages', 'test-run', 'attempts', 'page-01')
    const restartQa = JSON.parse(await Bun.file(join(attempts, 'attempt-1-qa.json')).text()) as PageQaEntry
    const stopQa = JSON.parse(await Bun.file(join(attempts, 'attempt-3-qa.json')).text()) as PageQaEntry
    expect(restartQa.repairPolicy).toEqual({ action: 'restart', repeatedHardFailures: ['panel-1:dialogueAccuracy'] })
    expect(stopQa.repairPolicy).toEqual({ action: 'stop', repeatedHardFailures: ['panel-1:dialogueAccuracy'] })
    expect(await Bun.file(join(runDirectory, 'pages', 'test-run', 'page-01-panels-01-02.png')).exists()).toBe(false)
  })
})
