import * as v from 'valibot'
import { ValidationError } from '~/utils/error-handler'
import { CONTINUITY_HARD_KEYS, deriveContinuityLabelKeys } from '../comic-commands/generate-images/continuity-qa'
import type { ContinuityHardKey, ContinuityJudgeEntry, ContinuityLabelKeyMetrics, ContinuityLabelsFile, ContinuityLabelsJoin } from '~/types'

export const CONTINUITY_LABELS_SCHEMA_VERSION = 1 as const

const panelNumber = () => v.pipe(v.number(), v.integer(), v.minValue(1))

export const ContinuityLabelsSchema = v.strictObject({
  schemaVersion: v.literal(CONTINUITY_LABELS_SCHEMA_VERSION),
  sceneSlug: v.string(),
  trustedAnchorPanel: v.nullable(panelNumber()),
  // Absent means labeled, so every file written before this field existed stays valid. An explicit
  // false marks a generated template whose verdicts are schema placeholders rather than human truth.
  labeled: v.optional(v.boolean()),
  labeler: v.string(),
  date: v.string(),
  pairs: v.array(v.strictObject({
    panels: v.tuple([panelNumber(), panelNumber()]),
    verdicts: v.strictObject({
      'side-flip': v.boolean(),
      'seat-swap': v.boolean(),
      'furniture-spin': v.boolean(),
      intruder: v.boolean(),
      'vanishing-crowd': v.boolean(),
      'wardrobe-swap': v.boolean(),
    }),
  })),
})

const describeIssues = (error: unknown): string => {
  if (v.isValiError(error)) {
    return error.issues.map(issue => `${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`).join('; ')
  }
  return error instanceof Error ? error.message : String(error)
}

export const parseContinuityLabels = (value: unknown, options: { sceneSlug?: string | undefined; source?: string | undefined } = {}): ContinuityLabelsFile => {
  let labels: ContinuityLabelsFile
  try { labels = v.parse(ContinuityLabelsSchema, value) } catch (error) {
    throw ValidationError(`Invalid continuity labels${options.source ? ` at ${options.source}` : ''}: ${describeIssues(error)}`, { stage: 'comic:continuity-labels', ...(error instanceof Error ? { cause: error } : {}) })
  }
  if (options.sceneSlug !== undefined && labels.sceneSlug !== options.sceneSlug) {
    throw ValidationError(`Continuity labels are for scene "${labels.sceneSlug}" but the audit targets "${options.sceneSlug}".`, { stage: 'comic:continuity-labels' })
  }
  const seen = new Set<string>()
  for (const pair of labels.pairs) {
    const [first, second] = pair.panels
    if (first === second) throw ValidationError(`Continuity labels pair [${first}, ${second}] must name two different panels.`, { stage: 'comic:continuity-labels' })
    const key = `${first}:${second}`
    if (seen.has(key)) throw ValidationError(`Continuity labels contain the pair [${first}, ${second}] more than once.`, { stage: 'comic:continuity-labels' })
    seen.add(key)
  }
  return labels
}

export const readContinuityLabels = async (path: string, options: { sceneSlug?: string | undefined } = {}): Promise<ContinuityLabelsFile> => {
  const file = Bun.file(path)
  if (!(await file.exists())) throw ValidationError(`Continuity labels file was not found: ${path}`, { stage: 'comic:continuity-labels' })
  let value: unknown
  try { value = JSON.parse(await file.text()) } catch (error) {
    throw ValidationError(`Continuity labels file is not valid JSON: ${path}`, { stage: 'comic:continuity-labels', ...(error instanceof Error ? { cause: error } : {}) })
  }
  const labels = parseContinuityLabels(value, { sceneSlug: options.sceneSlug, source: path })
  // A template's verdicts are all false because the schema has no null verdict. Scoring against one
  // would read as a human asserting that the scene contains no blooper of any kind.
  if (labels.labeled === false) {
    throw ValidationError(`Continuity labels at ${path} are marked "labeled": false, so they are an unlabeled template rather than human ground truth; fill in every verdict and set "labeled": true before passing --labels.`, { stage: 'comic:continuity-labels' })
  }
  return labels
}

const ratio = (numerator: number, denominator: number): number | null => denominator === 0 ? null : Math.round((numerator / denominator) * 10_000) / 10_000

export const computeContinuityKeyMetrics = (key: ContinuityHardKey, observations: ReadonlyArray<{ labeled: boolean; judged: boolean }>): ContinuityLabelKeyMetrics => {
  let truePositives = 0
  let falsePositives = 0
  let falseNegatives = 0
  let trueNegatives = 0
  for (const observation of observations) {
    if (observation.labeled && observation.judged) truePositives++
    else if (!observation.labeled && observation.judged) falsePositives++
    else if (observation.labeled && !observation.judged) falseNegatives++
    else trueNegatives++
  }
  return {
    key,
    truePositives,
    falsePositives,
    falseNegatives,
    trueNegatives,
    precision: ratio(truePositives, truePositives + falsePositives),
    recall: ratio(truePositives, truePositives + falseNegatives),
  }
}

export const joinContinuityLabels = (labels: ContinuityLabelsFile, entries: ReadonlyArray<ContinuityJudgeEntry>): ContinuityLabelsJoin => {
  const byPanel = new Map(entries.map(entry => [entry.panelNumber, entry]))
  const matched: Array<{ verdicts: ContinuityLabelsFile['pairs'][number]['verdicts']; judgedKeys: ReadonlySet<ContinuityHardKey> }> = []
  const unmatchedPairs: ContinuityLabelsJoin['unmatchedPairs'] = []
  for (const pair of labels.pairs) {
    const [reference, candidate] = pair.panels
    const entry = byPanel.get(candidate)
    if (!entry) {
      unmatchedPairs.push({ panels: [reference, candidate], reason: `panel ${candidate} was not judged` })
      continue
    }
    if (entry.predecessorPanel !== reference && entry.anchorPanel !== reference) {
      unmatchedPairs.push({ panels: [reference, candidate], reason: `panel ${candidate} was judged against anchor ${entry.anchorPanel} and predecessor ${entry.predecessorPanel ?? 'none'}, not panel ${reference}` })
      continue
    }
    matched.push({ verdicts: pair.verdicts, judgedKeys: new Set(deriveContinuityLabelKeys(entry.result)) })
  }
  return {
    labeler: labels.labeler,
    date: labels.date,
    trustedAnchorPanel: labels.trustedAnchorPanel,
    labeledPairs: labels.pairs.length,
    matchedPairs: matched.length,
    unmatchedPairs,
    byKey: CONTINUITY_HARD_KEYS.map(key => computeContinuityKeyMetrics(key, matched.map(item => ({ labeled: item.verdicts[key], judged: item.judgedKeys.has(key) })))),
  }
}
