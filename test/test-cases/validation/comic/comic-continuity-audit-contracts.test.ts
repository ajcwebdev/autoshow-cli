import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { PAGE_QA_REPORT_SCHEMA_VERSION } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-qa'
import {
  CONTINUITY_BLOCKING_LABEL_SENTENCE,
  CONTINUITY_BLOOPER_CATEGORIES,
  CONTINUITY_ESTIMATED_INPUT_UNITS_PER_PANEL,
  CONTINUITY_ESTIMATED_OUTPUT_UNITS_PER_PANEL,
  CONTINUITY_HARD_KEYS,
  CONTINUITY_JUDGE_DOWNSCALE_WIDTH,
  CONTINUITY_QA_JSON_SCHEMA,
  buildContinuityJudgeEntry,
  buildContinuityJudgePrompt,
  deriveContinuityHardKeys,
  deriveContinuityLabelKeys,
  downscaleImageForContinuityJudge,
  hasContinuityHardFailure,
  parseContinuityJudgeResult,
  planContinuityJudgeImages,
  prepareContinuityJudgeImages,
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/continuity-qa'
import { runQaOnlyPanelAudit } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/qa-only-panel-audit'
import {
  attachContinuityToPageQaEntry,
  buildContinuityAuditReport,
  buildContinuityStageState,
  createContinuityLedger,
  deriveContinuityAuditPlan,
  isPageQaEntryReusableWithContinuity,
  mergeContinuityEntries,
  mergeContinuityLedger,
  readReusablePageQaEntryForAudit,
  renderContinuityReportMarkdown,
  writeContinuityAuditArtifacts,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/continuity-audit-report'
import { computeContinuityKeyMetrics, joinContinuityLabels, parseContinuityLabels, readContinuityLabels } from '~/cli/commands/process-steps/step-8-comic/comic-utils/continuity-labels'
import { estimateQaOnlyPanelAuditPrice } from '~/cli/commands/process-steps/step-8-comic/comic-utils/qa-only-price-estimate'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import type { ContinuityJudgeEntry, ContinuityJudgeRequest, ContinuityJudgeResult, ContinuityLabelsFile, PageQaEntry, PanelBundleData } from '~/types'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const temporaryDirectories: string[] = []
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const sha = new Bun.CryptoHasher('sha256').update(tinyPng).digest('hex')
const JUDGE_MODEL = 'gpt-5.6-sol'

type FixturePanel = { number: number; characterKeys: string[]; locationKey?: string }

const locationOf = (key: string) => ({ key, raw: key })

const panelBundle = (panel: FixturePanel): PanelBundleData => {
  const locationKey = panel.locationKey ?? 'cargo-bay'
  return {
    schemaVersion: 4, snapshotId: 'character-snapshot',
    title: 'Continuity Contract', location: 'Cargo Bay', panels: [{
      number: panel.number, description: `Authored staging ${panel.number}.`,
      shotPlan: `Medium eye-level shot ${panel.number}; hero is screen left facing right at the control booth.`,
      characterKeys: panel.characterKeys, speech: [], sourceSegmentIds: [`beat-${panel.number}`],
      sourceSegments: [{ id: `beat-${panel.number}`, type: 'direction', text: `Authored staging ${panel.number}.`, sourceSpans: [], beatIndex: panel.number, location: locationOf(locationKey) }],
      locationKey, locationSnapshotId: `location-${locationKey}`,
    }],
  }
}

const createSceneFixture = async (sceneSlug: string, panels: FixturePanel[], options: { canonicalPanels?: number[] } = {}): Promise<{ runDirectory: string }> => {
  const runDirectory = await makeTempDir('autoshow-comic-continuity-')
  temporaryDirectories.push(runDirectory)
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  const characters = ['hero', 'rival']
  for (const key of characters) {
    const characterRoot = join(runDirectory, 'assets', 'character-references', 'character-snapshot', key)
    await mkdir(characterRoot, { recursive: true })
    await Bun.write(join(characterRoot, 'reference.png'), tinyPng)
  }
  await Bun.write(join(runDirectory, 'assets', 'character-references.json'), JSON.stringify({ schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt: '2026-01-01T00:00:00.000Z', characters: characters.map(key => ({ key, name: key === 'hero' ? 'Hero' : 'Rival', description: key === 'hero' ? 'Test hero in a blue uniform' : 'Test rival in a red coat', sourceSketchVersion: 'v1', assets: [{ role: 'sketch-sheet', path: `assets/character-references/character-snapshot/${key}/reference.png`, sha256: sha }, { role: 'source-image', path: `assets/character-references/character-snapshot/${key}/reference.png`, sha256: sha }] })) }))
  const locationKeys = Array.from(new Set(panels.map(panel => panel.locationKey ?? 'cargo-bay')))
  const snapshots = []
  for (const key of locationKeys) {
    const sheet = join(runDirectory, 'assets', 'location-references', `location-${key}`, `${key}.png`)
    await mkdir(dirname(sheet), { recursive: true })
    await Bun.write(sheet, tinyPng)
    snapshots.push({ schemaVersion: 2, snapshotId: `location-${key}`, locationKey: key, specification: `${key}: a loading door stays left of a fixed control booth.`, sourceScripts: ['scripts/02-script/01.md'], sourceViews: [{ view: 'establishing', generationId: 'v1', imageSha256: sha }], sheet: { path: `assets/location-references/location-${key}/${key}.png`, sha256: sha } })
  }
  await Bun.write(join(runDirectory, 'assets', 'location-references.json'), JSON.stringify({ schemaVersion: 2, snapshots }))
  for (const panel of panels) {
    const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-${String(panel.number).padStart(2, '0')}`)
    await mkdir(directory, { recursive: true })
    await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panel), null, 2)}\n\`\`\`\n`)
  }
  const canonical = options.canonicalPanels ?? panels.map(panel => panel.number)
  await mkdir(join(runDirectory, 'panels'), { recursive: true })
  for (const number of canonical) await Bun.write(join(runDirectory, 'panels', `panel-${String(number).padStart(2, '0')}.png`), tinyPng)
  return { runDirectory }
}

const continuityResult = (overrides: Partial<ContinuityJudgeResult> = {}): ContinuityJudgeResult => ({
  panelNumber: 2, anchorPanel: 1, predecessorPanel: 1, axisStatus: 'consistent',
  castAudit: [
    { characterKey: 'hero', status: 'present', note: 'Hero is seated screen left at the booth.' },
    { characterKey: 'rival', status: 'not-assessable', note: 'Rival is not listed and not visible.' },
  ],
  characters: [{ characterKey: 'hero', screenSide: 'left', posture: 'seated', relativePlacement: 'at the control booth beside the loading door', wardrobe: 'canonical blue uniform' }],
  furnitureOrientation: { versusAnchor: 'same', versusPredecessor: 'same' },
  observedStageState: 'Hero sits screen left at the control booth; nobody else is on stage.',
  blooperCategory: 'none', repairRoute: 'none', notes: 'Clean panel.',
  ...overrides,
})

const entryFor = (panelNumber: number, anchorPanel: number, predecessorPanel: number | null, overrides: Partial<ContinuityJudgeResult> = {}, usage = { inputTokens: 10, outputTokens: 5 }): ContinuityJudgeEntry =>
  buildContinuityJudgeEntry({ panelNumber, panelPath: `/scene/panels/panel-${String(panelNumber).padStart(2, '0')}.png`, anchorPanel, predecessorPanel, model: JUDGE_MODEL }, continuityResult({ panelNumber, anchorPanel, predecessorPanel, ...overrides }), [], usage)

const judgeRequest = (overrides: Partial<ContinuityJudgeRequest> = {}): ContinuityJudgeRequest => ({
  sceneSlug: 'scene', panelNumber: 2, panelPath: '/scene/panels/panel-02.png', anchorPanel: 1, anchorPath: '/scene/panels/panel-01.png', predecessorPanel: 1, predecessorPath: '/scene/panels/panel-01.png', trustedAnchorPanel: null,
  panelData: panelBundle({ number: 2, characterKeys: ['hero'] }), roster: ['hero', 'rival'], absentKeys: ['rival'],
  castCards: [{ key: 'hero', path: '/scene/assets/hero.png' }], absentCards: [{ key: 'rival', path: '/scene/assets/rival.png' }],
  characterReferences: [{ key: 'hero', description: 'Test hero in a blue uniform' }, { key: 'rival', description: 'Test rival in a red coat' }],
  locationReferences: [{ key: 'cargo-bay', specification: 'cargo-bay: a loading door stays left of a fixed control booth.' }],
  model: JUDGE_MODEL,
  ...overrides,
})

const pageQaEntry = (panelNumber: number, overrides: Partial<PageQaEntry> = {}): PageQaEntry => ({
  pageNumber: panelNumber, panelNumbers: [panelNumber], outputFile: `panel-${String(panelNumber).padStart(2, '0')}.png`, judgeModel: JUDGE_MODEL, hardFailure: false,
  result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [panelNumber], issues: [] }, panels: [{ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' }], summary: 'Pass.' },
  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.01 },
  ...overrides,
})

const labelsFile = (sceneSlug: string, overrides: Partial<ContinuityLabelsFile> = {}): ContinuityLabelsFile => ({
  schemaVersion: 1, sceneSlug, trustedAnchorPanel: null, labeler: 'Anthony', date: '2026-09-02',
  pairs: [],
  ...overrides,
})

const verdicts = (positive: string[] = []) => ({
  'side-flip': positive.includes('side-flip'), 'seat-swap': positive.includes('seat-swap'), 'furniture-spin': positive.includes('furniture-spin'),
  intruder: positive.includes('intruder'), 'vanishing-crowd': positive.includes('vanishing-crowd'), 'wardrobe-swap': positive.includes('wardrobe-swap'),
})

afterEach(async () => {
  resetSceneRunContext()
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('continuity judge schema and hard rules', () => {
  test('parses a schema-valid judgment and normalizes the bookkeeping numbers to the audit plan', () => {
    const parsed = parseContinuityJudgeResult(JSON.stringify(continuityResult({ panelNumber: 9, anchorPanel: 9, predecessorPanel: 9 })), { panelNumber: 2, anchorPanel: 1, predecessorPanel: null })
    expect(parsed.panelNumber).toBe(2)
    expect(parsed.anchorPanel).toBe(1)
    expect(parsed.predecessorPanel).toBeNull()
    expect(parsed.blooperCategory).toBe('none')
    expect(parsed.castAudit).toHaveLength(2)
  })

  test('rejects malformed judgments with exact-key and enum discipline', () => {
    const expected = { panelNumber: 2, anchorPanel: 1, predecessorPanel: 1 }
    expect(() => parseContinuityJudgeResult('{not json', expected)).toThrow('Continuity judge returned invalid JSON')
    expect(() => parseContinuityJudgeResult(JSON.stringify({ ...continuityResult(), extra: true }), expected)).toThrow('missing, unexpected, or invalid fields')
    const { notes: _notes, ...missingNotes } = continuityResult()
    expect(() => parseContinuityJudgeResult(JSON.stringify(missingNotes), expected)).toThrow('missing, unexpected, or invalid fields')
    expect(() => parseContinuityJudgeResult(JSON.stringify(continuityResult({ blooperCategory: 'desk-drift' as ContinuityJudgeResult['blooperCategory'] })), expected)).toThrow('blooperCategory')
    expect(() => parseContinuityJudgeResult(JSON.stringify(continuityResult({ castAudit: [{ characterKey: 'hero', status: 'occluded' as 'present', note: 'x' }] })), expected)).toThrow('castAudit')
    expect(() => parseContinuityJudgeResult(JSON.stringify(continuityResult({ observedStageState: '   ' })), expected)).toThrow('empty observedStageState')
    expect(() => parseContinuityJudgeResult(JSON.stringify(continuityResult({ characters: [{ characterKey: '', screenSide: 'left', posture: 'seated', relativePlacement: 'x', wardrobe: 'y' }] })), expected)).toThrow('without a characterKey')
  })

  test('the OpenAI subset JSON schema mirrors the strict valibot schema', () => {
    expect(CONTINUITY_QA_JSON_SCHEMA.additionalProperties).toBe(false)
    expect([...(CONTINUITY_QA_JSON_SCHEMA.required as readonly string[])].sort()).toEqual(Object.keys(CONTINUITY_QA_JSON_SCHEMA.properties).sort())
    expect([...CONTINUITY_QA_JSON_SCHEMA.properties.blooperCategory.enum]).toEqual([...CONTINUITY_BLOOPER_CATEGORIES])
    expect([...CONTINUITY_BLOOPER_CATEGORIES]).toEqual([...CONTINUITY_HARD_KEYS, 'none'])
    expect(CONTINUITY_QA_JSON_SCHEMA.properties.predecessorPanel.anyOf.map(item => item.type)).toEqual(['integer', 'null'])
    expect(CONTINUITY_QA_JSON_SCHEMA.properties.castAudit.items.additionalProperties).toBe(false)
    expect(CONTINUITY_QA_JSON_SCHEMA.properties.furnitureOrientation.required).toEqual(['versusAnchor', 'versusPredecessor'])
  })

  test('derives implied hard keys from the category, the cast audit, the axis, and the furniture orientation', () => {
    expect(deriveContinuityHardKeys(continuityResult())).toEqual([])
    expect(hasContinuityHardFailure(continuityResult())).toBe(false)
    expect(deriveContinuityHardKeys(continuityResult({ blooperCategory: 'seat-swap' }))).toEqual(['seat-swap'])
    expect(deriveContinuityHardKeys(continuityResult({ axisStatus: 'crossed' }))).toEqual(['side-flip'])
    expect(deriveContinuityHardKeys(continuityResult({ castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'Rival stands at the door.' }] }))).toEqual(['intruder'])
    expect(deriveContinuityHardKeys(continuityResult({ castAudit: [{ characterKey: 'hero', status: 'vanished', note: 'Hero is gone.' }] }))).toEqual(['vanishing-crowd'])
    expect(deriveContinuityHardKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'mirrored', versusPredecessor: 'same' } }))).toEqual(['furniture-spin'])
    expect(deriveContinuityHardKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'not-assessable', versusPredecessor: 'rotated' } }))).toEqual(['furniture-spin'])
    expect(deriveContinuityHardKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'same', versusPredecessor: 'redesigned' } }))).toEqual([])
    const combined = deriveContinuityHardKeys(continuityResult({ blooperCategory: 'wardrobe-swap', axisStatus: 'crossed', castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'x' }, { characterKey: 'hero', status: 'vanished', note: 'y' }], furnitureOrientation: { versusAnchor: 'rotated', versusPredecessor: 'same' } }))
    expect(combined).toEqual(['side-flip', 'furniture-spin', 'intruder', 'vanishing-crowd', 'wardrobe-swap'])
    expect(hasContinuityHardFailure(continuityResult({ blooperCategory: 'intruder' }))).toBe(true)
  })

  test('derives labels-join keys from the category and the cast audit only, never from the axis or the furniture orientation', () => {
    expect(deriveContinuityLabelKeys(continuityResult())).toEqual([])
    expect(deriveContinuityLabelKeys(continuityResult({ axisStatus: 'crossed' }))).toEqual([])
    expect(deriveContinuityLabelKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'mirrored', versusPredecessor: 'same' } }))).toEqual([])
    expect(deriveContinuityLabelKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'not-assessable', versusPredecessor: 'rotated' } }))).toEqual([])
    expect(deriveContinuityLabelKeys(continuityResult({ blooperCategory: 'side-flip' }))).toEqual(['side-flip'])
    expect(deriveContinuityLabelKeys(continuityResult({ blooperCategory: 'furniture-spin' }))).toEqual(['furniture-spin'])
    expect(deriveContinuityLabelKeys(continuityResult({ castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'x' }] }))).toEqual(['intruder'])
    expect(deriveContinuityLabelKeys(continuityResult({ castAudit: [{ characterKey: 'hero', status: 'vanished', note: 'y' }] }))).toEqual(['vanishing-crowd'])
    const combined = continuityResult({ blooperCategory: 'wardrobe-swap', axisStatus: 'crossed', castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'x' }], furnitureOrientation: { versusAnchor: 'rotated', versusPredecessor: 'same' } })
    expect(deriveContinuityLabelKeys(combined)).toEqual(['intruder', 'wardrobe-swap'])
    expect(deriveContinuityHardKeys(combined)).toEqual(['side-flip', 'furniture-spin', 'intruder', 'wardrobe-swap'])
  })
})

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

describe('continuity labels join and precision arithmetic', () => {
  test('validates the labels file shape and scene binding', () => {
    expect(parseContinuityLabels(labelsFile('scene', { trustedAnchorPanel: 2 }), { sceneSlug: 'scene' }).trustedAnchorPanel).toBe(2)
    expect(() => parseContinuityLabels({ ...labelsFile('scene'), extra: 1 })).toThrow('Invalid continuity labels')
    expect(() => parseContinuityLabels(labelsFile('scene', { pairs: [{ panels: [1, 2], verdicts: { ...verdicts(), 'desk-drift': true } as ReturnType<typeof verdicts> }] }))).toThrow('desk-drift')
    expect(() => parseContinuityLabels(labelsFile('other'), { sceneSlug: 'scene' })).toThrow('labels are for scene "other"')
    expect(() => parseContinuityLabels(labelsFile('scene', { pairs: [{ panels: [2, 2], verdicts: verdicts() }] }))).toThrow('must name two different panels')
    expect(() => parseContinuityLabels(labelsFile('scene', { pairs: [{ panels: [1, 2], verdicts: verdicts() }, { panels: [1, 2], verdicts: verdicts(['intruder']) }] }))).toThrow('more than once')
    expect(() => parseContinuityLabels({ ...labelsFile('scene'), schemaVersion: 2 })).toThrow('schemaVersion')
  })

  test('joins labeled pairs to judged panels and computes precision and recall per key', () => {
    const entries = [
      entryFor(2, 1, 1, { blooperCategory: 'intruder', castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'x' }] }),
      entryFor(3, 1, 2, { axisStatus: 'crossed', furnitureOrientation: { versusAnchor: 'rotated', versusPredecessor: 'same' } }),
      entryFor(4, 1, 3, { blooperCategory: 'seat-swap' }),
    ]
    expect(entries[1]?.hardKeys).toEqual(['side-flip', 'furniture-spin'])
    const join = joinContinuityLabels(labelsFile('scene', {
      labeler: 'Erik', date: '2026-09-03', trustedAnchorPanel: 1,
      pairs: [
        { panels: [1, 2], verdicts: verdicts(['intruder']) },
        { panels: [2, 3], verdicts: verdicts(['intruder']) },
        { panels: [1, 3], verdicts: verdicts(['side-flip']) },
        { panels: [3, 4], verdicts: verdicts() },
        { panels: [5, 6], verdicts: verdicts(['intruder']) },
        { panels: [2, 4], verdicts: verdicts() },
      ],
    }), entries)
    expect(join).toMatchObject({ labeler: 'Erik', date: '2026-09-03', trustedAnchorPanel: 1, labeledPairs: 6, matchedPairs: 4 })
    expect(join.unmatchedPairs).toEqual([
      { panels: [5, 6], reason: 'panel 6 was not judged' },
      { panels: [2, 4], reason: 'panel 4 was judged against anchor 1 and predecessor 3, not panel 2' },
    ])
    const byKey = Object.fromEntries(join.byKey.map(metrics => [metrics.key, metrics]))
    expect(byKey['intruder']).toEqual({ key: 'intruder', truePositives: 1, falsePositives: 0, falseNegatives: 1, trueNegatives: 2, precision: 1, recall: 0.5 })
    expect(byKey['side-flip']).toEqual({ key: 'side-flip', truePositives: 0, falsePositives: 0, falseNegatives: 1, trueNegatives: 3, precision: null, recall: 0 })
    expect(byKey['seat-swap']).toEqual({ key: 'seat-swap', truePositives: 0, falsePositives: 1, falseNegatives: 0, trueNegatives: 3, precision: 0, recall: null })
    expect(byKey['furniture-spin']).toEqual({ key: 'furniture-spin', truePositives: 0, falsePositives: 0, falseNegatives: 0, trueNegatives: 4, precision: null, recall: null })
    expect(byKey['wardrobe-swap']).toMatchObject({ truePositives: 0, falsePositives: 0, falseNegatives: 0, trueNegatives: 4, precision: null, recall: null })
    expect(computeContinuityKeyMetrics('side-flip', [{ labeled: true, judged: true }, { labeled: true, judged: true }, { labeled: false, judged: true }])).toMatchObject({ precision: 0.6667, recall: 1 })
  })

  test('reads a labels file from disk and rejects a missing or malformed one', async () => {
    const directory = await makeTempDir('autoshow-continuity-labels-')
    temporaryDirectories.push(directory)
    const path = join(directory, 'continuity-labels.json')
    await Bun.write(path, JSON.stringify(labelsFile('scene', { trustedAnchorPanel: 3 })))
    expect((await readContinuityLabels(path, { sceneSlug: 'scene' })).trustedAnchorPanel).toBe(3)
    await expect(readContinuityLabels(join(directory, 'missing.json'))).rejects.toThrow('was not found')
    await Bun.write(path, '{oops')
    await expect(readContinuityLabels(path)).rejects.toThrow('not valid JSON')
  })

  test('refuses an unlabeled template whose verdicts are schema placeholders', async () => {
    const directory = await makeTempDir('autoshow-continuity-labels-template-')
    temporaryDirectories.push(directory)
    const path = join(directory, 'continuity-labels.json')
    const template = { ...labelsFile('scene', { labeler: 'TEMPLATE - NOT LABELED', date: '' }), labeled: false, pairs: [{ panels: [1, 2] as [number, number], verdicts: verdicts() }] }
    // The template still parses: only reading it as ground truth for precision and recall is refused.
    expect(parseContinuityLabels(template).labeled).toBe(false)
    await Bun.write(path, JSON.stringify(template))
    await expect(readContinuityLabels(path)).rejects.toThrow('are an unlabeled template rather than human ground truth')
    await Bun.write(path, JSON.stringify({ ...template, labeled: true, labeler: 'Anthony', date: '2026-09-02' }))
    expect((await readContinuityLabels(path)).labeled).toBe(true)
    // A file written before the field existed is still ground truth.
    await Bun.write(path, JSON.stringify(labelsFile('scene')))
    expect((await readContinuityLabels(path)).labeled).toBeUndefined()
  })
})

describe('continuity judge inputs', () => {
  test('plans the image order with downscaled anchor and predecessor and low-detail absent cards', () => {
    const plan = planContinuityJudgeImages(judgeRequest())
    expect(plan.map(item => [item.role, item.detail])).toEqual([['candidate', 'high'], ['anchor', 'low'], ['cast-card', 'high'], ['absent-card', 'low']])
    expect(plan[1]?.label).toContain('which is also the predecessor')
    const distinct = planContinuityJudgeImages(judgeRequest({ panelNumber: 3, panelPath: '/scene/panels/panel-03.png', predecessorPanel: 2, predecessorPath: '/scene/panels/panel-02.png' }))
    expect(distinct.map(item => item.role)).toEqual(['candidate', 'anchor', 'predecessor', 'cast-card', 'absent-card'])
    const anchorIsCandidate = planContinuityJudgeImages(judgeRequest({ panelNumber: 1, panelPath: '/scene/panels/panel-01.png', predecessorPanel: null, predecessorPath: null }))
    expect(anchorIsCandidate.map(item => item.role)).toEqual(['candidate', 'cast-card', 'absent-card'])
    const laterAnchor = planContinuityJudgeImages(judgeRequest({ panelNumber: 3, panelPath: '/scene/panels/panel-03.png', anchorPanel: 3, anchorPath: '/scene/panels/panel-03.png', predecessorPanel: 2, predecessorPath: '/scene/panels/panel-02.png' }))
    expect(laterAnchor.map(item => item.role)).toEqual(['candidate', 'predecessor', 'cast-card', 'absent-card'])
  })

  test('the judge prompt names the image order, the contract, the roster, and the shared reviewer label class', () => {
    const prompt = buildContinuityJudgePrompt(judgeRequest({ trustedAnchorPanel: 1 }))
    expect(prompt).toContain(CONTINUITY_BLOCKING_LABEL_SENTENCE)
    expect(prompt).toContain('"incorrect character blocking" and "incorrect background characters" for the same defect class')
    expect(prompt).toContain('Image 1: the candidate, panel 2, at full detail.')
    expect(prompt).toContain('Image 2: the anchor, panel 1, the trusted reference for this location, which is also the predecessor (downscaled).')
    expect(prompt).toContain('Image 3: the canonical identity card for characterKey=hero, who is listed in this panel\'s characterKeys.')
    expect(prompt).toContain('Image 4: the canonical identity card for characterKey=rival, who is in the scene roster but absent from this panel\'s characterKeys and must not appear.')
    expect(prompt).toContain('chosen from the human trusted-anchor label 1')
    expect(prompt).toContain('characterKeys, exact and authoritative: hero.')
    expect(prompt).toContain('Scene roster, every character who appears somewhere in this scene: hero, rival.')
    expect(prompt).toContain('Roster characters absent from this panel who must not appear: rival.')
    expect(prompt).toContain('Shot plan: Medium eye-level shot 2; hero is screen left facing right at the control booth.')
    expect(prompt).toContain('cargo-bay: a loading door stays left of a fixed control booth.')
    expect(prompt).toContain('hero: Test hero in a blue uniform | rival: Test rival in a red coat')
    expect(prompt).toContain('Judge screen sides in screen space against the anchor panel.')
    expect(prompt).toContain('Return only the requested JSON.')
    const noPredecessor = buildContinuityJudgePrompt(judgeRequest({ panelNumber: 1, panelPath: '/scene/panels/panel-01.png', predecessorPanel: null, predecessorPath: null }))
    expect(noPredecessor).toContain('The candidate is itself the anchor panel 1')
    expect(noPredecessor).toContain('has no predecessor in its location segment')
    expect(noPredecessor).toContain('No human trusted-anchor label was supplied, so the scene\'s first panel of this location, panel 1, is the anchor by default.')
    const otherLocation = buildContinuityJudgePrompt(judgeRequest({ trustedAnchorPanel: 4 }))
    expect(otherLocation).toContain('The human trusted-anchor label names panel 4, which is in a different location, so the scene\'s first panel of this location, panel 1, is the anchor.')
    expect(otherLocation).not.toContain('location segment')
  })

  test('downscales comparison panels in memory to 768 px wide without enlarging small images', async () => {
    const large = await new Bun.Image(tinyPng).resize(1536, 1024).png().bytes()
    expect((await new Bun.Image(large).metadata()).width).toBe(1536)
    const downscaled = await downscaleImageForContinuityJudge(large)
    expect(downscaled).toMatchObject({ mimeType: 'image/jpeg', width: CONTINUITY_JUDGE_DOWNSCALE_WIDTH, height: 512, sourceWidth: 1536, sourceHeight: 1024 })
    expect(Buffer.from(downscaled.base64, 'base64')).toEqual(Buffer.from(downscaled.bytes))
    const small = await downscaleImageForContinuityJudge(tinyPng)
    expect(small).toMatchObject({ width: 1, height: 1, sourceWidth: 1, sourceHeight: 1 })
  })

  test('prepares judge images from disk with the candidate and cards at native size', async () => {
    const directory = await makeTempDir('autoshow-continuity-images-')
    temporaryDirectories.push(directory)
    const large = await new Bun.Image(tinyPng).resize(1536, 1024).png().bytes()
    const candidate = join(directory, 'panel-02.png')
    const anchor = join(directory, 'panel-01.png')
    const card = join(directory, 'hero.png')
    await Bun.write(candidate, large)
    await Bun.write(anchor, large)
    await Bun.write(card, tinyPng)
    const images = await prepareContinuityJudgeImages(judgeRequest({ panelPath: candidate, anchorPath: anchor, predecessorPath: anchor, castCards: [{ key: 'hero', path: card }], absentCards: [{ key: 'rival', path: card }] }))
    expect(images.map(image => [image.role, image.mimeType, image.width, image.height, image.downscaled, image.detail])).toEqual([
      ['candidate', 'image/png', 1536, 1024, false, 'high'],
      ['anchor', 'image/jpeg', 768, 512, true, 'low'],
      ['cast-card', 'image/png', 1, 1, false, 'high'],
      ['absent-card', 'image/png', 1, 1, false, 'low'],
    ])
    expect(images[0]?.base64).toBe(Buffer.from(large).toString('base64'))
  })
})

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

describe('QA-only continuity price estimate', () => {
  test('prices one 9,000-input, 1,500-output unit call per panel on the QA model and drops page judge calls under --continuity-only', async () => {
    const sceneSlug = `continuity-price-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug, [{ number: 1, characterKeys: ['hero', 'rival'] }, { number: 2, characterKeys: ['hero'] }, { number: 3, characterKeys: ['hero'] }])
    expect(CONTINUITY_ESTIMATED_INPUT_UNITS_PER_PANEL).toBe(9000)
    expect(CONTINUITY_ESTIMATED_OUTPUT_UNITS_PER_PANEL).toBe(1500)
    const only = await captureLogEvents(async () => {
      await estimateQaOnlyPanelAuditPrice({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, continuityQa: true, continuityOnly: true })
    })
    expect(only.events.every(event => event.category === 'pricing')).toBe(true)
    const onlyDetails = only.events.find(event => event.message === 'Comic - Price Estimate: generate-images (QA-only)')
    expect(onlyDetails?.metadata).toMatchObject({ mode: 'qa-only', canonicalPanels: 3, judgeModel: JUDGE_MODEL, judgeCalls: 0, pageJudgeCalls: 0, continuityQa: true, continuityOnly: true, continuityJudgeCalls: 3, continuityInputUnits: 27_000, continuityOutputUnits: 4_500, imageGenerationCalls: 0, imageRepairCalls: 0 })
    expect(onlyDetails?.metadata?.['continuityCost']).toBeCloseTo(0.27, 10)
    expect(onlyDetails?.metadata?.['estimatedTotal']).toBeCloseTo(0.27, 10)
    expect((onlyDetails?.metadata?.['details'] as Record<string, unknown>)['Continuity judge calls']).toBe(3)
    expect((onlyDetails?.metadata?.['details'] as Record<string, unknown>)['Heuristic continuity units']).toBe('27,000 input + 4,500 output')
    expect(only.events.some(event => event.message === 'Total: ~$0.27')).toBe(true)
    expect(only.events.some(event => event.message.startsWith('QA-only price mode performs no provider calls or writes'))).toBe(true)

    const beside = await captureLogEvents(async () => {
      await estimateQaOnlyPanelAuditPrice({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, panels: [2, 3], continuityQa: true })
    })
    const besideDetails = beside.events.find(event => event.message === 'Comic - Price Estimate: generate-images (QA-only)')
    expect(besideDetails?.metadata).toMatchObject({ canonicalPanels: 2, judgeCalls: 2, pageJudgeCalls: 2, continuityOnly: false, continuityJudgeCalls: 2, continuityInputUnits: 18_000, continuityOutputUnits: 3_000 })
    expect(besideDetails?.metadata?.['estimatedTotal']).toBeCloseTo(0.302, 10)
    expect(beside.events.some(event => event.message === 'Total: ~$0.30')).toBe(true)

    const plain = await captureLogEvents(async () => {
      await estimateQaOnlyPanelAuditPrice({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, panels: [2] })
    })
    const plainDetails = plain.events.find(event => event.message === 'Comic - Price Estimate: generate-images (QA-only)')
    expect(plainDetails?.metadata).toMatchObject({ judgeCalls: 1 })
    expect(plainDetails?.metadata?.['continuityJudgeCalls']).toBeUndefined()
    expect(plain.events.some(event => event.message === 'Total: ~$0.06')).toBe(true)
  })
})
