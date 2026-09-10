import { mkdir, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { ValidationError } from '~/utils/error-handler'
import type { ContinuityAuditContext, ContinuityAuditInput, ContinuityAuditPlan, ContinuityAuditPlanBundle, ContinuityAuditPlanPanel, ContinuityAuditPlanSegment, ContinuityAuditReport, ContinuityBlooperCategory, ContinuityFurnitureStatus, ContinuityHardKey, ContinuityJudgeEntry, ContinuityJudgeRequest, ContinuityLabelsFile, ContinuityLedger, ContinuityPageQaEntry, ContinuityPanelOutcome, ContinuityStageState, PageQaEntry, QaOnlyContinuityAudit } from '~/types'
import { getPanelPromptsDirectory, getSceneOutputDirectory } from './project-paths'
import { extractPanelBundleData, formatPanelDirectoryName, getPanelNumberFromName, getPromptBundleFilename, resolveScenePanelDirectories } from './panel-prompt-utils'
import { getPanelComicImagePath } from './scene-utils'
import { loadAndVerifyCharacterReferenceSnapshot } from './character-reference-snapshot'
import { resolveCharacterIdentityReferences } from './character-identity-card'
import { readReusablePageQaEntry } from '../comic-commands/generate-images/comic-page-qa'
import { CONTINUITY_BLOOPER_CATEGORIES, CONTINUITY_FURNITURE_STATUSES, CONTINUITY_HARD_KEYS, CONTINUITY_QA_SCHEMA_VERSION } from '../comic-commands/generate-images/continuity-qa'
import { joinContinuityLabels, readContinuityLabels } from './continuity-labels'

export const CONTINUITY_AUDIT_REPORT_SCHEMA_VERSION = 1 as const

export const getContinuityAuditDirectory = (sceneSlug: string, runId: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'qa', `continuity-audit-${runId}`)

export const getContinuityPanelReportFilename = (panelNumber: number): string => `${formatPanelDirectoryName(panelNumber)}-continuity.json`

export const loadContinuityAuditBundles = async (sceneSlug: string): Promise<ContinuityAuditPlanBundle[]> => {
  const panelPromptsDirectory = getPanelPromptsDirectory(sceneSlug)
  const entries = resolveScenePanelDirectories(await readdir(panelPromptsDirectory, { withFileTypes: true }), panelPromptsDirectory)
  const bundles: ContinuityAuditPlanBundle[] = []
  for (const entry of entries) {
    const panelNumber = getPanelNumberFromName(entry.name)
    if (!panelNumber) continue
    const panelDirectory = join(panelPromptsDirectory, entry.name)
    const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
    const bundleData = extractPanelBundleData(await Bun.file(join(panelDirectory, getPromptBundleFilename(panelDirectory, panelEntries))).text())
    bundles.push({ panelNumber, bundleData })
  }
  return bundles.sort((a, b) => a.panelNumber - b.panelNumber)
}

const uniqueInOrder = (values: Iterable<string>): string[] => {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    ordered.push(value)
  }
  return ordered
}

export const deriveContinuityAuditPlan = (bundles: ReadonlyArray<ContinuityAuditPlanBundle>, options: { trustedAnchorPanel?: number | null | undefined } = {}): ContinuityAuditPlan => {
  if (bundles.length === 0) throw ValidationError('Continuity audit requires at least one panel bundle.', { stage: 'comic:continuity-qa' })
  const ordered = [...bundles].sort((a, b) => a.panelNumber - b.panelNumber)
  const panelNumbers = ordered.map(bundle => bundle.panelNumber)
  if (new Set(panelNumbers).size !== panelNumbers.length) throw ValidationError('Continuity audit received duplicate panel numbers.', { stage: 'comic:continuity-qa' })
  const trustedAnchorPanel = options.trustedAnchorPanel ?? null
  if (trustedAnchorPanel !== null && !panelNumbers.includes(trustedAnchorPanel)) {
    throw ValidationError(`Trusted anchor panel ${trustedAnchorPanel} is not a panel of this scene (panels ${panelNumbers[0]} through ${panelNumbers[panelNumbers.length - 1]}).`, { stage: 'comic:continuity-qa' })
  }
  const roster = uniqueInOrder(ordered.flatMap(bundle => bundle.bundleData.panels.flatMap(panel => panel.characterKeys)))
  const panelOf = (bundle: ContinuityAuditPlanBundle) => {
    const panel = bundle.bundleData.panels[0]
    if (!panel) throw ValidationError(`Panel ${bundle.panelNumber} bundle is missing its panel payload.`, { stage: 'comic:continuity-qa' })
    return panel
  }
  // Anchors are keyed by location, not by contiguous run: the human trusted panel anchors every panel of its location scene-wide, and a location without a trusted panel anchors on its first panel in scene order, so a scene that leaves a location and returns to it keeps the same anchor for the return segment.
  const anchorByLocation = new Map<string, number>()
  const trustedBundle = trustedAnchorPanel === null ? undefined : ordered.find(bundle => bundle.panelNumber === trustedAnchorPanel)
  if (trustedBundle) anchorByLocation.set(panelOf(trustedBundle).locationKey, trustedBundle.panelNumber)
  const segments: ContinuityAuditPlanSegment[] = []
  const panelSegments = new Map<number, ContinuityAuditPlanSegment>()
  for (const bundle of ordered) {
    const panel = panelOf(bundle)
    if (!anchorByLocation.has(panel.locationKey)) anchorByLocation.set(panel.locationKey, bundle.panelNumber)
    const current = segments[segments.length - 1]
    const segment = current && current.locationKey === panel.locationKey
      ? current
      : (() => { const created: ContinuityAuditPlanSegment = { index: segments.length, locationKey: panel.locationKey, panelNumbers: [], anchorPanel: anchorByLocation.get(panel.locationKey)! }; segments.push(created); return created })()
    segment.panelNumbers.push(bundle.panelNumber)
    panelSegments.set(bundle.panelNumber, segment)
  }
  const panels: ContinuityAuditPlanPanel[] = []
  let previous: { panelNumber: number; segmentIndex: number; characterKeys: string[] } | undefined
  for (const bundle of ordered) {
    const panel = bundle.bundleData.panels[0]!
    const segment = panelSegments.get(bundle.panelNumber)!
    const characterKeys = uniqueInOrder(panel.characterKeys)
    const sameSegment = previous !== undefined && previous.segmentIndex === segment.index
    const previousKeys = sameSegment && previous ? previous.characterKeys : []
    panels.push({
      panelNumber: bundle.panelNumber,
      segmentIndex: segment.index,
      locationKey: panel.locationKey,
      characterKeys,
      absentKeys: roster.filter(key => !characterKeys.includes(key)),
      sourceSegmentIds: [...panel.sourceSegmentIds],
      entered: characterKeys.filter(key => !previousKeys.includes(key)),
      exited: previousKeys.filter(key => !characterKeys.includes(key)),
      anchorPanel: segment.anchorPanel,
      predecessorPanel: sameSegment && previous ? previous.panelNumber : null,
    })
    previous = { panelNumber: bundle.panelNumber, segmentIndex: segment.index, characterKeys }
  }
  return {
    schemaVersion: 1,
    trustedAnchorPanel,
    anchorPanel: trustedAnchorPanel ?? panelNumbers[0]!,
    roster,
    segments,
    panels,
  }
}

const zeroRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> => Object.fromEntries(keys.map(key => [key, 0])) as Record<TKey, number>

export const createContinuityLedger = (): ContinuityLedger => ({
  judged: 0,
  hardFailures: 0,
  byKey: zeroRecord<ContinuityHardKey>(CONTINUITY_HARD_KEYS),
  byCategory: zeroRecord<ContinuityBlooperCategory>(CONTINUITY_BLOOPER_CATEGORIES),
  axisCrossed: 0,
  furnitureVersusAnchor: zeroRecord<ContinuityFurnitureStatus>(CONTINUITY_FURNITURE_STATUSES),
  usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
})

export const mergeContinuityLedger = (ledger: ContinuityLedger, entry: ContinuityJudgeEntry): ContinuityLedger => {
  const byKey = { ...ledger.byKey }
  for (const key of new Set(entry.hardKeys)) byKey[key] = (byKey[key] ?? 0) + 1
  const byCategory = { ...ledger.byCategory }
  byCategory[entry.result.blooperCategory] = (byCategory[entry.result.blooperCategory] ?? 0) + 1
  const furnitureVersusAnchor = { ...ledger.furnitureVersusAnchor }
  furnitureVersusAnchor[entry.result.furnitureOrientation.versusAnchor] = (furnitureVersusAnchor[entry.result.furnitureOrientation.versusAnchor] ?? 0) + 1
  return {
    judged: ledger.judged + 1,
    hardFailures: ledger.hardFailures + (entry.hardKeys.length > 0 ? 1 : 0),
    byKey,
    byCategory,
    axisCrossed: ledger.axisCrossed + (entry.result.axisStatus === 'crossed' ? 1 : 0),
    furnitureVersusAnchor,
    usage: {
      inputTokens: ledger.usage.inputTokens + entry.usage.inputTokens,
      outputTokens: ledger.usage.outputTokens + entry.usage.outputTokens,
      totalTokens: ledger.usage.totalTokens + entry.usage.totalTokens,
      costUsd: ledger.usage.costUsd + entry.usage.costUsd,
    },
  }
}

export const mergeContinuityEntries = (entries: ReadonlyArray<ContinuityJudgeEntry>): ContinuityLedger =>
  [...entries].sort((a, b) => a.panelNumber - b.panelNumber).reduce(mergeContinuityLedger, createContinuityLedger())

export const buildContinuityPanelOutcomes = (
  plan: ContinuityAuditPlan,
  entries: ReadonlyArray<ContinuityJudgeEntry>,
  errors: ReadonlyArray<{ panelNumber: number; error: string }> = [],
  selection?: ReadonlyArray<number>,
): ContinuityPanelOutcome[] => {
  const byPanel = new Map(entries.map(entry => [entry.panelNumber, entry]))
  const errorByPanel = new Map(errors.map(item => [item.panelNumber, item.error]))
  const selected = selection ? new Set(selection) : undefined
  return plan.panels
    .filter(panel => !selected || selected.has(panel.panelNumber))
    .map(panel => {
      const entry = byPanel.get(panel.panelNumber)
      return {
        panelNumber: panel.panelNumber,
        segmentIndex: panel.segmentIndex,
        anchorPanel: entry?.anchorPanel ?? panel.anchorPanel,
        predecessorPanel: entry ? entry.predecessorPanel : panel.predecessorPanel,
        judged: entry !== undefined,
        hardKeys: entry?.hardKeys ?? [],
        blooperCategory: entry?.result.blooperCategory ?? null,
        axisStatus: entry?.result.axisStatus ?? null,
        furnitureVersusAnchor: entry?.result.furnitureOrientation.versusAnchor ?? null,
        repairRoute: entry?.result.repairRoute ?? null,
        observedStageState: entry?.result.observedStageState ?? null,
        notes: entry?.result.notes ?? null,
        error: errorByPanel.get(panel.panelNumber) ?? null,
      }
    })
}

export const buildContinuityAuditReport = (input: {
  sceneSlug: string
  runId: string
  judgeModel: string
  plan: ContinuityAuditPlan
  entries: ReadonlyArray<ContinuityJudgeEntry>
  errors?: ReadonlyArray<{ panelNumber: number; error: string }> | undefined
  selection?: ReadonlyArray<number> | undefined
  labels?: ContinuityLabelsFile | null | undefined
}): ContinuityAuditReport => ({
  schemaVersion: CONTINUITY_AUDIT_REPORT_SCHEMA_VERSION,
  sceneSlug: input.sceneSlug,
  runId: input.runId,
  judgeModel: input.judgeModel,
  anchorPanel: input.plan.anchorPanel,
  trustedAnchorPanel: input.plan.trustedAnchorPanel,
  roster: [...input.plan.roster],
  segments: input.plan.segments.map(segment => ({ ...segment, panelNumbers: [...segment.panelNumbers] })),
  ledger: mergeContinuityEntries(input.entries),
  panels: buildContinuityPanelOutcomes(input.plan, input.entries, input.errors ?? [], input.selection),
  labels: input.labels ? joinContinuityLabels(input.labels, input.entries) : null,
})

export const buildContinuityStageState = (sceneSlug: string, plan: ContinuityAuditPlan, entries: ReadonlyArray<ContinuityJudgeEntry>): ContinuityStageState => {
  const byPanel = new Map(entries.map(entry => [entry.panelNumber, entry]))
  return {
    schemaVersion: 1,
    sceneSlug,
    anchorPanel: plan.anchorPanel,
    trustedAnchorPanel: plan.trustedAnchorPanel,
    roster: [...plan.roster],
    segments: plan.segments.map(segment => ({ ...segment, panelNumbers: [...segment.panelNumbers] })),
    panels: plan.panels.map(panel => ({ ...panel, observedStageState: byPanel.get(panel.panelNumber)?.result.observedStageState ?? null })),
  }
}

const cell = (value: string | number | null | undefined): string => value === null || value === undefined || value === '' ? 'none' : String(value).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()

const formatCounts = (record: Record<string, number>): string => Object.entries(record).map(([key, count]) => `${key}=${count}`).join(', ')

const formatRatio = (value: number | null): string => value === null ? 'n/a' : value.toFixed(4)

const describeSegmentAnchor = (report: ContinuityAuditReport, segment: ContinuityAuditPlanSegment): string => {
  if (segment.anchorPanel === report.trustedAnchorPanel) return ' (human trusted label)'
  if (segment.panelNumbers.includes(segment.anchorPanel)) return ''
  const owner = report.segments.find(candidate => candidate.panelNumbers.includes(segment.anchorPanel))
  return owner ? ` (shared with segment ${owner.index + 1})` : ''
}

export const renderContinuityReportMarkdown = (report: ContinuityAuditReport): string => {
  const lines: string[] = []
  lines.push('# Continuity Audit Report')
  lines.push('')
  lines.push(`Scene: ${report.sceneSlug}; judge model: ${report.judgeModel}; run: ${report.runId}.`)
  lines.push(`Anchor panel: ${report.anchorPanel}; trusted anchor label: ${report.trustedAnchorPanel ?? 'none'}.`)
  lines.push(`Roster: ${report.roster.join(', ') || 'none'}.`)
  lines.push(`Judged panels: ${report.ledger.judged}; panels with at least one implied continuity key: ${report.ledger.hardFailures}.`)
  lines.push(`Implied keys: ${formatCounts(report.ledger.byKey)}.`)
  lines.push(`Blooper categories: ${formatCounts(report.ledger.byCategory)}.`)
  lines.push(`Axis crossed: ${report.ledger.axisCrossed}; furniture versus anchor: ${formatCounts(report.ledger.furnitureVersusAnchor)}.`)
  lines.push(`Judge usage: ${report.ledger.usage.totalTokens} tokens; $${report.ledger.usage.costUsd.toFixed(4)}.`)
  lines.push('Every implied key is an audit finding for the Phase 0 baseline; no continuity key is a hard generation failure until its precision gate passes.')
  lines.push('')
  lines.push('## Segments')
  lines.push('')
  for (const segment of report.segments) {
    lines.push(`- Segment ${segment.index + 1}: ${segment.locationKey}, panels ${segment.panelNumbers.join(', ')}, anchor ${segment.anchorPanel}${describeSegmentAnchor(report, segment)}.`)
  }
  lines.push('')
  lines.push('## Panels')
  lines.push('')
  lines.push('| Panel | Anchor | Predecessor | Implied keys | Category | Axis | Furniture vs anchor | Repair route | Observed stage state | Notes |')
  lines.push('|---:|---:|---:|:---|:---|:---|:---|:---|:---|:---|')
  for (const panel of report.panels) {
    const status = panel.error ? `error: ${panel.error}` : panel.judged ? panel.notes : 'not judged'
    lines.push(`| ${panel.panelNumber} | ${panel.anchorPanel} | ${cell(panel.predecessorPanel)} | ${panel.hardKeys.length > 0 ? panel.hardKeys.join(', ') : 'none'} | ${cell(panel.blooperCategory)} | ${cell(panel.axisStatus)} | ${cell(panel.furnitureVersusAnchor)} | ${cell(panel.repairRoute)} | ${cell(panel.observedStageState)} | ${cell(status)} |`)
  }
  lines.push('')
  if (report.labels) {
    lines.push('## Labels')
    lines.push('')
    lines.push(`Labeler: ${report.labels.labeler}; date: ${report.labels.date}; labeled pairs: ${report.labels.labeledPairs}; matched pairs: ${report.labels.matchedPairs}; unmatched pairs: ${report.labels.unmatchedPairs.length}.`)
    lines.push('A pair matches when its candidate panel was judged against the reference panel as anchor or predecessor. The judge is positive for a key when the candidate\'s blooperCategory names it or its cast audit implies it (intruding for intruder, vanished for vanishing-crowd); axis status and furniture orientation feed the implied-key counters above but never the labels join.')
    lines.push('')
    lines.push('| Key | True positives | False positives | False negatives | True negatives | Precision | Recall |')
    lines.push('|:---|---:|---:|---:|---:|---:|---:|')
    for (const metrics of report.labels.byKey) {
      lines.push(`| ${metrics.key} | ${metrics.truePositives} | ${metrics.falsePositives} | ${metrics.falseNegatives} | ${metrics.trueNegatives} | ${formatRatio(metrics.precision)} | ${formatRatio(metrics.recall)} |`)
    }
    lines.push('')
    if (report.labels.unmatchedPairs.length > 0) {
      for (const pair of report.labels.unmatchedPairs) {
        lines.push(`- Unmatched pair [${pair.panels[0]}, ${pair.panels[1]}]: ${pair.reason}.`)
      }
      lines.push('')
    }
  }
  const errors = report.panels.filter(panel => panel.error)
  if (errors.length > 0) {
    lines.push('## Errors')
    lines.push('')
    for (const panel of errors) lines.push(`- Panel ${panel.panelNumber}: ${cell(panel.error)}`)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

export const writeContinuityAuditArtifacts = async (directory: string, input: {
  report: ContinuityAuditReport
  stageState: ContinuityStageState
  entries: ReadonlyArray<ContinuityJudgeEntry>
}): Promise<{ reportJsonPath: string; reportMarkdownPath: string; stageStatePath: string; panelReportPaths: string[] }> => {
  await mkdir(directory, { recursive: true })
  const stageStatePath = join(directory, 'stage-state.json')
  const reportJsonPath = join(directory, 'continuity-report.json')
  const reportMarkdownPath = join(directory, 'continuity-report.md')
  await Bun.write(stageStatePath, `${JSON.stringify(input.stageState, null, 2)}\n`)
  await Bun.write(reportJsonPath, `${JSON.stringify(input.report, null, 2)}\n`)
  await Bun.write(reportMarkdownPath, renderContinuityReportMarkdown(input.report))
  const panelReportPaths: string[] = []
  for (const entry of [...input.entries].sort((a, b) => a.panelNumber - b.panelNumber)) {
    const path = join(directory, getContinuityPanelReportFilename(entry.panelNumber))
    await Bun.write(path, `${JSON.stringify(entry, null, 2)}\n`)
    panelReportPaths.push(path)
  }
  return { reportJsonPath, reportMarkdownPath, stageStatePath, panelReportPaths }
}

export const buildQaOnlyContinuityExtension = (report: ContinuityAuditReport, directory: string, sceneSlug: string): QaOnlyContinuityAudit => ({
  judged: report.ledger.judged,
  hardFailures: report.ledger.hardFailures,
  byKey: { ...report.ledger.byKey },
  anchorPanel: report.anchorPanel,
  trustedAnchorPanel: report.trustedAnchorPanel,
  reportDirectory: relative(getSceneOutputDirectory(sceneSlug), directory).replace(/\\/g, '/'),
})

export const attachContinuityToPageQaEntry = (entry: PageQaEntry, continuity: ContinuityJudgeEntry): ContinuityPageQaEntry => ({
  ...entry,
  continuity: {
    schemaVersion: CONTINUITY_QA_SCHEMA_VERSION,
    judgeModel: continuity.judgeModel,
    anchorPanel: continuity.anchorPanel,
    predecessorPanel: continuity.predecessorPanel,
    hardKeys: [...continuity.hardKeys],
    blooperCategory: continuity.result.blooperCategory,
  },
})

export const isPageQaEntryReusableWithContinuity = (entry: PageQaEntry | undefined, options: { continuityRequired: boolean }): entry is ContinuityPageQaEntry => {
  if (!entry) return false
  if (!options.continuityRequired) return true
  const continuity = (entry as ContinuityPageQaEntry).continuity
  return !!continuity && typeof continuity === 'object' && continuity.schemaVersion === CONTINUITY_QA_SCHEMA_VERSION && Array.isArray(continuity.hardKeys) && typeof continuity.blooperCategory === 'string'
}

export const readReusablePageQaEntryForAudit = async (pagePath: string, model: string, options: { continuityRequired: boolean }): Promise<ContinuityPageQaEntry | undefined> => {
  const entry = await readReusablePageQaEntry(pagePath, model)
  return isPageQaEntryReusableWithContinuity(entry, options) ? entry : undefined
}

export const loadContinuityAuditContext = async (
  sceneSlug: string,
  inputs: ReadonlyArray<ContinuityAuditInput>,
  options: { trustedAnchorPanel?: number | null | undefined; labelsPath?: string | undefined; judgeModel: string; composeCards?: boolean | undefined },
): Promise<ContinuityAuditContext> => {
  const bundles = await loadContinuityAuditBundles(sceneSlug)
  const labels = options.labelsPath ? await readContinuityLabels(options.labelsPath, { sceneSlug }) : null
  const trustedAnchorPanel = options.trustedAnchorPanel ?? labels?.trustedAnchorPanel ?? null
  const plan = deriveContinuityAuditPlan(bundles, { trustedAnchorPanel })
  const runDirectory = getSceneOutputDirectory(sceneSlug)
  const firstBundle = bundles[0]
  if (!firstBundle) throw ValidationError('Continuity audit requires at least one panel bundle.', { stage: 'comic:continuity-qa' })
  const manifest = loadAndVerifyCharacterReferenceSnapshot(runDirectory, firstBundle.bundleData.snapshotId)
  const compose = options.composeCards !== false
  const failures: string[] = []
  const requests: ContinuityJudgeRequest[] = []
  for (const input of inputs) {
    const planPanel = plan.panels.find(panel => panel.panelNumber === input.panelNumber)
    if (!planPanel) {
      failures.push(`panel ${input.panelNumber}: not present in the scene's panel bundles`)
      continue
    }
    const anchorPath = getPanelComicImagePath(sceneSlug, planPanel.anchorPanel)
    const predecessorPath = planPanel.predecessorPanel === null ? null : getPanelComicImagePath(sceneSlug, planPanel.predecessorPanel)
    const required = [anchorPath, ...(predecessorPath ? [predecessorPath] : [])]
    const missing = (await Promise.all(required.map(async path => await Bun.file(path).exists() ? undefined : path))).filter((path): path is string => !!path)
    if (missing.length > 0) {
      failures.push(`panel ${input.panelNumber}: missing continuity comparison panel(s) ${missing.join(', ')}`)
      continue
    }
    let absentCards: ContinuityJudgeRequest['absentCards'] = []
    let absentReferences: ContinuityJudgeRequest['characterReferences'] = []
    try {
      const references = resolveCharacterIdentityReferences(runDirectory, manifest, planPanel.absentKeys, { compose })
      absentCards = references.map(reference => ({ key: reference.key, path: reference.path }))
      absentReferences = references.map(reference => ({ key: reference.key, description: reference.description }))
    } catch (error) {
      failures.push(`panel ${input.panelNumber}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    const castReferences = input.references.characterReferences ?? []
    const castCards = castReferences.length > 0
      ? castReferences.map(reference => ({ key: reference.key, path: reference.path }))
      : planPanel.characterKeys.map((key, index) => ({ key, path: input.references.primaryCharacterRefs[index] ?? '' })).filter(card => card.path.length > 0)
    requests.push({
      sceneSlug,
      panelNumber: input.panelNumber,
      panelPath: input.panelPath,
      anchorPanel: planPanel.anchorPanel,
      anchorPath,
      predecessorPanel: planPanel.predecessorPanel,
      predecessorPath,
      trustedAnchorPanel: plan.trustedAnchorPanel,
      panelData: input.bundleData,
      roster: [...plan.roster],
      absentKeys: [...planPanel.absentKeys],
      castCards,
      absentCards,
      characterReferences: [...castReferences.map(reference => ({ key: reference.key, description: reference.description })), ...absentReferences],
      locationReferences: (input.references.locationReferences ?? []).map(reference => ({ key: reference.key, specification: reference.specification })),
      model: options.judgeModel,
    })
  }
  if (failures.length > 0) throw ValidationError(`Continuity audit preflight failed before any provider calls:\n- ${failures.join('\n- ')}`, { stage: 'comic:continuity-qa' })
  return { plan, labels, requests, runDirectory }
}
