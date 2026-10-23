import { AppValidationError, AppUsageError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import * as v from 'valibot'
import { PROJECT_ROOT } from '~/utils/project-root'
import { buildBcOcrReports, inspectBcOcrReports, type BcOcrReportOptions } from './ocr-categories-bc-report'
import { writePortableFileSync } from '../../.codex/skills/consensus/scripts/shared/portable_paths'

export const NEWSPAPER_REPORT_ROOT = 'input/examples/document/ocr-newspaper-expansion'
export const NEWSPAPER_EXECUTION_REPORT = 'docs/reports/ocr-newspaper-expansion-2026-10-23.md'
export type NewspaperReportOptions = Omit<BcOcrReportOptions, 'reportProfile'>
export type NewspaperPanel = 'whole-page-layout' | 'region-recognition' | 'very-long-page-capacity'
type Group = 'local' | 'thirdPartyService'
type Status = 'succeeded' | 'failed' | 'missing' | 'running'
export interface NewspaperOutcome { providerKey: string, status: Status, score: number | null, failureKind?: string,
  tokenMultiset?: v.InferOutput<typeof multisetSchema>, repetition?: v.InferOutput<typeof repetitionSchema> }
export interface NewspaperScoredCase { id: string, panel: NewspaperPanel, outcomes: NewspaperOutcome[] }
export interface NewspaperTarget { provider: string, model: string }
const panels: NewspaperPanel[] = ['whole-page-layout', 'region-recognition', 'very-long-page-capacity']
const panelLabels: Record<NewspaperPanel, string> = {
  'whole-page-layout': 'Whole publication pages', 'region-recognition': 'Exact region recognition', 'very-long-page-capacity': 'Very long page / capacity'
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const mean = (values: readonly number[]): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
const key = (target: NewspaperTarget): string => `${target.provider}/${target.model}`
const nonempty = v.pipe(v.string(), v.nonEmpty())
const planSchema = v.object({
  cases: v.array(v.object({ id: nonempty, scope: v.picklist(['full-page', 'region-crop']), runDir: nonempty,
    reference: nonempty, referenceSha256: nonempty, normalizedReference: nonempty, normalizedReferenceSha256: nonempty })),
  targets: v.array(v.object({ provider: nonempty, model: nonempty }))
})
const secondarySchema = v.object({ variant: v.literal('era-reviewed-spacing-equivalence-v1'), primaryMetricsUnchanged: v.literal(true),
  referenceConventionSpans: v.pipe(v.number(), v.integer(), v.minValue(0)), candidateConventionSpans: v.pipe(v.number(), v.integer(), v.minValue(0)),
  referenceTokens: v.pipe(v.number(), v.integer(), v.minValue(1)), candidateTokens: v.pipe(v.number(), v.integer(), v.minValue(0)),
  wordEdits: v.pipe(v.number(), v.integer(), v.minValue(0)), wordErrorRate: v.pipe(v.number(), v.finite(), v.minValue(0)),
  qualityScore: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100)) })
const fraction = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1))
const count = v.pipe(v.number(), v.integer(), v.minValue(0))
const multisetSchema = v.object({ referenceTokenCount: v.pipe(count, v.minValue(1)), candidateTokenCount: count,
  matchedTokenCount: count, missingTokenCount: count, unmatchedTokenCount: count, precision: fraction, recall: fraction, f1: fraction })
const repetitionCountsSchema = v.object({ nonemptyLogicalLines: count, uniqueLogicalLines: count, duplicateLineOccurrences: count,
  repeatedLineKinds: count, maximumIdenticalLineOccurrences: count, maximumConsecutiveIdenticalLineRun: count })
const repetitionSchema = v.object({ reference: repetitionCountsSchema, candidate: repetitionCountsSchema })

export const newspaperChallengePanel = (id: string, scope: string): NewspaperPanel => id.includes('new-york-times')
  ? 'very-long-page-capacity' : scope === 'full-page' ? 'whole-page-layout' : 'region-recognition'

/** Compare scores on common source inputs; never fill a missing result with zero. */
export const summarizeNewspaperPanels = (cases: readonly NewspaperScoredCase[], targets: readonly NewspaperTarget[]) => {
  const targetKeys = targets.map(key)
  if (!targetKeys.length || new Set(targetKeys).size !== targetKeys.length || new Set(cases.map(row => row.id)).size !== cases.length) throw new AppValidationError('Duplicate or empty newspaper cohort identities')
  for (const row of cases) {
    if (!panels.includes(row.panel) || row.outcomes.length !== targets.length || new Set(row.outcomes.map(outcome => outcome.providerKey)).size !== targets.length
      || row.outcomes.some(outcome => !targetKeys.includes(outcome.providerKey))) throw new AppValidationError('Newspaper outcomes differ from the selected matrix')
    for (const outcome of row.outcomes) {
      if (!['succeeded', 'failed', 'missing', 'running'].includes(outcome.status)
        || outcome.status === 'succeeded' && (outcome.score === null || !Number.isFinite(outcome.score) || outcome.score < 0 || outcome.score > 100)
        || outcome.status !== 'succeeded' && outcome.score !== null) throw new AppValidationError('Incomplete newspaper output cannot receive a quality score')
    }
  }
  const outcome = (row: NewspaperScoredCase, providerKey: string): NewspaperOutcome => row.outcomes.find(value => value.providerKey === providerKey)!
  return panels.map(panel => {
    const selected = cases.filter(row => row.panel === panel)
    const groups = (['local', 'thirdPartyService'] as const).map(group => {
      const selectedTargets = targets.filter(target => (target.provider === 'tesseract' ? 'local' : 'thirdPartyService') === group)
      const matched = selected.filter(row => selectedTargets.length > 0 && selectedTargets.every(target => outcome(row, key(target)).status === 'succeeded'))
      const models = selectedTargets.map(target => {
        const providerKey = key(target), values = selected.map(row => outcome(row, providerKey))
        const completed = values.filter(value => value.status === 'succeeded')
        return { providerKey, group: group as Group, expectedInputs: selected.length,
          attemptedInputs: values.filter(value => value.status !== 'missing').length,
          completedInputs: completed.length, failedInputs: values.filter(value => value.status === 'failed').length,
          notDispatchedInputs: values.filter(value => value.status === 'missing').length,
          runningInputs: values.filter(value => value.status === 'running').length,
          completionRate: selected.length ? completed.length / selected.length : null,
          meanScoreOnCompletedInputs: mean(completed.map(value => value.score!)),
          matchedInputCount: matched.length, matchedMeanScore: mean(matched.map(row => outcome(row, providerKey).score!)),
          meanTokenF1OnCompletedInputs: completed.every(value => value.tokenMultiset) ? mean(completed.map(value => value.tokenMultiset!.f1)) : null,
          meanTokenPrecisionOnCompletedInputs: completed.every(value => value.tokenMultiset) ? mean(completed.map(value => value.tokenMultiset!.precision)) : null,
          meanTokenRecallOnCompletedInputs: completed.every(value => value.tokenMultiset) ? mean(completed.map(value => value.tokenMultiset!.recall)) : null,
          matchedTokenF1: matched.every(row => outcome(row, providerKey).tokenMultiset) ? mean(matched.map(row => outcome(row, providerKey).tokenMultiset!.f1)) : null,
          matchedTokenPrecision: matched.every(row => outcome(row, providerKey).tokenMultiset) ? mean(matched.map(row => outcome(row, providerKey).tokenMultiset!.precision)) : null,
          matchedTokenRecall: matched.every(row => outcome(row, providerKey).tokenMultiset) ? mean(matched.map(row => outcome(row, providerKey).tokenMultiset!.recall)) : null,
          matchedRank: null as number | null,
          failureKinds: values.filter(value => value.status === 'failed').reduce<Record<string, number>>((counts, value) => {
            const failure = value.failureKind ?? 'provider-failure'; counts[failure] = (counts[failure] ?? 0) + 1; return counts
          }, {}) }
      })
      const ranked = [...models].sort((a, b) => (b.matchedMeanScore ?? -Infinity) - (a.matchedMeanScore ?? -Infinity) || a.providerKey.localeCompare(b.providerKey))
      if (matched.length) ranked.forEach((model, index) => { model.matchedRank = index > 0 && ranked[index - 1]!.matchedMeanScore === model.matchedMeanScore ? ranked[index - 1]!.matchedRank : index + 1 })
      return { group, matchedCaseIds: matched.map(row => row.id), models: ranked }
    })
    const comparisons = targets.filter(target => target.provider === 'anthropic').flatMap(claude => targets.filter(target => target.provider === 'gemini').map(gemini => {
      const a = key(claude), b = key(gemini)
      const common = selected.filter(row => outcome(row, a).status === 'succeeded' && outcome(row, b).status === 'succeeded')
      const differences = common.map(row => outcome(row, a).score! - outcome(row, b).score!)
      return { modelA: a, modelB: b, commonInputs: common.length, meanScoreDifferenceAminusB: mean(differences),
        meanTokenF1DifferenceAminusB: common.every(row => outcome(row, a).tokenMultiset && outcome(row, b).tokenMultiset)
          ? mean(common.map(row => outcome(row, a).tokenMultiset!.f1 - outcome(row, b).tokenMultiset!.f1)) : null,
        modelAWins: differences.filter(value => value > 1e-9).length, modelBWins: differences.filter(value => value < -1e-9).length,
        ties: differences.filter(value => Math.abs(value) <= 1e-9).length }
    }))
    return { panel, label: panelLabels[panel], expectedInputs: selected.length, caseIds: selected.map(row => row.id), groups, comparisons }
  })
}

const within = async (projectRoot: string, path: string): Promise<string> => {
  if (isAbsolute(path) || /[:\\\x00]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new AppValidationError('Expected a normalized project-relative newspaper path')
  const file = await realpath(resolve(projectRoot, path)), rel = relative(projectRoot, file)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new AppValidationError('Newspaper report evidence escapes project root')
  return file
}

export const inspectNewspaperExpansionReports = (options: NewspaperReportOptions = {}) => inspectBcOcrReports({ ...options, reportProfile: 'newspapers' })

export const analyzeNewspaperExpansionReports = async (options: NewspaperReportOptions = {}) => {
  const overview = await inspectNewspaperExpansionReports(options)
  const root = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const plan = v.parse(planSchema, await Bun.file(await within(root, options.planPath ?? `${NEWSPAPER_REPORT_ROOT}/execution-plan.json`)).json())
  const cases: NewspaperScoredCase[] = []
  const secondarySourceConventions: Array<{ caseId: string, providerKey: string } & v.InferOutput<typeof secondarySchema>> = []
  for (const entry of plan.cases) {
    const manifest: unknown = await Bun.file(await within(root, `${entry.runDir}/manifest.json`)).json()
    if (!record(manifest) || !Array.isArray(manifest['items']) || manifest['items'].length !== 1 || !record(manifest['items'][0]) || !Array.isArray(manifest['items'][0]['providers'])) throw new AppValidationError('Public newspaper manifest has no selected-provider matrix')
    const states = manifest['items'][0]['providers']
    if (states.length !== plan.targets.length || !record(manifest['reference']) || manifest['reference']['path'] !== entry.normalizedReference
      || manifest['reference']['sha256'] !== entry.normalizedReferenceSha256 || !record(manifest['source'])
      || !record(manifest['source']['originalCanonicalReference']) || manifest['source']['originalCanonicalReference']['path'] !== entry.reference
      || manifest['source']['originalCanonicalReference']['sha256'] !== entry.referenceSha256) throw new AppValidationError('Public newspaper reference or target inventory differs from the authorized source')
    const reportPath = `${entry.runDir}/provider-comparison-report.json`
    const diagnostics: unknown = await Bun.file(await within(root, `${entry.runDir}/evaluation-diagnostics.json`)).json()
    if (!record(diagnostics) || !Array.isArray(diagnostics['providers'])) throw new AppValidationError('Newspaper diagnostic coverage is missing')
    const diagnosticProviders = diagnostics['providers']
    let details: Record<string, unknown>[] = []
    if (await Bun.file(resolve(root, reportPath)).exists()) {
      const report: unknown = await Bun.file(await within(root, reportPath)).json()
      if (!record(report) || !record(report['providerGroups']) || !record(report['referenceProvenance'])
        || report['referenceProvenance']['path'] !== entry.normalizedReference || report['referenceProvenance']['sha256'] !== entry.normalizedReferenceSha256) throw new AppValidationError('Invalid newspaper metric report or scoring reference')
      for (const group of Object.values(report['providerGroups'])) {
        if (!record(group) || !Array.isArray(group['providers'])) throw new AppValidationError('Invalid newspaper metric group')
        for (const detail of group['providers']) { if (!record(detail)) throw new AppValidationError('Invalid newspaper metric row'); details.push(detail) }
      }
      if (details.some(detail => !plan.targets.some(target => key(target) === detail['providerKey']))) throw new AppValidationError('Metric report contains an unselected newspaper target')
    }
    const outcomes = plan.targets.map(target => {
      const providerKey = key(target)
      const matching = states.filter(state => record(state) && state['service'] === target.provider && state['model'] === target.model)
      if (matching.length !== 1 || !record(matching[0])) throw new AppValidationError('Public newspaper selected-target identity changed')
      const state = matching[0], status = state['status']
      if (!['succeeded', 'failed', 'missing', 'running'].includes(String(status))) throw new AppValidationError('Invalid newspaper selected-target status')
      const scored = details.filter(detail => detail['providerKey'] === providerKey)
      if (scored.length > 1 || status !== 'succeeded' && scored.length) throw new AppValidationError('Failed newspaper output has a stale quality row')
      const metrics = scored[0]?.['metrics'], score = record(metrics) ? metrics['score'] : null
      if (status === 'succeeded' && (typeof score !== 'number' || !Number.isFinite(score))) throw new AppValidationError('Completed newspaper output lacks its quality score')
      const metadata = state['metadata'], evidence = record(metadata) && Array.isArray(metadata['pageEvidence']) ? metadata['pageEvidence'] : []
      const failure = evidence.find(value => record(value) && typeof value['failureKind'] === 'string')
      const diagnostic = diagnosticProviders.filter(value => record(value) && value['providerKey'] === providerKey)
      if (diagnostic.length > 1 || status !== 'succeeded' && diagnostic.length) throw new AppValidationError('Newspaper token diagnostic differs from completed coverage')
      const multiset = status === 'succeeded' && record(diagnostic[0]) ? v.parse(multisetSchema, diagnostic[0]['tokenMultiset']) : undefined
      const repetition = status === 'succeeded' && record(diagnostic[0]) ? v.parse(repetitionSchema, diagnostic[0]['repetition']) : undefined
      if (status === 'succeeded' && !multiset) throw new AppValidationError('Completed newspaper output lacks its token multiset diagnostic')
      return { providerKey, status: status as Status, score: status === 'succeeded' ? score as number : null,
        ...(multiset ? { tokenMultiset: multiset } : {}),
        ...(repetition ? { repetition } : {}),
        ...(record(failure) && typeof failure['failureKind'] === 'string' ? { failureKind: failure['failureKind'] } : {}) }
    })
    cases.push({ id: entry.id, panel: newspaperChallengePanel(entry.id, entry.scope), outcomes })
    if (entry.id === 'newspapers-expansion-bln-era-burglars') {
      for (const provider of diagnosticProviders) {
        if (!record(provider) || typeof provider['providerKey'] !== 'string' || !outcomes.some(outcome => outcome.providerKey === provider['providerKey'] && outcome.status === 'succeeded')) throw new AppValidationError('ERA diagnostic differs from completed provider coverage')
        const value = v.parse(secondarySchema, provider['sourceSpacingConvention'])
        secondarySourceConventions.push({ caseId: entry.id, providerKey: provider['providerKey'], ...value })
      }
    }
  }
  const panels = summarizeNewspaperPanels(cases, plan.targets)
  const all = cases.flatMap(row => row.outcomes)
  return { kind: 'ocr-newspaper-expansion-cohort-analysis', analysisVariant: 'newspaper-reading-normalized-v1',
    caseCount: cases.length, targetCount: plan.targets.length, selectedSlots: all.length,
    completionSemantics: 'Provider-completed/scorable means the saved dispatch succeeded and produced a valid scoreable artifact. It does not assert exhaustive source-page coverage or visual correctness; token recall, ordered WER and source-image review assess those separately.',
    completedSlots: all.filter(row => row.status === 'succeeded').length,
    failedSlots: all.filter(row => row.status === 'failed').length,
    notDispatchedSlots: all.filter(row => row.status === 'missing').length,
    runningSlots: all.filter(row => row.status === 'running').length,
    spending: overview.spending, panels, cases, secondarySourceConventions,
    policy: 'Local and hosted targets are separate. Means on completed outputs are conditional and retain completion denominators. Matched ranks use the identical successfully completed input intersection within each provider group. Pairwise differences use only inputs completed by both models. Missing/failed outputs have no invented score. Source inputs are counted once; issue/publication dependence remains a limitation.' }
}

const table = (headers: string[], rows: string[][]): string => {
  const widths = headers.map((header, index) => Math.max(3, header.length, ...rows.map(row => row[index]!.length)))
  const line = (cells: string[]): string => '| ' + cells.map((cell, index) => cell.padEnd(widths[index]!)).join(' | ') + ' |'
  return [line(headers), line(widths.map(width => '-'.repeat(width))), ...rows.map(line)].join('\n')
}
const number = (value: number | null): string => value === null ? 'unavailable' : value.toFixed(2)
const code = (value: string): string => '`' + value + '`'

export const newspaperExecutionMarkdown = (analysis: Awaited<ReturnType<typeof analyzeNewspaperExpansionReports>>): string => {
  const lines = ['## Execution and paired model comparison',
    `Saved outputs: **${analysis.completedSlots}/${analysis.selectedSlots} provider-completed/scorable**, ${analysis.failedSlots} failed, ${analysis.notDispatchedSlots} not dispatched, ${analysis.runningSlots} running. The same ${analysis.caseCount} admitted source inputs and ${analysis.targetCount} selected targets define every denominator.`,
    analysis.completionSemantics,
    `Accounted cumulative cost: **$${(analysis.spending.accountedCents / 100).toFixed(4)}**, including $${(analysis.spending.heldReservationCents / 100).toFixed(4)} retained reservations and $${(analysis.spending.settledConservativeCents / 100).toFixed(4)} settled conservative amounts. This is reviewed-rate accounting, not invoice reconciliation.`,
    'Primary lexical comparison uses NFKC and the declared quote/dash/whitespace conversion on both independently supplied gold and private derived provider text. Saved raw outputs and original diplomatic gold remain unchanged; literal diagnostics use those raw texts. No gold was sent to OCR providers.']
  const incomplete = analysis.cases.flatMap(row => row.outcomes.filter(outcome => outcome.status !== 'succeeded').map(outcome => [code(row.id), code(outcome.providerKey), outcome.status, outcome.failureKind ?? (outcome.status === 'missing' ? 'not dispatched' : outcome.status)]))
  if (incomplete.length) {
    lines.push('### Incomplete selected outputs')
    lines.push('Failure reasons describe the saved execution state. Credit configuration and retained accounting holds are separate from measured OCR quality; unavailable outputs receive no invented zero score.')
    lines.push(table(['Input', 'Model', 'Status', 'Reason'], incomplete))
  }
  for (const panel of analysis.panels) {
    lines.push(`### ${panel.label} (${panel.expectedInputs} inputs)`)
    lines.push('Selected source cases: ' + panel.caseIds.map(code).join(', ') + '.')
    lines.push(panel.panel === 'very-long-page-capacity'
      ? 'This panel tests completion and output capacity separately. Native output-limit failures receive no quality score. A completed output can still omit or misorder text; its lexical score measures that against the independent reference.'
      : 'Completion coverage is shown alongside conditional accuracy. Matched ranks compare exactly the same completed source inputs within each provider group; quality on a smaller successful subset is not a directly comparable all-input accuracy. Local and hosted intersections can differ and are not a cross-group leaderboard.')
    for (const group of panel.groups) {
      lines.push(`#### ${group.group === 'local' ? 'Local' : 'Hosted'} targets`)
      lines.push(`Common completed inputs: **${group.matchedCaseIds.length}/${panel.expectedInputs}**. ` + (group.matchedCaseIds.length ? 'The matched-score column uses this identical set for every target in the group.' : 'Matched quality is unavailable; completion and conditional scores remain separate.'))
      if (group.matchedCaseIds.length > 0 && group.matchedCaseIds.length < panel.expectedInputs) lines.push('Excluded from this group’s common set: ' + panel.caseIds.filter(id => !group.matchedCaseIds.includes(id)).map(code).join(', ') + '.')
      lines.push('Equal matched scores share a rank; provider-key order breaks display ties without implying a quality difference.')
      lines.push(table(['Model', 'Scorable / selected', 'Failed', 'Not dispatched', 'Mean on scorable /100', 'Matched mean /100', 'Matched token F1', 'Matched rank'], group.models.map(model => [
        code(model.providerKey), `${model.completedInputs}/${model.expectedInputs}`, String(model.failedInputs), String(model.notDispatchedInputs), number(model.meanScoreOnCompletedInputs), number(model.matchedMeanScore), model.matchedTokenF1 === null ? 'unavailable' : `${(model.matchedTokenF1 * 100).toFixed(2)}%`, model.matchedRank === null ? 'unavailable' : String(model.matchedRank)
      ])))
      if (group.models.length) lines.push(table(['Model', 'Matched token precision', 'Matched token recall', 'Mean recall on scorable inputs'], group.models.map(model => [code(model.providerKey),
        model.matchedTokenPrecision === null ? 'unavailable' : `${(model.matchedTokenPrecision * 100).toFixed(2)}%`,
        model.matchedTokenRecall === null ? 'unavailable' : `${(model.matchedTokenRecall * 100).toFixed(2)}%`,
        model.meanTokenRecallOnCompletedInputs === null ? 'unavailable' : `${(model.meanTokenRecallOnCompletedInputs * 100).toFixed(2)}%`
      ])))
    }
    const focus = panel.comparisons.filter(pair => /claude-(?:sonnet|opus)-5-5$/.test(pair.modelA) && /gemini-(?:3\.[68]-flash|4-argon)$/.test(pair.modelB))
    if (focus.length) {
      lines.push('#### Claude / Gemini paired differences')
      lines.push('Positive differences favor the first model; each row uses only that pair’s common completed inputs. Win counts are descriptive, with no significance or confidence claim.')
      lines.push(table(['Claude model', 'Gemini model', 'Common inputs', 'Mean Claude minus Gemini', 'Claude wins', 'Gemini wins', 'Ties'], focus.map(pair => [code(pair.modelA), code(pair.modelB), String(pair.commonInputs), number(pair.meanScoreDifferenceAminusB), String(pair.modelAWins), String(pair.modelBWins), String(pair.ties)])))
    }
    if (panel.panel === 'very-long-page-capacity') {
      lines.push('#### Long-page omission and repetition diagnostics')
      lines.push('A native STOP/transport success can still contain a short partial extraction or repeated text. Token recall measures source-word occurrence coverage, while precision penalizes excess occurrences. Logical-line repetition counts actual and literal escaped line breaks; it is a diagnostic, not a claim about physical page lines.')
      const outcomes = analysis.cases.filter(row => row.panel === panel.panel).flatMap(row => row.outcomes)
      lines.push(table(['Model', 'Token precision', 'Token recall', 'Logical lines', 'Duplicate line occurrences', 'Most identical-line occurrences', 'Reference maximum'], outcomes.map(row => [code(row.providerKey),
        row.tokenMultiset ? `${(row.tokenMultiset.precision * 100).toFixed(2)}%` : 'unavailable', row.tokenMultiset ? `${(row.tokenMultiset.recall * 100).toFixed(2)}%` : 'unavailable',
        row.repetition ? String(row.repetition.candidate.nonemptyLogicalLines) : 'unavailable', row.repetition ? String(row.repetition.candidate.duplicateLineOccurrences) : 'unavailable',
        row.repetition ? String(row.repetition.candidate.maximumIdenticalLineOccurrences) : 'unavailable', row.repetition ? String(row.repetition.reference.maximumIdenticalLineOccurrences) : 'unavailable'
      ])))
    }
  }
  lines.push('Token multiset precision/recall/F1 counts exact normalized word occurrences while ignoring order. Missing, substituted and duplicated words still affect it. High token F1 alongside low ordered WER-derived quality can suggest sequence/serialization differences; it does not establish page geometry, localization or perfect visual recognition.')
  if (analysis.secondarySourceConventions.length) {
    lines.push('### Secondary source spacing diagnostic')
    lines.push('The ERA reference joins a visible word space. Its primary WER therefore includes a source-serialization floor shared by many models; that floor is not evidence of a recognition gap. The diagnostic below treats only that reviewed convention equivalently in both texts. Frozen primary gold, scores and rankings remain unchanged.')
    lines.push(table(['Model', 'Secondary edits', 'Secondary WER', 'Secondary score /100'], analysis.secondarySourceConventions.map(row => [code(row.providerKey), String(row.wordEdits), `${(row.wordErrorRate * 100).toFixed(3)}%`, number(row.qualityScore)])))
  }
  lines.push('The Lloyd’s crop has a separate serialization caveat: preserving its three visible line-end hyphens contributes six primary word edits (3.92% WER) against the joined publisher reference. Small score differences from that convention do not establish a recognition weakness. The frozen primary reference and scores remain unchanged.')
  lines.push('Each physical source input has one weight in its panel. Multiple Gazette pages and Perth issues share publication context; this small sample does not establish a statistically independent or settled model ranking. Read per-input reports and failure coverage before generalizing a mean difference.')
  return lines.join('\n\n')
}

export const updateNewspaperExecutionSection = async (analysis: Awaited<ReturnType<typeof analyzeNewspaperExpansionReports>>, options: NewspaperReportOptions = {}) => {
  const root = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const path = await within(root, NEWSPAPER_EXECUTION_REPORT), existing = await Bun.file(path).text()
  const start = '<!-- newspaper-execution:start -->', end = '<!-- newspaper-execution:end -->'
  if (existing.includes(start) !== existing.includes(end) || existing.split(start).length > 2 || existing.split(end).length > 2) throw new AppValidationError('Invalid newspaper execution report markers')
  const section = `${start}\n\n${newspaperExecutionMarkdown(analysis)}\n\n${end}`
  const updated = existing.includes(start) ? existing.slice(0, existing.indexOf(start)) + section + existing.slice(existing.indexOf(end) + end.length) : existing.trimEnd() + '\n\n' + section + '\n'
  writePortableFileSync(path, updated)
}

export const buildNewspaperExpansionReports = async (options: NewspaperReportOptions = {}) => {
  await buildBcOcrReports({ ...options, reportProfile: 'newspapers' })
  return analyzeNewspaperExpansionReports(options)
}

export const parseNewspaperReportArguments = (args: readonly string[]) => {
  const usage = 'Usage: bun src/tools/ocr-newspaper-expansion-report.ts [--generate [--case <authorized-case-id> ...] | --analyze | --help]'
  const action = args[0] ?? '--analyze'
  if (!['--help', '--generate', '--analyze'].includes(action) || action !== '--generate' && args.length > 1) throw new AppUsageError(usage)
  const buildCaseIds: string[] = []
  for (let index = 1; index < args.length; index += 2) {
    const id = args[index + 1]
    if (args[index] !== '--case' || !id || !/^newspapers-expansion-[a-z0-9-]+$/.test(id) || buildCaseIds.includes(id)) throw new AppUsageError(usage)
    buildCaseIds.push(id)
  }
  return { action, ...(buildCaseIds.length ? { buildCaseIds } : {}), usage }
}

if (import.meta.main) {
  try {
    const args = parseNewspaperReportArguments(Bun.argv.slice(2))
    if (args.action === '--help') writeCommandPayload((args.usage + '\nDefault/--analyze: read-only saved-cohort analysis. --generate: build metric-only reports from pinned saved outputs and update the marked execution section. Repeated --case rebuilds only those cases, validates all batch evidence, then analyzes all saved reports. No OCR/provider calls.') + '\n')
    else if (args.action === '--generate') {
      const analysis = await buildNewspaperExpansionReports({ ...(args.buildCaseIds ? { buildCaseIds: args.buildCaseIds } : {}) })
      await updateNewspaperExecutionSection(analysis)
      writeCommandPayload((JSON.stringify(analysis, null, 2)) + '\n')
    } else writeCommandPayload((JSON.stringify(await analyzeNewspaperExpansionReports(), null, 2)) + '\n')
  } catch (error) { writeCommandPayload((error instanceof Error ? error.message : 'Newspaper report integration failed') + '\n', 'stderr'); process.exitCode = 1 }
}
