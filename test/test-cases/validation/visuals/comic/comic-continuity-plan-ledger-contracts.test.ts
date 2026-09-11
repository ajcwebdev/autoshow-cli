import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  buildContinuityAuditReport,
  buildContinuityStageState,
  createContinuityLedger,
  deriveContinuityAuditPlan,
  mergeContinuityEntries,
  mergeContinuityLedger,
  renderContinuityReportMarkdown,
  writeContinuityAuditArtifacts
} from '~/cli/commands/visuals/comic/comic-utils/continuity-audit-report'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { setupContinuityContractFixtures } from './comic-continuity-contract-fixtures'
const { temporaryDirectories, JUDGE_MODEL, panelBundle, entryFor, labelsFile, verdicts } = setupContinuityContractFixtures()


describe('continuity audit plan derivation', () => {
  const bundles = [
    { panelNumber: 1, bundleData: panelBundle({ number: 1, characterKeys: ['hero', 'rival'] }) },
    { panelNumber: 2, bundleData: panelBundle({ number: 2, characterKeys: ['hero'] }) },
    { panelNumber: 3, bundleData: panelBundle({ number: 3, characterKeys: ['rival', 'hero'] }) },
    { panelNumber: 4, bundleData: panelBundle({ number: 4, characterKeys: ['hero'], locationKey: 'hallway' }) },
    { panelNumber: 5, bundleData: panelBundle({ number: 5, characterKeys: ['hero', 'rival'], locationKey: 'hallway' }) },
  ]

  test('derives segments, roster, intrusion candidates, anchors, and predecessors from the bundles', () => {
    const plan = deriveContinuityAuditPlan([...bundles].reverse())
    expect(plan.trustedAnchorPanel).toBeNull()
    expect(plan.anchorPanel).toBe(1)
    expect(plan.roster).toEqual(['hero', 'rival'])
    expect(plan.segments).toEqual([
      { index: 0, locationKey: 'cargo-bay', panelNumbers: [1, 2, 3], anchorPanel: 1 },
      { index: 1, locationKey: 'hallway', panelNumbers: [4, 5], anchorPanel: 4 },
    ])
    expect(plan.panels.map(panel => panel.panelNumber)).toEqual([1, 2, 3, 4, 5])
    expect(plan.panels[0]).toMatchObject({ segmentIndex: 0, absentKeys: [], entered: ['hero', 'rival'], exited: [], anchorPanel: 1, predecessorPanel: null, sourceSegmentIds: ['beat-1'] })
    expect(plan.panels[1]).toMatchObject({ absentKeys: ['rival'], entered: [], exited: ['rival'], anchorPanel: 1, predecessorPanel: 1 })
    expect(plan.panels[2]).toMatchObject({ characterKeys: ['rival', 'hero'], absentKeys: [], entered: ['rival'], exited: [], predecessorPanel: 2 })
    expect(plan.panels[3]).toMatchObject({ segmentIndex: 1, locationKey: 'hallway', absentKeys: ['rival'], entered: ['hero'], exited: [], anchorPanel: 4, predecessorPanel: null })
    expect(plan.panels[4]).toMatchObject({ anchorPanel: 4, predecessorPanel: 4, entered: ['rival'] })
  })

  test('honors a trusted anchor inside its own segment and rejects one outside the scene', () => {
    const plan = deriveContinuityAuditPlan(bundles, { trustedAnchorPanel: 2 })
    expect(plan.anchorPanel).toBe(2)
    expect(plan.segments[0]?.anchorPanel).toBe(2)
    expect(plan.segments[1]?.anchorPanel).toBe(4)
    expect(plan.panels.find(panel => panel.panelNumber === 1)?.anchorPanel).toBe(2)
    expect(plan.panels.find(panel => panel.panelNumber === 3)?.anchorPanel).toBe(2)
    expect(plan.panels.find(panel => panel.panelNumber === 5)?.anchorPanel).toBe(4)
    expect(() => deriveContinuityAuditPlan(bundles, { trustedAnchorPanel: 9 })).toThrow('Trusted anchor panel 9 is not a panel of this scene')
    expect(() => deriveContinuityAuditPlan([])).toThrow('at least one panel bundle')
    expect(() => deriveContinuityAuditPlan([bundles[0]!, bundles[0]!])).toThrow('duplicate panel numbers')
  })

  test('keys anchors by location so a scene that returns to a location keeps its trusted anchor across the interlude', () => {
    const returning = [
      { panelNumber: 1, bundleData: panelBundle({ number: 1, characterKeys: ['hero', 'rival'] }) },
      { panelNumber: 2, bundleData: panelBundle({ number: 2, characterKeys: ['hero'] }) },
      { panelNumber: 3, bundleData: panelBundle({ number: 3, characterKeys: ['hero'], locationKey: 'hallway' }) },
      { panelNumber: 4, bundleData: panelBundle({ number: 4, characterKeys: ['hero', 'rival'] }) },
      { panelNumber: 5, bundleData: panelBundle({ number: 5, characterKeys: ['rival'] }) },
    ]
    const trusted = deriveContinuityAuditPlan(returning, { trustedAnchorPanel: 2 })
    expect(trusted.anchorPanel).toBe(2)
    expect(trusted.segments).toEqual([
      { index: 0, locationKey: 'cargo-bay', panelNumbers: [1, 2], anchorPanel: 2 },
      { index: 1, locationKey: 'hallway', panelNumbers: [3], anchorPanel: 3 },
      { index: 2, locationKey: 'cargo-bay', panelNumbers: [4, 5], anchorPanel: 2 },
    ])
    expect(trusted.panels.map(panel => [panel.panelNumber, panel.segmentIndex, panel.anchorPanel, panel.predecessorPanel])).toEqual([[1, 0, 2, null], [2, 0, 2, 1], [3, 1, 3, null], [4, 2, 2, null], [5, 2, 2, 4]])
    expect(trusted.panels[3]).toMatchObject({ locationKey: 'cargo-bay', entered: ['hero', 'rival'], exited: [], absentKeys: [] })
    expect(trusted.panels[4]).toMatchObject({ entered: [], exited: ['hero'], absentKeys: ['hero'] })
    const untrusted = deriveContinuityAuditPlan(returning)
    expect(untrusted.segments.map(segment => segment.anchorPanel)).toEqual([1, 3, 1])
    expect(untrusted.panels.map(panel => panel.anchorPanel)).toEqual([1, 1, 3, 1, 1])
    const trustedLater = deriveContinuityAuditPlan(returning, { trustedAnchorPanel: 5 })
    expect(trustedLater.anchorPanel).toBe(5)
    expect(trustedLater.segments.map(segment => segment.anchorPanel)).toEqual([5, 3, 5])
    const trustedInterlude = deriveContinuityAuditPlan(returning, { trustedAnchorPanel: 3 })
    expect(trustedInterlude.segments.map(segment => segment.anchorPanel)).toEqual([1, 3, 1])
    const markdown = renderContinuityReportMarkdown(buildContinuityAuditReport({ sceneSlug: 'scene', runId: 'run-aba', judgeModel: JUDGE_MODEL, plan: trusted, entries: [] }))
    expect(markdown).toContain('- Segment 1: cargo-bay, panels 1, 2, anchor 2 (human trusted label).')
    expect(markdown).toContain('- Segment 2: hallway, panels 3, anchor 3.')
    expect(markdown).toContain('- Segment 3: cargo-bay, panels 4, 5, anchor 2 (human trusted label).')
    const untrustedMarkdown = renderContinuityReportMarkdown(buildContinuityAuditReport({ sceneSlug: 'scene', runId: 'run-aba', judgeModel: JUDGE_MODEL, plan: untrusted, entries: [] }))
    expect(untrustedMarkdown).toContain('- Segment 1: cargo-bay, panels 1, 2, anchor 1.')
    expect(untrustedMarkdown).toContain('- Segment 3: cargo-bay, panels 4, 5, anchor 1 (shared with segment 1).')
  })
})

describe('continuity ledger merge policy', () => {
  test('merges per-panel results into scene-level counters keyed by hard key exactly once per panel', () => {
    const entries = [
      entryFor(3, 1, 2, { blooperCategory: 'intruder', castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'x' }] }),
      entryFor(1, 1, null),
      entryFor(2, 1, 1, { blooperCategory: 'side-flip', axisStatus: 'crossed', furnitureOrientation: { versusAnchor: 'mirrored', versusPredecessor: 'same' } }, { inputTokens: 20, outputTokens: 10 }),
    ]
    const ledger = mergeContinuityEntries(entries)
    expect(ledger.judged).toBe(3)
    expect(ledger.hardFailures).toBe(2)
    expect(ledger.byKey).toEqual({ 'side-flip': 1, 'seat-swap': 0, 'furniture-spin': 1, intruder: 1, 'vanishing-crowd': 0, 'wardrobe-swap': 0 })
    expect(ledger.byCategory).toEqual({ 'side-flip': 1, 'seat-swap': 0, 'furniture-spin': 0, intruder: 1, 'vanishing-crowd': 0, 'wardrobe-swap': 0, none: 1 })
    expect(ledger.axisCrossed).toBe(1)
    expect(ledger.furnitureVersusAnchor).toEqual({ same: 2, rotated: 0, mirrored: 1, redesigned: 0, 'not-assessable': 0 })
    expect(ledger.usage).toMatchObject({ inputTokens: 40, outputTokens: 20, totalTokens: 60 })
    expect(ledger.usage.costUsd).toBeCloseTo(entries.reduce((sum, entry) => sum + entry.usage.costUsd, 0), 10)
    const reversed = mergeContinuityEntries([...entries].reverse())
    expect(reversed).toEqual(ledger)
    const empty = createContinuityLedger()
    expect(empty.judged).toBe(0)
    expect(Object.values(empty.byKey).every(count => count === 0)).toBe(true)
    const single = mergeContinuityLedger(empty, entries[0]!)
    expect(single.byKey.intruder).toBe(1)
    expect(empty.byKey.intruder).toBe(0)
  })
})

describe('continuity report writer', () => {
  const longNotes = 'The rival is drawn standing beside the loading door on screen right even though the contract excludes him, and the hero keeps the anchor seat, posture, and wardrobe, so the only defect is the intruding background character who must not be there.'

  test('renders an unwrapped Markdown report and writes every artifact kind', async () => {
    const plan = deriveContinuityAuditPlan([
      { panelNumber: 1, bundleData: panelBundle({ number: 1, characterKeys: ['hero', 'rival'] }) },
      { panelNumber: 2, bundleData: panelBundle({ number: 2, characterKeys: ['hero'] }) },
      { panelNumber: 3, bundleData: panelBundle({ number: 3, characterKeys: ['hero'] }) },
    ])
    const entries = [
      entryFor(2, 1, 1, { blooperCategory: 'intruder', castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'Rival at the door.' }], notes: longNotes, observedStageState: 'Hero sits screen left | rival stands screen right.' }),
    ]
    const labels = labelsFile('scene', { pairs: [{ panels: [1, 2], verdicts: verdicts(['intruder']) }, { panels: [2, 3], verdicts: verdicts() }] })
    const report = buildContinuityAuditReport({ sceneSlug: 'scene', runId: 'run-1', judgeModel: JUDGE_MODEL, plan, entries, errors: [{ panelNumber: 3, error: 'judge timed out' }], selection: [2, 3], labels })
    expect(report.schemaVersion).toBe(1)
    expect(report.anchorPanel).toBe(1)
    expect(report.panels.map(panel => panel.panelNumber)).toEqual([2, 3])
    expect(report.panels[0]).toMatchObject({ judged: true, hardKeys: ['intruder'], blooperCategory: 'intruder', error: null })
    expect(report.panels[1]).toMatchObject({ judged: false, hardKeys: [], blooperCategory: null, error: 'judge timed out' })
    expect(report.labels?.matchedPairs).toBe(1)
    expect(report.labels?.unmatchedPairs).toEqual([{ panels: [2, 3], reason: 'panel 3 was not judged' }])
    const markdown = renderContinuityReportMarkdown(report)
    const lines = markdown.split('\n')
    expect(lines[0]).toBe('# Continuity Audit Report')
    expect(markdown).toContain('Anchor panel: 1; trusted anchor label: none.')
    expect(markdown).toContain('Implied keys: side-flip=0, seat-swap=0, furniture-spin=0, intruder=1, vanishing-crowd=0, wardrobe-swap=0.')
    expect(markdown).toContain('- Segment 1: cargo-bay, panels 1, 2, 3, anchor 1.')
    expect(lines.some(line => line.startsWith('| 2 | 1 | 1 | intruder | intruder | consistent | same | none |') && line.includes(longNotes))).toBe(true)
    expect(lines.some(line => line.includes('Hero sits screen left \\| rival stands screen right.'))).toBe(true)
    expect(markdown).toContain('| 3 | 1 | 2 | none | none | none | none | none | none | error: judge timed out |')
    expect(markdown).toContain('| intruder | 1 | 0 | 0 | 0 | 1.0000 | 1.0000 |')
    expect(markdown).toContain('- Unmatched pair [2, 3]: panel 3 was not judged.')
    expect(markdown).toContain('A pair matches when its candidate panel was judged against the reference panel as anchor or predecessor. The judge is positive for a key when the candidate\'s blooperCategory names it or its cast audit implies it')
    expect(markdown).toContain('- Panel 3: judge timed out')
    expect(lines.every(line => line === '' || !/^\s/.test(line))).toBe(true)
    expect(lines.filter(line => line.length > 0).every(line => /^(#|-|\||[A-Z])/.test(line))).toBe(true)
    expect(markdown.endsWith('\n')).toBe(true)
    expect(markdown).not.toContain('\n\n\n')

    const directory = await makeTempDir('autoshow-continuity-report-')
    temporaryDirectories.push(directory)
    const written = await writeContinuityAuditArtifacts(join(directory, 'continuity-audit-run-1'), { report, stageState: buildContinuityStageState('scene', plan, entries), entries })
    expect(written.panelReportPaths.map(path => path.split('/').at(-1))).toEqual(['panel-02-continuity.json'])
    const stageState = JSON.parse(await Bun.file(written.stageStatePath).text())
    expect(stageState.panels.map((panel: { panelNumber: number; observedStageState: string | null }) => [panel.panelNumber, panel.observedStageState])).toEqual([[1, null], [2, 'Hero sits screen left | rival stands screen right.'], [3, null]])
    expect(stageState.panels[1].absentKeys).toEqual(['rival'])
    expect(JSON.parse(await Bun.file(written.reportJsonPath).text()).ledger.byKey.intruder).toBe(1)
    expect(await Bun.file(written.reportMarkdownPath).text()).toBe(markdown)
    expect(JSON.parse(await Bun.file(written.panelReportPaths[0]!).text())).toMatchObject({ schemaVersion: 1, panelNumber: 2, hardKeys: ['intruder'], judgeModel: JUDGE_MODEL })
  })
})
