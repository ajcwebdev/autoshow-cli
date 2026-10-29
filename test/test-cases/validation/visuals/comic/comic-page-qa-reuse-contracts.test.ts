import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fingerprintPageQaInputs, judgePageWithBoundInputs, readReusablePageQaEntry, writePageQaReports } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa'
import { generateWithQaRepair } from '~/cli/commands/visuals/comic/comic-commands/generate-images/panel-qa-pipeline'
import type { GenerateWithQaRepairInput, PageQaEntry, PageQaRequest } from '~/types'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

const passingEntry = (request: PageQaRequest): PageQaEntry => ({
  pageNumber: request.pageNumber, panelNumbers: [1], outputFile: basename(request.pagePath), judgeModel: request.model, hardFailure: false,
  result: {
    panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] },
    panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' }],
    summary: 'Pass.',
  },
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
})

const fixture = async (): Promise<PageQaRequest> => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-qa-reuse-'))
  directories.push(directory)
  const paths = ['panel-01.png', 'hero.png', 'room.png', 'logo.png', 'rival.png'].map(name => join(directory, name))
  await Promise.all(paths.map((path, index) => Bun.write(path, `fixture-image-${index}`)))
  return {
    pageNumber: 1, pagePath: paths[0]!, model: 'gpt-6.1-sol', identityCards: [paths[1]!], locationSheets: [paths[2]!], designSheets: [paths[3]!],
    rosterCards: [{ key: 'rival', name: 'Rival', path: paths[4]! }],
    characterReferences: [{ key: 'hero', description: 'Blue uniform.', distinguishFrom: [{ characterKey: 'rival', cue: 'Hero has a red cap.' }] }],
    locationReferences: [{ key: 'room', specification: 'One wall-mounted console.' }], designReferences: [{ key: 'logo', usage: 'Visible on the cap.' }],
    panelData: { schemaVersion: 4, title: 'Current canon', location: 'Room', panels: [{ number: 1, characterKeys: ['hero'], locationKey: 'room', description: 'Hero waits by the console.', shotPlan: 'Eye-level medium shot.', speech: [], sourceSegmentIds: ['beat-1'], sourceSegments: [{ id: 'beat-1', type: 'direction', text: 'Hero waits.', sourceSpans: [], beatIndex: 1, location: { key: 'room', raw: 'Room' } }] }] },
  }
}

const cache = async (request: PageQaRequest): Promise<PageQaEntry> => {
  const entry = await judgePageWithBoundInputs(request, async input => passingEntry(input))
  await writePageQaReports(dirname(request.pagePath), [entry])
  return entry
}

const existingPanelInput = (request: PageQaRequest, judge: GenerateWithQaRepairInput['judge']): GenerateWithQaRepairInput => ({
  kind: 'panel', itemNumber: request.pageNumber, outputPath: request.pagePath, canonicalExists: true, outputExists: true, force: false,
  model: 'gpt-image-2.5-flare', promptForVariation: 'Draw the reviewed panel.', referenceImages: [...request.identityCards, ...request.locationSheets, ...request.designSheets!],
  bundleData: request.panelData, resolvedReferences: { primaryCharacterRefs: request.identityCards, secondaryRefs: request.locationSheets, designReferences: request.designSheets!.map(path => ({ ...request.designReferences![0]!, path })), characterReferences: request.characterReferences, locationReferences: request.locationReferences, rosterCharacterReferences: request.rosterCards },
  sceneSlug: 'current-canon', options: { models: ['gpt-image-2.5-flare'], size: '1536x1024', quality: 'high', runId: 'reuse-test', force: false, concurrency: 1 },
  requestImage: async () => { throw new Error('A passing existing panel needs no image generation.') },
  writeImage: async () => { throw new Error('A passing existing panel must remain unchanged.') },
  judge,
  qaEnabled: true, judgeModel: request.model, maxRepairs: 0, nextHostedIndex: () => 0,
})

describe('comic page QA input-bound reuse', () => {
  test('reuses only a verdict bound to the complete current request', async () => {
    const request = await fixture()
    const entry = await cache(request)
    expect(entry.inputSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(await readReusablePageQaEntry(request.pagePath, request.model, request)).toEqual(entry)
    expect(await readReusablePageQaEntry(request.pagePath, request.model)).toBeUndefined()
    expect(await readReusablePageQaEntry(request.pagePath, 'another-model', request)).toBeUndefined()
    expect(await readReusablePageQaEntry(request.pagePath, request.model, { ...request, model: 'another-model' })).toBeUndefined()
  })

  test('invalidates a saved pass when the canonical panel or any ordered reference bytes change', async () => {
    const request = await fixture()
    const original = await cache(request)
    for (const path of [request.pagePath, ...request.identityCards, ...request.locationSheets, ...request.designSheets!, request.rosterCards![0]!.path]) {
      const before = await Bun.file(path).text()
      await Bun.write(path, `${before}-replacement`)
      expect(await readReusablePageQaEntry(request.pagePath, request.model, request)).toBeUndefined()
      await Bun.write(path, before)
      expect((await readReusablePageQaEntry(request.pagePath, request.model, request))?.inputSha256).toBe(original.inputSha256)
    }
  })

  test('invalidates changed dialogue/staging, current identity cues, location specifications, design use, roster and hard-key policy', async () => {
    const request = await fixture()
    await cache(request)
    const changes: Array<(input: PageQaRequest) => void> = [
      input => { input.panelData.panels[0]!.description = 'Hero leaves.' },
      input => { input.characterReferences![0]!.description = 'Orange uniform.' },
      input => { input.characterReferences![0]!.distinguishFrom![0]!.cue = 'Hero has a green cap.' },
      input => { input.locationReferences![0]!.specification = 'Two freestanding consoles.' },
      input => { input.designReferences![0]!.usage = 'Visible on the wall.' },
      input => { input.rosterCards![0]!.name = 'A different character' },
      input => { input.blockingHardKeys = ['side-swapped'] },
      input => { input.characterCues = [{ characterKey: 'hero', distinguishFrom: [{ characterKey: 'rival', cue: 'Explicit cue override.' }] }] },
    ]
    for (const change of changes) {
      const changed = structuredClone(request)
      change(changed)
      expect(await readReusablePageQaEntry(request.pagePath, request.model, changed)).toBeUndefined()
    }
  })

  test('does not reuse legacy, malformed, or unavailable-input reports', async () => {
    const request = await fixture()
    await writePageQaReports(dirname(request.pagePath), [passingEntry(request)])
    expect(await readReusablePageQaEntry(request.pagePath, request.model, request)).toBeUndefined()
    await Bun.write(join(dirname(request.pagePath), 'page-qa-report.json'), '{broken')
    expect(await readReusablePageQaEntry(request.pagePath, request.model, request)).toBeUndefined()
    await cache(request)
    await rm(request.identityCards[0]!)
    expect(await readReusablePageQaEntry(request.pagePath, request.model, request)).toBeUndefined()
  })

  const malformedEntries: Array<{ name: string; corrupt: (entry: Record<string, any>) => void }> = [
    { name: 'missing hardFailure', corrupt: entry => { delete entry['hardFailure'] } },
    { name: 'non-boolean hardFailure', corrupt: entry => { entry['hardFailure'] = 'false' } },
    { name: 'missing result', corrupt: entry => { delete entry['result'] } },
    { name: 'missing usage', corrupt: entry => { delete entry['usage'] } },
    { name: 'invalid verdict boolean', corrupt: entry => { entry['result'].panels[0].requiredCastPresent = 'true' } },
    { name: 'invalid verdict classification', corrupt: entry => { entry['result'].panels[0].identityIssueKind = 'unknown' } },
    { name: 'missing required verdict field', corrupt: entry => { delete entry['result'].panels[0].dialogueAccuracy } },
    { name: 'invalid advisory score', corrupt: entry => { entry['result'].panels[0].visualQualityScore = 11 } },
    { name: 'invalid optional blocking audit', corrupt: entry => { entry['result'].panels[0].blockingAudit = [{ subject: 'hero', status: 'unknown', note: 'Invalid status.' }] } },
    { name: 'invalid optional repair assessment', corrupt: entry => { entry['result'].panels[0].repairAssessment = {} } },
    { name: 'non-numeric usage', corrupt: entry => { entry['usage'].inputTokens = '1' } },
    { name: 'negative usage', corrupt: entry => { entry['usage'].inputTokens = -1 } },
    { name: 'fractional token count', corrupt: entry => { entry['usage'].inputTokens = 0.5 } },
    { name: 'inconsistent usage total', corrupt: entry => { entry['usage'].totalTokens = 99 } },
    { name: 'invalid cost', corrupt: entry => { entry['usage'].costUsd = null } },
    { name: 'negative cost', corrupt: entry => { entry['usage'].costUsd = -1 } },
    { name: 'wrong page identity', corrupt: entry => { entry['pageNumber'] = 2 } },
    { name: 'wrong panel identity', corrupt: entry => { entry['panelNumbers'] = [2] } },
    { name: 'wrong verdict panel identity', corrupt: entry => { entry['result'].panels[0].panelNumber = 2 } },
    { name: 'pass summary contradicts verdict', corrupt: entry => { entry['result'].panels[0].requiredCastPresent = false } },
  ]

  for (const { name, corrupt } of malformedEntries) test(`rejects valid-JSON cached evidence with ${name} before skipping existing art`, async () => {
    const request = await fixture()
    const original = await cache(request)
    const malformed = structuredClone(original) as Record<string, any>
    corrupt(malformed)
    const reportPath = join(dirname(request.pagePath), 'page-qa-report.json')
    const report = await Bun.file(reportPath).json()
    report.pages = [malformed]
    await Bun.write(reportPath, JSON.stringify(report))
    expect(await readReusablePageQaEntry(request.pagePath, request.model, request)).toBeUndefined()
    let judgments = 0
    const result = await generateWithQaRepair(existingPanelInput(request, async current => { judgments++; return passingEntry(current) }))
    expect(judgments).toBe(1)
    expect(result.status).toBe('skipped')
    expect(result.qaEntry?.hardFailure).toBe(false)
    expect(result.qaEntry?.inputSha256).toBe(original.inputSha256)
  })

  test('preserves a valid cached failure and its complete verdict and usage', async () => {
    const request = await fixture()
    const entry = await cache(request)
    entry.hardFailure = true
    entry.result.panels[0]!.requiredCastPresent = false
    await writePageQaReports(dirname(request.pagePath), [entry])
    expect(await readReusablePageQaEntry(request.pagePath, request.model, request)).toEqual(entry)
  })

  test('refuses to bind a verdict when a reference changes during the judgment', async () => {
    const request = await fixture()
    await expect(judgePageWithBoundInputs(request, async input => {
      await Bun.write(input.identityCards[0]!, 'replacement during judgment')
      return passingEntry(input)
    })).rejects.toThrow('QA inputs changed during judgment')
  })

  test('canonical reference replacement triggers fresh QA before an existing panel can be skipped', async () => {
    const request = await fixture()
    await cache(request)
    let judgments = 0
    const input = existingPanelInput(request, async current => { judgments++; return passingEntry(current) })
    const unchanged = await generateWithQaRepair(input)
    expect(unchanged.status).toBe('skipped')
    expect(judgments).toBe(0)
    await Bun.write(request.identityCards[0]!, 'latest canonical character')
    const changed = await generateWithQaRepair(input)
    expect(changed.status).toBe('skipped')
    expect(judgments).toBe(1)
    expect(changed.qaEntry?.inputSha256).toBe(await fingerprintPageQaInputs(request))
  })
})
