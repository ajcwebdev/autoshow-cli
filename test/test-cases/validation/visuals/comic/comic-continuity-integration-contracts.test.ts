import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { PAGE_QA_REPORT_SCHEMA_VERSION } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa'
import {
  buildContinuityJudgeEntry,
  planContinuityJudgeImages
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/continuity-qa'
import { runQaOnlyPanelAudit } from '~/cli/commands/visuals/comic/comic-commands/generate-images/qa-only-panel-audit'
import {
  attachContinuityToPageQaEntry,
  isPageQaEntryReusableWithContinuity,
  readReusablePageQaEntryForAudit
} from '~/cli/commands/visuals/comic/comic-utils/continuity-audit-report'
import type { ContinuityJudgeRequest, PageQaEntry } from '~/types'
import { setupContinuityContractFixtures, type FixturePanel } from './comic-continuity-contract-fixtures'
const { tinyPng, JUDGE_MODEL, createSceneFixture, continuityResult, entryFor, pageQaEntry, labelsFile, verdicts } = setupContinuityContractFixtures()


describe('QA-only continuity integration', () => {
  const fixturePanels: FixturePanel[] = [
    { number: 1, characterKeys: ['hero', 'rival'] },
    { number: 2, characterKeys: ['hero'] },
    { number: 3, characterKeys: ['rival', 'hero'] },
  ]

  test('runs the continuity judge alone, never touches the page judge or the canonical bytes, and writes every artifact', async () => {
    const sceneSlug = `continuity-only-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, fixturePanels)
    const before = Buffer.from(await Bun.file(join(runDirectory, 'panels', 'panel-02.png')).arrayBuffer())
    const requests: ContinuityJudgeRequest[] = []
    const result = await runQaOnlyPanelAudit({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, panels: [2, 3], concurrency: 1, continuityQa: true, continuityOnly: true }, {
      runId: 'test-continuity',
      judgePage: async () => { throw new Error('the page judge must be skipped under --continuity-only') },
      judgeContinuity: async request => {
        requests.push(request)
        const intruding = request.panelNumber === 2
        return buildContinuityJudgeEntry(request, continuityResult({ panelNumber: request.panelNumber, anchorPanel: request.anchorPanel, predecessorPanel: request.predecessorPanel, blooperCategory: intruding ? 'intruder' : 'none', castAudit: intruding ? [{ characterKey: 'rival', status: 'intruding', note: 'Rival stands at the door.' }] : [{ characterKey: 'hero', status: 'present', note: 'ok' }, { characterKey: 'rival', status: 'present', note: 'ok' }] }), [], { inputTokens: 100, outputTokens: 50 })
      },
    })
    expect(requests.map(request => [request.panelNumber, request.anchorPanel, request.predecessorPanel, request.absentKeys, request.roster])).toEqual([
      [2, 1, 1, ['rival'], ['hero', 'rival']],
      [3, 1, 2, [], ['hero', 'rival']],
    ])
    expect(requests[0]?.castCards).toEqual([{ key: 'hero', path: join(runDirectory, 'assets', 'character-references', 'character-snapshot', 'hero', 'reference.png') }])
    expect(requests[0]?.absentCards).toEqual([{ key: 'rival', path: join(runDirectory, 'assets', 'character-references', 'character-snapshot', 'rival', 'reference.png') }])
    expect(requests[0]?.characterReferences.map(reference => reference.key)).toEqual(['hero', 'rival'])
    expect(requests[0]?.anchorPath).toBe(join(runDirectory, 'panels', 'panel-01.png'))
    expect(requests[1]?.predecessorPath).toBe(join(runDirectory, 'panels', 'panel-02.png'))
    expect(requests[0]?.locationReferences).toEqual([{ key: 'cargo-bay', specification: 'cargo-bay: a loading door stays left of a fixed control booth.' }])
    expect(requests[0]?.model).toBe(JUDGE_MODEL)
    expect(result.entries).toHaveLength(0)
    expect(result.continuity).toMatchObject({ judged: 2, hardFailures: 1, anchorPanel: 1, trustedAnchorPanel: null, reportDirectory: 'qa/continuity-audit-test-continuity' })
    expect(result.continuity?.byKey).toEqual({ 'side-flip': 0, 'seat-swap': 0, 'furniture-spin': 0, intruder: 1, 'vanishing-crowd': 0, 'wardrobe-swap': 0 })
    expect(result.inputTokens).toBe(200)
    expect(result.outputTokens).toBe(100)
    expect(Buffer.from(await Bun.file(join(runDirectory, 'panels', 'panel-02.png')).arrayBuffer())).toEqual(before)
    const continuityDirectory = join(runDirectory, 'qa', 'continuity-audit-test-continuity')
    for (const name of ['stage-state.json', 'continuity-report.json', 'continuity-report.md', 'panel-02-continuity.json', 'panel-03-continuity.json']) {
      expect(await Bun.file(join(continuityDirectory, name)).exists()).toBe(true)
    }
    expect(await Bun.file(join(continuityDirectory, 'panel-01-continuity.json')).exists()).toBe(false)
    expect(await Bun.file(join(result.reportDirectory, 'page-qa-report.json')).exists()).toBe(false)
    const audit = JSON.parse(await Bun.file(join(result.reportDirectory, 'qa-only-audit.json')).text())
    expect(audit.imageGenerationCalls).toBe(0)
    expect(audit.imageRepairCalls).toBe(0)
    expect(audit.canonicalImagesModified).toBe(false)
    expect(audit.continuity).toEqual({ judged: 2, hardFailures: 1, byKey: { 'side-flip': 0, 'seat-swap': 0, 'furniture-spin': 0, intruder: 1, 'vanishing-crowd': 0, 'wardrobe-swap': 0 }, anchorPanel: 1, trustedAnchorPanel: null, reportDirectory: 'qa/continuity-audit-test-continuity' })
    expect(audit.panels.map((panel: { panelNumber: number; continuity?: { hardKeys: string[] } }) => [panel.panelNumber, panel.continuity?.hardKeys])).toEqual([[2, ['intruder']], [3, []]])
    const report = JSON.parse(await Bun.file(join(continuityDirectory, 'continuity-report.json')).text())
    expect(report.panels.map((panel: { panelNumber: number }) => panel.panelNumber)).toEqual([2, 3])
    expect(report.ledger.judged).toBe(2)
    expect(report.labels).toBeNull()
    const markdown = await Bun.file(join(continuityDirectory, 'continuity-report.md')).text()
    expect(markdown).toContain(`Scene: ${sceneSlug}; judge model: ${JUDGE_MODEL}; run: test-continuity.`)
  })

  test('runs beside the page judge, honors --trusted-anchor-panel, and stamps continuity onto the page QA entries', async () => {
    const sceneSlug = `continuity-beside-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, fixturePanels)
    let pageJudgeCalls = 0
    const requests: ContinuityJudgeRequest[] = []
    const result = await runQaOnlyPanelAudit({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, panels: [3], concurrency: 1, continuityQa: true, trustedAnchorPanel: 2 }, {
      runId: 'test-beside',
      judgePage: async request => { pageJudgeCalls++; return pageQaEntry(request.pageNumber, { hardFailure: true }) },
      judgeContinuity: async request => { requests.push(request); return buildContinuityJudgeEntry(request, continuityResult({ panelNumber: 3, anchorPanel: request.anchorPanel, predecessorPanel: request.predecessorPanel, blooperCategory: 'seat-swap' }), [], { inputTokens: 1, outputTokens: 1 }) },
    })
    expect(pageJudgeCalls).toBe(1)
    expect(requests.map(request => [request.anchorPanel, request.predecessorPanel, request.trustedAnchorPanel])).toEqual([[2, 2, 2]])
    expect(planContinuityJudgeImages(requests[0]!).map(item => item.role)).toEqual(['candidate', 'anchor', 'cast-card', 'cast-card'])
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.hardFailure).toBe(true)
    expect((result.entries[0] as { continuity?: unknown }).continuity).toEqual({ schemaVersion: 1, judgeModel: JUDGE_MODEL, anchorPanel: 2, predecessorPanel: 2, hardKeys: ['seat-swap'], blooperCategory: 'seat-swap' })
    expect(result.continuity).toMatchObject({ judged: 1, hardFailures: 1, anchorPanel: 2, trustedAnchorPanel: 2 })
    expect(result.inputTokens).toBe(11)
    const pageReport = JSON.parse(await Bun.file(join(result.reportDirectory, 'page-qa-report.json')).text())
    expect(pageReport.schemaVersion).toBe(PAGE_QA_REPORT_SCHEMA_VERSION)
    expect(pageReport.pages[0].continuity.hardKeys).toEqual(['seat-swap'])
    const stageState = JSON.parse(await Bun.file(join(runDirectory, 'qa', 'continuity-audit-test-beside', 'stage-state.json')).text())
    expect(stageState.anchorPanel).toBe(2)
    expect(stageState.trustedAnchorPanel).toBe(2)
    expect(stageState.segments).toEqual([{ index: 0, locationKey: 'cargo-bay', panelNumbers: [1, 2, 3], anchorPanel: 2 }])
  })

  test('the reuse guard refuses a page-qa-report.json entry lacking continuity when continuity is required', async () => {
    const sceneSlug = `continuity-reuse-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, fixturePanels)
    const panelPath = join(runDirectory, 'panels', 'panel-02.png')
    const bare = pageQaEntry(2)
    expect(isPageQaEntryReusableWithContinuity(bare, { continuityRequired: false })).toBe(true)
    expect(isPageQaEntryReusableWithContinuity(bare, { continuityRequired: true })).toBe(false)
    expect(isPageQaEntryReusableWithContinuity(undefined, { continuityRequired: false })).toBe(false)
    const stamped = attachContinuityToPageQaEntry(bare, entryFor(2, 1, 1))
    expect(isPageQaEntryReusableWithContinuity(stamped, { continuityRequired: true })).toBe(true)
    const writeReport = async (entry: PageQaEntry) => Bun.write(join(runDirectory, 'panels', 'page-qa-report.json'), JSON.stringify({ schemaVersion: PAGE_QA_REPORT_SCHEMA_VERSION, usage: entry.usage, pages: [entry] }))
    await writeReport(bare)
    expect(await readReusablePageQaEntryForAudit(panelPath, JUDGE_MODEL, { continuityRequired: true })).toBeUndefined()
    expect((await readReusablePageQaEntryForAudit(panelPath, JUDGE_MODEL, { continuityRequired: false }))?.outputFile).toBe('panel-02.png')
    let pageJudgeCalls = 0
    const dependencies = {
      judgePage: async (request: { pageNumber: number }) => { pageJudgeCalls++; return pageQaEntry(request.pageNumber) },
      judgeContinuity: async (request: ContinuityJudgeRequest) => buildContinuityJudgeEntry(request, continuityResult({ panelNumber: 2 }), [], { inputTokens: 1, outputTokens: 1 }),
    }
    const options = { sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, panels: [2], concurrency: 1, continuityQa: true }
    await runQaOnlyPanelAudit(options, { ...dependencies, runId: 'reuse-refused' })
    expect(pageJudgeCalls).toBe(1)
    await writeReport(stamped)
    expect((await readReusablePageQaEntryForAudit(panelPath, JUDGE_MODEL, { continuityRequired: true }))?.continuity?.anchorPanel).toBe(1)
    const reused = await runQaOnlyPanelAudit(options, { ...dependencies, runId: 'reuse-accepted' })
    expect(pageJudgeCalls).toBe(1)
    expect(reused.entries).toHaveLength(1)
    expect(reused.entries[0]?.outputFile).toBe('panel-02.png')
    await writeReport(bare)
    await runQaOnlyPanelAudit({ ...options, continuityQa: false }, { judgePage: dependencies.judgePage, runId: 'plain-audit' })
    expect(pageJudgeCalls).toBe(2)
  })

  test('joins a labels file, takes its trusted anchor when no flag is given, and reports precision', async () => {
    const sceneSlug = `continuity-labels-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, fixturePanels)
    const labelsPath = join(runDirectory, 'qa', 'continuity-labels.json')
    await mkdir(dirname(labelsPath), { recursive: true })
    await Bun.write(labelsPath, JSON.stringify(labelsFile(sceneSlug, { trustedAnchorPanel: 1, pairs: [{ panels: [1, 2], verdicts: verdicts(['intruder']) }, { panels: [2, 3], verdicts: verdicts() }] })))
    const result = await runQaOnlyPanelAudit({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, concurrency: 2, continuityQa: true, continuityOnly: true, labels: labelsPath }, {
      runId: 'test-labels',
      judgeContinuity: async request => buildContinuityJudgeEntry(request, continuityResult({ panelNumber: request.panelNumber, anchorPanel: request.anchorPanel, predecessorPanel: request.predecessorPanel, blooperCategory: request.panelNumber === 2 ? 'intruder' : 'none' }), [], { inputTokens: 1, outputTokens: 1 }),
    })
    expect(result.continuity).toMatchObject({ judged: 3, anchorPanel: 1, trustedAnchorPanel: 1 })
    const report = JSON.parse(await Bun.file(join(runDirectory, 'qa', 'continuity-audit-test-labels', 'continuity-report.json')).text())
    expect(report.labels).toMatchObject({ labeler: 'Anthony', labeledPairs: 2, matchedPairs: 2, unmatchedPairs: [] })
    expect(report.labels.byKey.find((metrics: { key: string }) => metrics.key === 'intruder')).toMatchObject({ truePositives: 1, falsePositives: 0, falseNegatives: 0, trueNegatives: 1, precision: 1, recall: 1 })
    const markdown = await Bun.file(join(runDirectory, 'qa', 'continuity-audit-test-labels', 'continuity-report.md')).text()
    expect(markdown).toContain('Labeler: Anthony; date: 2026-09-02; labeled pairs: 2; matched pairs: 2; unmatched pairs: 0.')
    await expect(runQaOnlyPanelAudit({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, concurrency: 1, continuityQa: true, continuityOnly: true, labels: labelsPath, trustedAnchorPanel: 7 }, { runId: 'bad-anchor', judgeContinuity: async () => { throw new Error('unreachable') } })).rejects.toThrow('Trusted anchor panel 7 is not a panel of this scene')
  })

  test('fails before any judge call when a comparison panel is missing and preserves partial evidence on judge errors', async () => {
    const sceneSlug = `continuity-preflight-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, fixturePanels, { canonicalPanels: [2, 3] })
    let calls = 0
    await expect(runQaOnlyPanelAudit({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, panels: [2], concurrency: 1, continuityQa: true, continuityOnly: true }, {
      runId: 'preflight', judgeContinuity: async () => { calls++; throw new Error('unreachable') },
    })).rejects.toThrow('Continuity audit preflight failed before any provider calls')
    expect(calls).toBe(0)
    expect(await Bun.file(join(runDirectory, 'qa', 'panel-audit-preflight', 'qa-only-audit.json')).exists()).toBe(false)
    await Bun.write(join(runDirectory, 'panels', 'panel-01.png'), tinyPng)
    await expect(runQaOnlyPanelAudit({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, panels: [2, 3], concurrency: 1, continuityQa: true, continuityOnly: true }, {
      runId: 'partial',
      judgeContinuity: async request => {
        if (request.panelNumber === 3) throw new Error('judge exploded')
        return buildContinuityJudgeEntry(request, continuityResult({ panelNumber: 2 }), [], { inputTokens: 1, outputTokens: 1 })
      },
    })).rejects.toThrow('1 continuity judgment(s) failed; partial evidence was preserved at')
    const audit = JSON.parse(await Bun.file(join(runDirectory, 'qa', 'panel-audit-partial', 'qa-only-audit.json')).text())
    expect(audit.continuity.judged).toBe(1)
    expect(audit.panels.find((panel: { panelNumber: number }) => panel.panelNumber === 3).continuityError).toBe('judge exploded')
    const report = JSON.parse(await Bun.file(join(runDirectory, 'qa', 'continuity-audit-partial', 'continuity-report.json')).text())
    expect(report.panels.find((panel: { panelNumber: number }) => panel.panelNumber === 3).error).toBe('judge exploded')
    expect(await Bun.file(join(runDirectory, 'qa', 'continuity-audit-partial', 'panel-02-continuity.json')).exists()).toBe(true)
    expect(await Bun.file(join(runDirectory, 'qa', 'continuity-audit-partial', 'panel-03-continuity.json')).exists()).toBe(false)
  })
})
