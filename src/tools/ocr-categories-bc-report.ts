import { AppValidationError, AppUsageError, AppInfrastructureError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { mkdir, realpath, rename } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import * as v from 'valibot'
import { PROJECT_ROOT } from '~/utils/project-root'
import { decodePngRgba8 } from '~/utils/lossless-png'
import { normalizeHistoricalReference } from './ocr-preparation/prepare-historical-newspapers'
import { efgOcrEvaluationPolicy, scoreEfgOcrFidelity, validateEfgOcrStructure } from './ocr-categories-efg-metrics'
import { admitEfgOfflineReplayArtifact } from './ocr-categories-efg-offline-response'
import { levenshteinDistance, parseConsensusExtraction, tokenize } from '../../.codex/skills/consensus/scripts/ocr/ocr_consensus_lib'
import { writePortableFileSync } from '../../.codex/skills/consensus/scripts/shared/portable_paths'

const localRoot = 'input/examples/document/ocr-categories-bc-run'
const reportProfiles = {
  bc: { localRoot, planKind: 'ocr-categories-bc-execution-plan', ledgerKind: 'ocr-categories-bc-spending-ledger', budgetCents: 3000,
    approvalEvidence: 'User approved up to $30', rerunPrefix: 'bc-rerun-', sourceKind: 'ocr-categories-bc-page-assembly',
    protocol: 'Each source page was dispatched as its pinned PNG. Baseline PDF reruns are a rendered-page protocol variant and do not replace native-PDF archive runs.' },
  advertisements: { localRoot: 'input/examples/document/ocr-category-d-run', planKind: 'ocr-category-d-execution-plan', ledgerKind: 'ocr-category-d-spending-ledger', budgetCents: 2500,
    approvalEvidence: 'User approved up to $25 for category 4', rerunPrefix: 'd-rerun-', sourceKind: 'ocr-category-d-image-assembly',
    protocol: 'Every provider received the same full original JPEG. No gold words or annotation coordinates were sent to providers. Text-only outputs do not establish word-region localization or full-image exhaustive accuracy.' },
  efg: { localRoot: 'input/examples/document/ocr-categories-efg-run', planKind: 'ocr-categories-efg-execution-plan', ledgerKind: 'ocr-categories-efg-spending-ledger', budgetCents: 3000,
    approvalEvidence: 'User approved up to $30 for categories 5–7', rerunPrefix: 'efg-rerun-', sourceKind: 'ocr-categories-efg-image-assembly',
    protocol: 'Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.' },
  newspapers: { localRoot: 'input/examples/document/ocr-newspaper-expansion', planKind: 'ocr-newspaper-expansion-execution-plan', ledgerKind: 'ocr-newspaper-expansion-spending-ledger', budgetCents: 3000,
    approvalEvidence: 'User approved up to $30 for the 12-input newspaper expansion', rerunPrefix: 'newspapers-expansion-', sourceKind: 'ocr-newspaper-expansion-image-assembly',
    protocol: 'Every selected model received the same pinned PNG for each admitted input. Independent reference text and reading-order annotations were never sent to providers. Lexical analysis applies the declared NFKC, quote/dash and whitespace conversion to both reference and candidate in private derivatives; raw saved outputs and diplomatic references remain unchanged. Whole-page layout, region recognition and long-page capacity are reported separately.' }
} as const
const hash = (bytes: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nonempty = v.pipe(v.string(), v.nonEmpty())
const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const positiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1))
const amount = v.pipe(v.number(), v.minValue(0), v.finite())
const targetSchema = v.object({ provider: nonempty, model: nonempty })
const pageSchema = v.object({ id: nonempty, caseId: nonempty, pageNumber: positiveInteger, input: nonempty, inputSha256: digest, width: positiveInteger, height: positiveInteger })
const caseSchema = v.object({
  id: nonempty, category: v.picklist(['technical-code', 'historical-print', 'advertisements', 'numeric-tables', 'handwriting', 'newspapers']), input: nonempty, inputSha256: digest,
  reference: nonempty, referenceSha256: digest, referenceKind: v.picklist(['publisher-canonical', 'existing-consensus']),
  sourceURL: nonempty, sourceRevision: nonempty, annotationURL: v.optional(nonempty), annotationRevision: v.optional(nonempty), runDir: nonempty,
  normalizedReference: v.optional(nonempty), normalizedReferenceSha256: v.optional(digest),
  readingReference: v.optional(nonempty), readingReferenceSha256: v.optional(digest),
  scope: v.optional(nonempty), sourceFamily: v.optional(nonempty), synthetic: v.optional(v.boolean()),
  serializationPolicy: v.optional(v.union([nonempty, v.record(v.string(), v.string())])),
  rights: v.optional(v.record(v.string(), v.union([v.string(), v.boolean()]))), attribution: v.optional(nonempty),
  structuredReference: v.optional(nonempty), structuredReferenceSha256: v.optional(digest), evaluationScope: v.optional(nonempty),
  pages: v.pipe(v.array(v.union([nonempty, pageSchema])), v.minLength(1))
})
const planSchema = v.object({
  schemaVersion: v.literal(1), kind: nonempty,
  approval: v.object({ status: v.literal('approved'), budgetCents: positiveInteger, evidence: nonempty }),
  pages: v.pipe(v.array(pageSchema), v.minLength(1)), targets: v.pipe(v.array(targetSchema), v.minLength(2)), cases: v.pipe(v.array(caseSchema), v.minLength(1))
})
const receiptSchema = v.object({
  id: nonempty, invocationId: nonempty, caseId: nonempty, documentCaseId: v.optional(nonempty), provider: nonempty, model: nonempty,
  inputSha256: digest, reservedCents: amount, chargedCents: amount, createdAt: nonempty,
  status: v.picklist(['reserved', 'settled', 'rejected', 'ambiguous', 'breach']),
  costBasis: v.optional(v.picklist(['conservative-upper-bound', 'provider-usage-at-reviewed-rates'])),
  httpStatus: v.optional(v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(599)))
})
const ledgerSchema = v.object({ schemaVersion: v.literal(1), kind: nonempty, budgetCents: positiveInteger, planSha256: digest, receipts: v.array(receiptSchema) })
const wordRegionSchema = v.object({ id: nonempty, text: nonempty, ignore: v.boolean(), polygon: v.array(v.number()), bbox: v.array(v.number()) })
const advertisementReferenceSchema = v.object({ schemaVersion: v.literal(1), canonicalUnit: v.literal('word-region'), width: positiveInteger, height: positiveInteger,
  regions: v.pipe(v.array(wordRegionSchema), v.minLength(1)), reviewedReadingOrder: v.object({ notDatasetGoldOrder: v.literal(true), lines: v.array(v.array(nonempty)) }) })
const journalSchema = v.object({
  caseId: nonempty, documentCaseId: nonempty, provider: nonempty, model: nonempty, inputSha256: digest, referenceSha256: digest,
  status: v.picklist(['succeeded', 'failed', 'dispatch-started']), directory: nonempty, startedAt: nonempty,
  manifestSha256: v.optional(v.nullable(digest)), completedAt: v.optional(nonempty),
  artifactHashes: v.optional(v.array(v.object({ path: nonempty, sha256: digest }))),
  offlineResponseReview: v.optional(v.object({ path: nonempty, sha256: digest })), offlineReplay: v.optional(v.unknown())
})
type Receipt = v.InferOutput<typeof receiptSchema>
type Page = v.InferOutput<typeof pageSchema>
type Target = v.InferOutput<typeof targetSchema>

export interface BcOcrReportOptions {
  /** Fixed authorization/reporting profiles; omitted retains all original B/C behavior. */
  reportProfile?: keyof typeof reportProfiles
  projectRoot?: string
  planPath?: string
  ledgerPath?: string
  /** Newspaper-only rebuild filter; all batch evidence is still validated. */
  buildCaseIds?: readonly string[]
  /** Local test seam. Production invokes the public consensus skill entry point. */
  runConsensus?: (argv: readonly string[], caseId: string) => Promise<void>
}

const portable = (path: string): void => {
  if (isAbsolute(path) || /[:\\\x00]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new AppValidationError('Expected a normalized project-relative artifact path')
}
const safeStem = (value: string): string => value.replace(/[^a-zA-Z0-9_.-]/g, '-')
export const bcOcrReportArtifactDir = (provider: string, model: string): string => `providers/${encodeURIComponent(`${provider}-${model}`)}`
export const summarizeBcOcrReceipts = (receipts: readonly Receipt[]) => ({
  requestCount: receipts.length,
  reviewedUsageCents: receipts.filter(row => row.status === 'settled' && row.costBasis !== 'conservative-upper-bound').reduce((sum, row) => sum + row.chargedCents, 0),
  settledConservativeCents: receipts.filter(row => row.status === 'settled' && row.costBasis === 'conservative-upper-bound').reduce((sum, row) => sum + row.chargedCents, 0),
  settledAccountedCents: receipts.filter(row => row.status === 'settled').reduce((sum, row) => sum + row.chargedCents, 0),
  heldReservationCents: receipts.filter(row => ['reserved', 'ambiguous', 'breach'].includes(row.status)).reduce((sum, row) => sum + row.chargedCents, 0),
  accountedCents: receipts.reduce((sum, row) => sum + row.chargedCents, 0),
  rejectedRequests: receipts.filter(row => row.status === 'rejected').length,
  unresolvedRequests: receipts.filter(row => ['reserved', 'ambiguous', 'breach'].includes(row.status)).length
})

const canonicalLines = (value: string): string => value.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n')

/** Native limit flags make a decoded response incomplete even when transport succeeded. */
export const assertNewspaperOcrResultComplete = (result: Record<string, unknown>, metadata: unknown): void => {
  const records = [result, ...(record(metadata) ? [metadata] : [])]
  for (const value of records) {
    if (value['truncated'] === true || value['incomplete'] === true || value['outputLimitReached'] === true
      || value['status'] === 'incomplete') throw new AppValidationError('Newspaper result has an explicit incomplete-output flag')
    for (const key of ['finishReason', 'finish_reason', 'nativeFinishReason', 'stop_reason']) {
      const reason = value[key]
      if (typeof reason === 'string' && ['length', 'max_tokens', 'max_output_tokens', 'max_output_limit'].includes(reason.toLowerCase())) {
        throw new AppValidationError('Newspaper result reached a native output limit')
      }
    }
    if (record(value['incomplete_details']) && value['incomplete_details']['reason'] === 'max_output_tokens') throw new AppValidationError('Newspaper result reached a native output limit')
  }
}

export const classifyNewspaperOcrFailure = (error: unknown): 'output-limit' | 'provider-credit-blocked' | 'accounting-allowance-breach' | 'budget-blocked' | 'transport' | 'provider-failure' => {
  const hint = record(error) ? ['code', 'name', 'message'].map(key => typeof error[key] === 'string' ? error[key] : '').join(' ').toLowerCase() : ''
  if (/credit balance|insufficient[_ -]?(?:credits|quota)|payment required|billing.{0,30}(?:disabled|not enabled)/.test(hint)) return 'provider-credit-blocked'
  if (/allowance.{0,30}breach|reported usage exceeded|exceeded.{0,30}reserved allowance/.test(hint)) return 'accounting-allowance-breach'
  if (/output.?limit|max[_ -]?(?:output[_ -]?)?tokens|token.?limit|finish.?reason.{0,8}length/.test(hint)) return 'output-limit'
  if (/budget|reservation|cumulative spending|spending guard/.test(hint)) return 'budget-blocked'
  if (/timeout|timed out|socket|network|connection|econn|rate.?limit|http.?429/.test(hint)) return 'transport'
  return 'provider-failure'
}

export const classifyNewspaperFailureLog = (text: string): ReturnType<typeof classifyNewspaperOcrFailure> => {
  const parse = (value: string): unknown => { try { return JSON.parse(value) } catch { return undefined } }
  const values = [parse(text), ...text.split('\n').map(parse)]
  for (const value of values) if (record(value)) {
    const error = record(value['error']) ? value['error'] : value
    if (typeof error['name'] === 'string' || typeof error['code'] === 'string' || typeof error['message'] === 'string') return classifyNewspaperOcrFailure(error)
  }
  return 'provider-failure'
}

/** One reviewed publisher-spacing convention; this never replaces primary metrics. */
export const scoreNewspaperSpacingConvention = (caseId: string, reference: string, candidate: string) => {
  if (caseId !== 'newspapers-expansion-bln-era-burglars') return null
  const gold = normalizeHistoricalReference(reference), actual = normalizeHistoricalReference(candidate)
  const pattern = /\bsome\s+one\b/gi
  const equivalent = (text: string): string => text.replace(pattern, 'someone')
  const expected = tokenize(equivalent(gold)), observed = tokenize(equivalent(actual))
  const edits = levenshteinDistance(expected, observed), wer = expected.length ? edits / expected.length : null
  return { variant: 'era-reviewed-spacing-equivalence-v1', primaryMetricsUnchanged: true,
    referenceConventionSpans: [...gold.matchAll(pattern)].length, candidateConventionSpans: [...actual.matchAll(pattern)].length,
    referenceTokens: expected.length, candidateTokens: observed.length, wordEdits: edits, wordErrorRate: wer,
    qualityScore: wer === null ? null : Math.max(0, 100 * (1 - wer)),
    policy: 'ERA crop only: the scan-backed some one / someone spacing convention is treated equivalently in BOTH reading-normalized texts. This secondary diagnostic does not rewrite frozen gold, raw outputs or primary WER/rankings, and does not establish visual correctness of other text.' }
}

/** Exact occurrence-count diagnostic; order is ignored, geometry is not measured. */
export const scoreNewspaperTokenMultiset = (reference: string, candidate: string) => {
  const expected = tokenize(normalizeHistoricalReference(reference)), observed = tokenize(normalizeHistoricalReference(candidate))
  const a = new Map<string, number>(), b = new Map<string, number>()
  for (const token of expected) a.set(token, (a.get(token) ?? 0) + 1)
  for (const token of observed) b.set(token, (b.get(token) ?? 0) + 1)
  const matched = [...a].reduce((sum, [token, count]) => sum + Math.min(count, b.get(token) ?? 0), 0)
  const precision = expected.length ? observed.length ? matched / observed.length : 0 : null
  const recall = expected.length ? matched / expected.length : null
  const f1 = precision === null || recall === null ? null : precision + recall ? 2 * precision * recall / (precision + recall) : 0
  return { referenceTokenCount: expected.length, candidateTokenCount: observed.length, matchedTokenCount: matched,
    missingTokenCount: expected.length - matched, unmatchedTokenCount: observed.length - matched, precision, recall, f1,
    policy: 'Order-insensitive normalized token multiset precision/recall/F1 against the exhaustive declared page/crop reference. Exact duplicate occurrence counts are retained; NFKC and declared reading normalization apply to BOTH texts before existing OCR tokenization. High F1 with poor ordered WER can suggest sequence/serialization differences; this is not spatial accuracy or proof of visual correctness.' }
}

/** Nonlexical repetition counts; no repeated source or provider strings are emitted. */
export const scoreNewspaperRepetition = (reference: string, candidate: string) => {
  const counts = (text: string) => {
    const lines = text.split(/\r\n?|\n|\\n/g).map(line => normalizeHistoricalReference(line).trim()).filter(Boolean)
    const occurrences = new Map<string, number>()
    let longestRun = 0, currentRun = 0, previous: string | undefined
    for (const line of lines) {
      occurrences.set(line, (occurrences.get(line) ?? 0) + 1)
      currentRun = previous === line ? currentRun + 1 : 1; previous = line; longestRun = Math.max(longestRun, currentRun)
    }
    return { nonemptyLogicalLines: lines.length, uniqueLogicalLines: occurrences.size,
      duplicateLineOccurrences: lines.length - occurrences.size,
      repeatedLineKinds: [...occurrences.values()].filter(count => count > 1).length,
      maximumIdenticalLineOccurrences: [...occurrences.values()].reduce((maximum, value) => Math.max(maximum, value), 0), maximumConsecutiveIdenticalLineRun: longestRun }
  }
  return { reference: counts(reference), candidate: counts(candidate),
    policy: 'Counts only: split actual CR/LF and literal escaped newline markers, then apply the same declared reading normalization within each nonempty logical line. Duplicate occurrences count total minus unique lines. Repetition may be legitimate; compare source counts and token precision/recall. No page geometry, repeated string or source wording is emitted.' }
}

/** Exact whole-document Unicode code-point distance; the band only prunes paths already more expensive than its bound. */
export const bcExactCharacterDistance = (reference: string, candidate: string): number => {
  if (reference === candidate) return 0
  const left = [...reference], right = [...candidate]
  let start = 0, leftEnd = left.length, rightEnd = right.length
  while (start < leftEnd && start < rightEnd && left[start] === right[start]) start++
  while (leftEnd > start && rightEnd > start && left[leftEnd - 1] === right[rightEnd - 1]) { leftEnd--; rightEnd-- }
  let rows = left.slice(start, leftEnd), columns = right.slice(start, rightEnd)
  if (rows.length < columns.length) [rows, columns] = [columns, rows]
  const n = rows.length, m = columns.length
  if (!m) return n
  const fullDistance = (): number => {
    let previous = Uint32Array.from({ length: m + 1 }, (_, j) => j), current = new Uint32Array(m + 1)
    for (let i = 1; i <= n; i++) {
      current[0] = i
      for (let j = 1; j <= m; j++) current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + Number(rows[i - 1] !== columns[j - 1]))
      const completed = previous
      previous = current
      current = completed
    }
    return previous[m]!
  }
  const bandedDistance = (bound: number): number => {
    const infinity = bound + 1
    let previous = new Uint32Array(m + 1).fill(infinity), current = new Uint32Array(m + 1).fill(infinity)
    for (let j = 0; j <= Math.min(m, bound); j++) previous[j] = j
    for (let i = 1; i <= n; i++) {
      const low = Math.max(1, i - bound), high = Math.min(m, i + bound)
      current[0] = i <= bound ? i : infinity
      if (low > 1) current[low - 1] = infinity
      let minimum = current[0]!
      for (let j = low; j <= high; j++) {
        current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + Number(rows[i - 1] !== columns[j - 1]))
        minimum = Math.min(minimum, current[j]!)
      }
      if (high < m) current[high + 1] = infinity
      if (minimum > bound) return infinity
      const completed = previous
      previous = current
      current = completed
    }
    return previous[m]!
  }
  let bound = Math.max(n - m, 16)
  while (bound < m) {
    const distance = bandedDistance(bound)
    if (distance <= bound) return distance
    bound = Math.min(m, bound * 2)
  }
  return fullDistance()
}

const strictRatio = (reference: string, candidate: string): number => {
  const count = [...reference].length
  return count ? bcExactCharacterDistance(reference, candidate) / count : candidate.length ? 1 : 0
}
const codeTokens = (value: string): string[] => value.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|==|!=|<=|>=|=>|&&|\|\||\+\+|--|<<|>>|\S/g) ?? []

/** Supplemental fidelity retains punctuation/case/glyphs that the headline prose WER intentionally normalizes. */
export const scoreBcOcrFidelity = (reference: string, candidate: string, category: 'technical-code' | 'historical-print') => {
  const gold = canonicalLines(reference), actual = canonicalLines(candidate)
  const common = { strictTextExact: gold === actual, strictCharacterErrorRate: strictRatio(gold, actual), referenceCharacters: [...gold].length,
    referenceLines: gold.trimEnd().split('\n').length, candidateLines: actual.trimEnd().split('\n').length }
  if (category === 'historical-print') return { ...common,
    diplomaticCharacterErrorRate: common.strictCharacterErrorRate,
    readingNormalizedCharacterErrorRate: strictRatio(normalizeHistoricalReference(gold), normalizeHistoricalReference(actual)),
    policy: 'Diplomatic comparison preserves case, punctuation, long-s, ligatures and line order. Reading-normalized comparison applies the declared NFKC, quote/dash and whitespace policy to both texts.' }
  const expectedTokens = codeTokens(gold), observedTokens = codeTokens(actual)
  const referenceIndent = gold.trimEnd().split('\n').map(line => /^[ \t]*/.exec(line)?.[0] ?? '').join('\n')
  const candidateIndent = actual.trimEnd().split('\n').map(line => /^[ \t]*/.exec(line)?.[0] ?? '').join('\n')
  return { ...common, codeTokensExact: isDeepStrictEqual(expectedTokens, observedTokens),
    codeTokenErrorRate: expectedTokens.length ? levenshteinDistance(expectedTokens, observedTokens) / expectedTokens.length : observedTokens.length ? 1 : 0,
    referenceCodeTokens: expectedTokens.length, indentationExact: referenceIndent === candidateIndent,
    indentationCharacterErrorRate: strictRatio(referenceIndent, candidateIndent),
    policy: 'Case-sensitive code tokens preserve identifiers, operators, quotes and punctuation. Indentation compares original leading space/tab characters at corresponding line positions; tabs are not silently expanded. Only CRLF/CR and final-newline convention are normalized.' }
}

const advertisementScopeReason = 'Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.'
/** A limited text-presence diagnostic, never a region accuracy or full-image precision score. */
export const scoreAnnotatedTokenCoverage = (reference: string, candidate: string) => {
  const referenceTokens = tokenize(reference), candidateTokens = tokenize(candidate)
  if (!referenceTokens.length) throw new AppValidationError('Annotated reference has no tokens under the declared normalization')
  const expected = new Map<string, number>(), observed = new Map<string, number>()
  for (const token of referenceTokens) expected.set(token, (expected.get(token) ?? 0) + 1)
  for (const token of candidateTokens) observed.set(token, (observed.get(token) ?? 0) + 1)
  const matched = [...expected].reduce((sum, [token, count]) => sum + Math.min(count, observed.get(token) ?? 0), 0)
  return { annotatedNormalizedTokenCoverage: matched / referenceTokens.length, matchedReferenceTokens: matched,
    missingReferenceTokens: referenceTokens.length - matched, referenceNormalizedTokenCount: referenceTokens.length,
    candidateNormalizedTokenCount: candidateTokens.length, unmatchedCandidateTokens: candidateTokens.length - matched,
    normalization: 'Existing OCR lexical normalization: lowercase, documented abbreviation/contraction/currency expansion, punctuation removal and ASCII [a-z0-9] word runs. Duplicate tokens count separately. No spatial attribution or output-token precision is inferred.',
    scopeLimitation: advertisementScopeReason }
}

interface SavedPage {
  page: Page
  status: 'succeeded' | 'failed' | 'missing' | 'running'
  journalPath: string
  manifestSha256?: string
  text?: string
  processingTimeMs?: number
  receipts: Receipt[]
  offlineResponseRecovery?: Awaited<ReturnType<typeof admitEfgOfflineReplayArtifact>>
  failureKind?: ReturnType<typeof classifyNewspaperOcrFailure>
}
interface PreparedProvider {
  target: Target
  pages: SavedPage[]
  status: 'succeeded' | 'failed' | 'missing' | 'running'
  receipts: Receipt[]
  result?: { text: string, pages: Array<{ pageNumber: number, method: string, text: string }>, totalPages: number, ocrPages: number, textPages: number }
  state: Record<string, unknown>
}

const prepare = async (options: BcOcrReportOptions, includeFidelity = false) => {
  const profile = reportProfiles[options.reportProfile ?? 'bc']
  const localRoot = profile.localRoot
  const root = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const within = (path: string): string => { portable(path); return resolve(root, path) }
  const existing = async (path: string): Promise<string> => {
    const pathOnDisk = await realpath(within(path)).catch(() => { throw new AppValidationError(`Missing local artifact: ${path}`) })
    const rel = relative(root, pathOnDisk)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new AppValidationError('Artifact escapes project root')
    return pathOnDisk
  }
  const bytes = async (path: string): Promise<Uint8Array> => new Uint8Array(await Bun.file(await existing(path)).arrayBuffer())
  const readJson = async (path: string): Promise<unknown> => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await bytes(path))) as unknown
  const planPath = options.planPath ?? `${localRoot}/execution-plan.json`
  const plan = v.parse(planSchema, await readJson(planPath))
  const ledgerPath = options.ledgerPath ?? `${localRoot}/spending-ledger.json`
  const ledger = v.parse(ledgerSchema, await readJson(ledgerPath))
  if (plan.kind !== profile.planKind || plan.approval.budgetCents !== profile.budgetCents || plan.approval.evidence !== profile.approvalEvidence
    || ledger.kind !== profile.ledgerKind || ledger.budgetCents !== profile.budgetCents) throw new AppValidationError('Plan or ledger differs from the selected report profile')
  if (hash(await bytes(planPath)) !== ledger.planSha256) throw new AppValidationError('Execution plan differs from spending-ledger authorization')
  if (new Set(plan.cases.map(row => row.id)).size !== plan.cases.length || new Set(plan.pages.map(row => row.id)).size !== plan.pages.length
    || new Set(plan.targets.map(row => `${row.provider}/${row.model}`)).size !== plan.targets.length
    || plan.targets.filter(row => row.provider === 'tesseract' && row.model === 'tesseract').length !== 1
    || new Set(ledger.receipts.map(row => row.id)).size !== ledger.receipts.length) throw new AppValidationError('Duplicate or invalid batch identities')
  if (options.buildCaseIds && (options.reportProfile !== 'newspapers' || !options.buildCaseIds.length || new Set(options.buildCaseIds).size !== options.buildCaseIds.length
    || options.buildCaseIds.some(id => !plan.cases.some(entry => entry.id === id)))) throw new AppValidationError('Report rebuild filter must name distinct authorized cases')
  for (const receipt of ledger.receipts) {
    const page = plan.pages.find(row => row.id === receipt.caseId)
    if (!page || receipt.inputSha256 !== page.inputSha256 || receipt.documentCaseId !== undefined && receipt.documentCaseId !== page.caseId
      || !plan.targets.some(row => row.provider === receipt.provider && row.model === receipt.model)
      || receipt.status === 'rejected' && receipt.chargedCents !== 0
      || ['reserved', 'ambiguous'].includes(receipt.status) && receipt.chargedCents !== receipt.reservedCents
      || !Number.isFinite(Date.parse(receipt.createdAt))) throw new AppValidationError('Receipt differs from approved page or target')
  }
  const prepared = []
  const usedPages = new Set<string>()
  for (const entry of plan.cases) {
    const newspapers = options.reportProfile === 'newspapers'
    const efg = options.reportProfile === 'efg' || newspapers
    const efgCategory = entry.category === 'numeric-tables' || entry.category === 'handwriting' || entry.category === 'newspapers' ? entry.category : undefined
    if (entry.runDir !== `docs/benchmarks/text/ocr/${entry.id}` || entry.referenceKind === 'existing-consensus' && !entry.id.startsWith(profile.rerunPrefix)
      || (efg ? !efgCategory : options.reportProfile === 'advertisements' ? entry.category !== 'advertisements' : entry.category !== 'technical-code' && entry.category !== 'historical-print')
      || newspapers && (entry.category !== 'newspapers' || entry.referenceKind !== 'publisher-canonical' || !entry.id.startsWith('newspapers-expansion-') || entry.id.includes('north-star') || !entry.normalizedReference)) throw new AppValidationError('Case report destination or reference provenance is invalid')
    if (hash(await bytes(entry.input)) !== entry.inputSha256 || hash(await bytes(entry.reference)) !== entry.referenceSha256) throw new AppValidationError(`Source/reference hash changed: ${entry.id}`)
    const referenceText = new TextDecoder('utf-8', { fatal: true }).decode(await bytes(entry.reference))
    if (!referenceText.trim()) throw new AppValidationError('Reference text is empty')
    let regionCount: number | undefined
    const partialReference = entry.category === 'advertisements' && entry.referenceKind === 'publisher-canonical'
    if (partialReference) {
      if (entry.evaluationScope !== 'dataset-annotated-word-regions' || !entry.structuredReference || !entry.structuredReferenceSha256) throw new AppValidationError('Advertisement annotation scope/provenance is missing')
      const structuredBytes = await bytes(entry.structuredReference)
      if (hash(structuredBytes) !== entry.structuredReferenceSha256) throw new AppValidationError('Advertisement structured-reference hash changed')
      const structure = v.parse(advertisementReferenceSchema, JSON.parse(new TextDecoder().decode(structuredBytes)))
      const regions = new Map(structure.regions.filter(region => !region.ignore).map(region => [region.id, region.text]))
      const ids = structure.reviewedReadingOrder.lines.flat()
      if (new Set(structure.regions.map(region => region.id)).size !== structure.regions.length || new Set(ids).size !== regions.size
        || ids.length !== regions.size || ids.some(id => !regions.has(id))
        || structure.reviewedReadingOrder.lines.map(line => line.map(id => regions.get(id)).join(' ')).join('\n') + '\n' !== referenceText) throw new AppValidationError('Advertisement region text/order differs from the publisher reference')
      regionCount = regions.size
    }
    if (entry.normalizedReference) {
      const normalized = await bytes(entry.normalizedReference)
      if (!entry.normalizedReferenceSha256 || hash(normalized) !== entry.normalizedReferenceSha256
        || new TextDecoder().decode(normalized) !== normalizeHistoricalReference(referenceText)) throw new AppValidationError('Historical normalized reference differs from its declared conversion')
    }
    let readingReferenceText: string | undefined
    let efgStructure: ReturnType<typeof validateEfgOcrStructure> | undefined
    if (efg && entry.referenceKind === 'publisher-canonical') {
      if (!efgCategory || !entry.scope || !['full-page', 'region-crop'].includes(entry.scope) || !entry.serializationPolicy || !entry.structuredReference || !entry.structuredReferenceSha256) throw new AppValidationError('EFG reference scope/serialization provenance is missing')
      const structureBytes = await bytes(entry.structuredReference)
      if (hash(structureBytes) !== entry.structuredReferenceSha256) throw new AppValidationError('EFG structured-reference hash changed')
      efgStructure = validateEfgOcrStructure(efgCategory, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(structureBytes)), referenceText)
      if (efgCategory === 'newspapers' && !entry.normalizedReference || efgStructure.referenceStructureKind === 'reviewed-manuscript' && !entry.readingReference) throw new AppValidationError('Declared historical/manuscript companion reference is missing')
    }
    if (entry.readingReference) {
      const reading = await bytes(entry.readingReference)
      if (!efg || efgStructure?.referenceStructureKind !== 'reviewed-manuscript' || !entry.readingReferenceSha256 || hash(reading) !== entry.readingReferenceSha256) throw new AppValidationError('Manuscript reading-companion provenance/hash changed')
      readingReferenceText = new TextDecoder('utf-8', { fatal: true }).decode(reading)
      if (!readingReferenceText.trim()) throw new AppValidationError('Manuscript reading companion is empty')
    }
    if (!entry.readingReference && entry.readingReferenceSha256 || !entry.normalizedReference && entry.normalizedReferenceSha256) throw new AppValidationError('Reference companion path/hash pairing is incomplete')
    let referenceAdjudication: Record<string, unknown> | undefined
    if (newspapers && includeFidelity && entry.id === 'newspapers-expansion-bln-era-burglars') {
      const path = `${localRoot}/reference-adjudication-evidence.json`, proofBytes = await bytes(path), proof: unknown = JSON.parse(new TextDecoder().decode(proofBytes))
      if (!record(proof) || proof['kind'] !== 'ocr-newspaper-reference-adjudication-evidence' || proof['goldChangesApplied'] !== false || proof['primaryScoresChanged'] !== false || !Array.isArray(proof['entries'])) throw new AppValidationError('ERA source-spacing adjudication provenance is invalid')
      const matches = proof['entries'].filter(value => record(value) && value['caseId'] === entry.id)
      const item: unknown = matches[0]
      if (matches.length !== 1 || !record(item) || item['input'] !== entry.input || item['inputSha256'] !== entry.inputSha256
        || item['canonicalReference'] !== entry.reference || item['canonicalReferenceSha256'] !== entry.referenceSha256
        || item['printedReading'] !== 'some one' || item['frozenReferenceReading'] !== 'someone' || item['wordingInferredFromModelAgreement'] !== false
        || typeof item['evidenceImage'] !== 'string' || !item['evidenceImage'].startsWith(`${localRoot}/originals/`)
        || typeof item['evidenceImageSha256'] !== 'string' || !record(item['sourceCrop']) || !record(item['imageTransform']) || item['imageTransform']['resampling'] !== false) throw new AppValidationError('ERA source-spacing adjudication differs from the pinned input/reference')
      const evidenceBytes = await bytes(item['evidenceImage'])
      if (hash(evidenceBytes) !== item['evidenceImageSha256']) throw new AppValidationError('ERA source-spacing evidence image checksum changed')
      const source = decodePngRgba8(await bytes(entry.input)), crop = decodePngRgba8(evidenceBytes)
      const box = item['sourceCrop'], x = box['x'], y = box['y'], width = box['width'], height = box['height']
      if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number'
        || ![x, y, width, height].every(Number.isSafeInteger) || x < 0 || y < 0 || width < 1 || height < 1
        || x + width > source.width || y + height > source.height || crop.width !== width || crop.height !== height) throw new AppValidationError('ERA source-spacing evidence crop bounds changed')
      for (let row = 0; row < height; row++) for (let column = 0; column < width * 4; column++) {
        if (source.pixels[((y + row) * source.width + x) * 4 + column] !== crop.pixels[row * width * 4 + column]) throw new AppValidationError('ERA source-spacing evidence pixels differ from the pinned input')
      }
      referenceAdjudication = { path, sha256: hash(proofBytes), evidenceImage: item['evidenceImage'], evidenceImageSha256: item['evidenceImageSha256'],
        policy: 'Independent visual review of a pixel-identical crop of the pinned input; frozen primary gold and scores remain unchanged.' }
    }
    const pages = entry.pages.map(value => {
      const found = plan.pages.find(page => page.id === (typeof value === 'string' ? value : value.id))
      if (!found || found.caseId !== entry.id || typeof value !== 'string' && !isDeepStrictEqual(value, found) || usedPages.has(found.id)) throw new AppValidationError('Case/page membership differs from approved plan')
      usedPages.add(found.id)
      return found
    }).sort((a, b) => a.pageNumber - b.pageNumber)
    if (!pages.every((page, index) => page.pageNumber === index + 1)) throw new AppValidationError('Case page numbering must be complete and contiguous')
    for (const page of pages) if (hash(await bytes(page.input)) !== page.inputSha256) throw new AppValidationError('Approved rendered page bytes changed')
    const providers: PreparedProvider[] = []
    for (const target of plan.targets) {
      const savedPages: SavedPage[] = []
      for (const page of pages) {
        const directory = `${localRoot}/slots/${page.id}/${safeStem(`${target.provider}-${target.model}`)}`
        const journalPath = `${directory}/dispatch.json`
        const receipts = ledger.receipts.filter(row => row.caseId === page.id && row.provider === target.provider && row.model === target.model)
        if (!await Bun.file(within(journalPath)).exists()) { savedPages.push({ page, status: 'missing', journalPath, receipts }); continue }
        const journal = v.parse(journalSchema, await readJson(journalPath))
        if (journal.caseId !== page.id || journal.documentCaseId !== entry.id || journal.provider !== target.provider || journal.model !== target.model
          || journal.inputSha256 !== page.inputSha256 || journal.referenceSha256 !== entry.referenceSha256 || journal.directory !== directory
          || !Number.isFinite(Date.parse(journal.startedAt))) throw new AppValidationError('Page dispatch journal identity changed')
        if (newspapers && journal.status !== 'dispatch-started') {
          if (!journal.artifactHashes?.length || new Set(journal.artifactHashes.map(pin => pin.path)).size !== journal.artifactHashes.length) throw new AppValidationError('Newspaper journal lacks unique completed artifact pins')
          for (const pin of journal.artifactHashes) {
            portable(pin.path)
            if (!pin.path.startsWith(`${directory}/`) || hash(await bytes(pin.path)) !== pin.sha256) throw new AppValidationError('Saved newspaper artifact checksum changed')
          }
          for (const name of ['manifest.json', 'result.json', 'failure.txt']) {
            const path = `${directory}/${name}`
            if (await Bun.file(within(path)).exists() && !journal.artifactHashes.some(pin => pin.path === path)) throw new AppValidationError('Saved newspaper result or failure evidence is not journal-pinned')
          }
        }
        const status = journal.status === 'dispatch-started' ? 'running' : journal.status
        if (!journal.manifestSha256) {
          if (status === 'succeeded' || await Bun.file(within(`${directory}/manifest.json`)).exists()) throw new AppValidationError('Saved page manifest is not journal-pinned')
          const failurePath = `${directory}/failure.txt`
          const failureKind = newspapers && status === 'failed' && await Bun.file(within(failurePath)).exists()
            ? classifyNewspaperFailureLog(new TextDecoder('utf-8', { fatal: true }).decode(await bytes(failurePath))) : undefined
          savedPages.push({ page, status, journalPath, receipts, ...(failureKind ? { failureKind } : {}) }); continue
        }
        const manifestBytes = await bytes(`${directory}/manifest.json`)
        if (hash(manifestBytes) !== journal.manifestSha256) throw new AppValidationError('Saved page manifest checksum changed')
        const manifest: unknown = JSON.parse(new TextDecoder().decode(manifestBytes))
        if (!record(manifest) || manifest['command'] !== 'extract' || manifest['scope'] !== 'single' || !Array.isArray(manifest['items']) || manifest['items'].length !== 1) throw new AppValidationError('Invalid saved page manifest')
        const item: unknown = manifest['items'][0]
        if (!record(item) || item['extractRoute'] !== 'document' || !record(item['metadata']) || !record(item['metadata']['source'])
          || item['metadata']['source']['filePath'] !== page.input || !Array.isArray(item['providers']) || item['providers'].length !== 1) throw new AppValidationError('Saved page source differs from approved image')
        const state: unknown = item['providers'][0]
        if (!record(state) || state['service'] !== target.provider || state['model'] !== target.model || state['status'] !== journal.status || typeof state['artifactDir'] !== 'string') throw new AppValidationError('Saved page provider differs from journal')
        const artifact = state['artifactDir'] === '.' ? directory : `${directory}/${state['artifactDir']}`
        await existing(artifact)
        let result: unknown = state['result']
        if (await Bun.file(within(`${artifact}/result.json`)).exists()) {
          const sidecar = await readJson(`${artifact}/result.json`)
          if (result !== undefined && !isDeepStrictEqual(result, sidecar)) throw new AppValidationError('Saved inline and sidecar page results disagree')
          result = sidecar
        }
        let pageText: string | undefined
        let offlineResponseRecovery: Awaited<ReturnType<typeof admitEfgOfflineReplayArtifact>> | undefined
        if (status === 'succeeded') {
          if (!record(result) || !Array.isArray(result['pages']) || result['pages'].length !== 1 || !record(result['pages'][0])
            || !(result['pages'][0]['pageNumber'] === 1 || target.provider === 'mistral' && result['pages'][0]['pageNumber'] === 0)
            || typeof result['pages'][0]['text'] !== 'string' || !efg && entry.category !== 'advertisements' && !result['pages'][0]['text'].trim()) throw new AppValidationError('Successful saved result lacks exactly one nonempty page')
          if (newspapers) assertNewspaperOcrResultComplete(result, state['metadata'])
          // Mistral OCR returns zero-based page indices. This single-page adapter only
          // reads the text; assembled page numbers always come from the approved plan.
          pageText = result['pages'][0]['text']
          if (journal.offlineResponseReview) {
            if (!efg || target.provider !== 'grok' || target.model !== 'grok-4.7' || !record(state['metadata'])) throw new AppValidationError('Offline response review is outside its approved EFG Grok scope')
            offlineResponseRecovery = await admitEfgOfflineReplayArtifact(journal, pageText, state['metadata']['processingTime'], root)
            if (!receipts.some(row => row.id === offlineResponseRecovery!.receiptId && row.status === 'breach')) throw new AppValidationError('Offline response receipt is not retained in this exact page/model accounting')
          } else if (target.provider !== 'tesseract' && !receipts.some(row => row.status === 'settled' && Date.parse(row.createdAt) >= Date.parse(journal.startedAt))) throw new AppValidationError(`Successful page has no settled current-attempt receipt: ${page.id}/${target.provider}/${target.model}; live inspection may require a fresh stable snapshot`)
        }
        const metadata = state['metadata']
        const processingTimeMs = record(metadata) && typeof metadata['processingTime'] === 'number' && Number.isFinite(metadata['processingTime']) && metadata['processingTime'] >= 0 ? metadata['processingTime'] : undefined
        savedPages.push({ page, status, journalPath, manifestSha256: journal.manifestSha256, ...(pageText === undefined ? {} : { text: pageText }), ...(processingTimeMs === undefined ? {} : { processingTimeMs }), receipts,
          ...(newspapers && status === 'failed' ? { failureKind: classifyNewspaperOcrFailure(state['error']) } : {}),
          ...(offlineResponseRecovery ? { offlineResponseRecovery } : {}) })
      }
      const receipts = savedPages.flatMap(page => page.receipts)
      const spending = summarizeBcOcrReceipts(receipts)
      const status = savedPages.every(page => page.status === 'succeeded') ? 'succeeded' : savedPages.some(page => page.status === 'running') ? 'running'
        : savedPages.some(page => page.status === 'missing') ? 'missing' : 'failed'
      const resultPages = savedPages.filter(page => page.status === 'succeeded').map(page => ({ pageNumber: page.page.pageNumber, method: 'ocr', text: page.text! }))
      const result = status === 'succeeded' ? { text: resultPages.some(page => page.text.trim()) ? resultPages.map(page => `--- Page ${page.pageNumber} ---\n${page.text}`).join('\n\n') : '', pages: resultPages, totalPages: pages.length, ocrPages: pages.length, textPages: 0 } : undefined
      const timeComplete = savedPages.every(page => page.processingTimeMs !== undefined)
      const state = { service: target.provider, model: target.model, local: target.provider === 'tesseract', artifactDir: bcOcrReportArtifactDir(target.provider, target.model), status,
        attempts: savedPages.length, options: {}, metadata: { totalPages: pages.length, ocrPages: resultPages.length, textPages: 0, inputFamily: entry.category === 'advertisements' || efg && pages.every(page => page.input === entry.input) ? 'original-image' : 'pinned-rendered-pages',
          ...(timeComplete ? { processingTime: savedPages.reduce((sum, page) => sum + page.processingTimeMs!, 0) } : {}),
          completedPages: resultPages.length, failedPages: savedPages.filter(page => page.status === 'failed').length, spending,
          ...(savedPages.some(page => page.offlineResponseRecovery) ? { offlineResponseRecovery: savedPages.flatMap(page => page.offlineResponseRecovery ? [page.offlineResponseRecovery] : []) } : {}),
          pageEvidence: savedPages.map(page => ({ pageId: page.page.id, pageNumber: page.page.pageNumber, status: page.status, dispatchJournal: page.journalPath,
            ...(page.manifestSha256 ? { manifestSha256: page.manifestSha256 } : {}), ...(page.failureKind ? { failureKind: page.failureKind } : {}), httpStatus: page.receipts.at(-1)?.httpStatus ?? null })) },
        ...(status === 'succeeded' ? {} : { error: { code: status === 'missing' || status === 'running' ? 'INCOMPLETE_PAGE_COVERAGE' : 'FAILED_PAGE_COVERAGE', message: 'No full-document quality score is assigned unless every declared page succeeds. Raw provider evidence remains private.' } }) }
      providers.push({ target, pages: savedPages, status, receipts, state, ...(result ? { result } : {}) })
    }
    const receipts = providers.flatMap(provider => provider.receipts)
    const spending = summarizeBcOcrReceipts(receipts)
    const pending = providers.filter(provider => ['missing', 'running'].includes(provider.status)).length
    const evaluation = partialReference ? { scope: 'dataset-annotated-word-regions', officialAnnotatedWordRegions: regionCount,
      referenceOrdering: 'Reviewed derived convention; not official TextOCR gold reading order', outputGeometryAvailable: false,
      primaryRegionAccuracyAvailable: false, primaryQualityUnavailableReason: advertisementScopeReason,
      fullImageReferenceExhaustive: false, secondaryDiagnostics: 'Order-independent annotated-token coverage and derived-order partial-reference WER/CER; neither is localized recognition accuracy.' }
      : efgCategory && efg ? { ...efgOcrEvaluationPolicy(efgCategory, entry.scope ?? 'archived-baseline-page', entry.referenceKind === 'publisher-canonical', efgStructure),
        ...(entry.sourceFamily ? { sourceFamily: entry.sourceFamily } : {}), ...(entry.synthetic === undefined ? {} : { synthetic: entry.synthetic }),
        ...(newspapers ? { lexicalNormalization: 'NFKC, declared quote/dash folding and whitespace folding applied to BOTH reference and candidate before existing OCR WER/CER normalization; raw texts preserved privately.',
          analysisVariant: 'newspaper-reading-normalized-v1',
          challengePanel: entry.id.includes('new-york-times') ? 'very-long-page-capacity' : entry.scope === 'full-page' ? 'whole-page-layout' : 'region-recognition' } : {}) } : undefined
    const coverage = { status: pending ? 'in-progress' : providers.some(provider => provider.status === 'failed') ? 'partial-provider-failures' : 'complete',
      configuredModels: providers.length, attemptedModels: providers.filter(provider => provider.pages.some(page => page.status !== 'missing')).length,
      successfulModels: providers.filter(provider => provider.status === 'succeeded').length, successfulHostedModels: providers.filter(provider => provider.target.provider !== 'tesseract' && provider.status === 'succeeded').length,
      successfulLocalModels: providers.filter(provider => provider.target.provider === 'tesseract' && provider.status === 'succeeded').length,
      failedModels: providers.filter(provider => provider.status === 'failed').length, pendingModels: pending, expectedPageSlots: pages.length * providers.length,
      successfulPageSlots: providers.reduce((sum, provider) => sum + provider.pages.filter(page => page.status === 'succeeded').length, 0), spending,
      qualityCoverage: partialReference ? advertisementScopeReason : 'Full-document headline scores require all pages. Failed and incomplete models have no invented quality score; successful page evidence remains private.' }
    const privateDirectory = `${localRoot}/benchmark-runs/${entry.id}`
    const publisher = entry.referenceKind === 'publisher-canonical' ? { kind: 'publisher-canonical', path: newspapers ? entry.normalizedReference! : entry.reference, sha256: newspapers ? entry.normalizedReferenceSha256! : entry.referenceSha256,
      sourceUrl: entry.annotationURL ?? entry.sourceURL, sourceRevision: entry.annotationRevision ?? entry.sourceRevision,
      description: partialReference ? 'Independent publisher word-region text in a reviewed derived order. This is a partial image reference, not exhaustive full-image gold; text-only outputs do not establish region accuracy.' : newspapers ? 'Declared reading-normalized derivative of independently supplied publisher gold. Both candidate and reference receive the same conversion; raw diplomatic text remains separately preserved.' : 'Immutable publisher reference supplied independently of OCR outputs; its reviewed conversion policy is preserved in the prepared input bundle.' } : undefined
    const reference = publisher ?? { kind: 'existing-consensus', path: entry.reference, sha256: entry.referenceSha256,
      sourceUrl: entry.sourceURL, sourceRevision: entry.sourceRevision, independentOfProviders: false, description: 'Existing archived multi-provider consensus, copied byte for byte; this baseline is not independent publisher gold.' }
    const costSteps = providers.flatMap(provider => {
      const money = summarizeBcOcrReceipts(provider.receipts)
      return provider.target.provider === 'tesseract' || provider.receipts.some(row => row.status === 'settled') || money.heldReservationCents > 0
        ? [{ step: 'extract', provider: provider.target.provider, model: provider.target.model, cost: money.accountedCents,
          costSource: provider.target.provider === 'tesseract' ? 'local_zero' : money.heldReservationCents > 0 || money.settledConservativeCents > 0 ? 'conservative_upper_bound' : 'provider_usage_at_reviewed_rates', costAccounting: money }] : []
    })
    const timingSteps = providers.filter(provider => provider.status === 'succeeded' && typeof (provider.state['metadata'] as Record<string, unknown>)['processingTime'] === 'number').map(provider => ({ step: 'extract', provider: provider.target.provider, model: provider.target.model, processingTimeMs: (provider.state['metadata'] as Record<string, number>)['processingTime']! }))
    const inputFamily = entry.category === 'advertisements' || efg && pages.every(page => page.input === entry.input) ? 'original-image' : 'pinned-rendered-pages'
    const format = efg ? /\.pdf$/i.test(entry.input) ? 'pdf-rendered-png' : /\.jpe?g$/i.test(pages[0]!.input) ? 'jpeg' : 'png'
      : entry.category === 'advertisements' ? 'jpeg' : pages.length === 1 ? 'png' : 'pdf-rendered-png'
    const manifest = { command: 'extract', scope: 'single', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...(publisher ? { reference: publisher } : {}),
      source: { kind: profile.sourceKind, sourceRunDir: privateDirectory, execution: `${localRoot}/execution.json`, spendingLedger: ledgerPath, reference, coverage,
        ...(newspapers ? { originalCanonicalReference: { path: entry.reference, sha256: entry.referenceSha256 }, analysisVariant: 'newspaper-reading-normalized-v1' } : {}),
        protocol: profile.protocol, ...(evaluation ? { evaluation } : {}), providerResultsPublished: false },
      items: [{ input: entry.input, inputFamily, extractRoute: 'document', outputDir: '.', status: coverage.status === 'complete' ? 'full' : 'incomplete',
        metadata: { step1: { title: entry.id, slug: entry.id, pageCount: pages.length, format }, source: { filePath: entry.input }, coverage,
          ...(evaluation ? { evaluation } : {}),
          resolvedStep2: { route: 'ocr', sourceKind: inputFamily, providers: plan.targets.map(target => ({ service: target.provider, model: target.model })) },
          cost: { actual: { totalCost: spending.accountedCents, steps: costSteps }, accounting: spending, totalCostPolicy: 'Cumulative accounted cents include settled retry costs and retained reservations; these are not invoice-reconciled charges.' },
          timing: { actual: { totalProcessingTimeMs: timingSteps.reduce((sum, step) => sum + step.processingTimeMs, 0), steps: timingSteps } },
          step2: providers.filter(provider => provider.status === 'succeeded').map(provider => provider.state['metadata']) }, providers: providers.map(provider => provider.state) }] }
    const prepareFidelity = includeFidelity && (!options.buildCaseIds || options.buildCaseIds.includes(entry.id))
    const supplementalReference = prepareFidelity && entry.referenceKind === 'existing-consensus' ? parseConsensusExtraction(await existing(entry.reference)).pages.map(page => page.text).join('\n\n') : referenceText
    const diagnosticFileName = entry.category === 'advertisements' || efg ? 'evaluation-diagnostics.json' : 'fidelity-metrics.json'
    const fidelity = prepareFidelity ? { schemaVersion: 1, kind: entry.category === 'advertisements' ? 'ocr-advertisement-evaluation-diagnostics' : efg ? 'ocr-categories-efg-evaluation-diagnostics' : 'ocr-category-fidelity-metrics', caseId: entry.id, category: entry.category, reference,
      ...(newspapers ? { literalReference: { path: entry.reference, sha256: entry.referenceSha256 }, literalCandidateSource: 'Original saved per-page outputs, before reading normalization; no source or provider wording is rewritten.' } : {}),
      ...(referenceAdjudication ? { sourceReferenceAdjudication: referenceAdjudication } : {}),
      headlineMetric: partialReference ? advertisementScopeReason : 'The standard report uses lexical-normalized WER/CER. These separate fidelity diagnostics preserve punctuation, case, glyphs and formatting.',
      ...(evaluation ? { evaluation } : {}),
      pageBoundaryPolicy: entry.referenceKind === 'existing-consensus' ? 'The archived consensus parser removes page wrappers and trims page edges; candidate page edges receive the same treatment before strict diagnostics.' : 'The exact single-page reference and saved page text retain their whitespace apart from line-ending/final-newline convention.',
      providers: providers.filter(provider => provider.status === 'succeeded').map(provider => ({ providerKey: `${provider.target.provider}/${provider.target.model}`, provider: provider.target.provider, model: provider.target.model,
        ...(entry.category === 'advertisements' ? partialReference
          ? scoreAnnotatedTokenCoverage(supplementalReference, provider.result!.pages.map(page => page.text).join('\n\n'))
          : { strictTextExact: canonicalLines(supplementalReference) === canonicalLines(provider.result!.pages.map(page => page.text.trim()).join('\n\n')),
              strictCharacterErrorRate: strictRatio(canonicalLines(supplementalReference), canonicalLines(provider.result!.pages.map(page => page.text.trim()).join('\n\n'))) }
          : efgCategory && efg ? scoreEfgOcrFidelity(supplementalReference, provider.result!.pages.map(page => entry.referenceKind === 'existing-consensus' ? page.text.trim() : page.text).join('\n\n'), efgCategory, bcExactCharacterDistance, readingReferenceText)
            : scoreBcOcrFidelity(supplementalReference, provider.result!.pages.map(page => entry.referenceKind === 'existing-consensus' ? page.text.trim() : page.text).join('\n\n'), entry.category === 'historical-print' ? 'historical-print' : 'technical-code')),
        ...(newspapers ? { tokenMultiset: scoreNewspaperTokenMultiset(supplementalReference, provider.result!.pages.map(page => page.text).join('\n\n')) } : {}),
        ...(newspapers ? { repetition: scoreNewspaperRepetition(supplementalReference, provider.result!.pages.map(page => page.text).join('\n\n')) } : {}),
        ...(newspapers && entry.id === 'newspapers-expansion-bln-era-burglars' ? { sourceSpacingConvention: scoreNewspaperSpacingConvention(entry.id, supplementalReference, provider.result!.pages.map(page => page.text).join('\n\n')) } : {}) })) } : undefined
    const metadata = { schemaVersion: 1, kind: 'ocr-benchmark-case', caseId: entry.id, category: entry.category, language: 'en', pageCount: pages.length,
      input: { path: entry.input, sha256: entry.inputSha256, sourceUrl: entry.sourceURL }, reference, coverage, privateRunDir: privateDirectory, providerResultsPublished: false,
      ...(newspapers ? { originalCanonicalReference: { path: entry.reference, sha256: entry.referenceSha256 }, analysisVariant: 'newspaper-reading-normalized-v1' } : {}),
      ...(entry.rights ? { rights: entry.rights } : {}), ...(entry.attribution ? { attribution: entry.attribution } : {}),
      ...(evaluation ? { evaluation } : {}), ...(entry.structuredReference ? { structuredReference: { path: entry.structuredReference, sha256: entry.structuredReferenceSha256 } } : {}),
      ...(entry.normalizedReference ? { normalizedReference: { path: entry.normalizedReference, sha256: entry.normalizedReferenceSha256 } } : {}),
      ...(entry.readingReference ? { readingReference: { path: entry.readingReference, sha256: entry.readingReferenceSha256 } } : {}),
      ...(entry.serializationPolicy ? { serializationPolicy: entry.serializationPolicy } : {}),
      ...(entry.scope ? { scope: entry.scope } : {}), ...(entry.sourceFamily ? { sourceFamily: entry.sourceFamily } : {}), ...(entry.synthetic === undefined ? {} : { synthetic: entry.synthetic }),
      pageInputs: pages.map(page => ({ id: page.id, path: page.input, sha256: page.inputSha256, width: page.width, height: page.height })) }
    prepared.push({ entry, referenceText, privateDirectory, manifest, metadata, providers, coverage, fidelity, partialReference, evaluation, diagnosticFileName, efg, newspapers })
  }
  if (usedPages.size !== plan.pages.length) throw new AppValidationError('Unassigned plan pages cannot be silently excluded')
  return { root, within, prepared, ledger, profile, overview: { mode: 'local-read-only-no-provider-calls', cases: prepared.map(row => ({ id: row.entry.id, ...row.coverage })), spending: summarizeBcOcrReceipts(ledger.receipts) } }
}

export const inspectBcOcrReports = async (options: BcOcrReportOptions = {}) => (await prepare(options)).overview

/** Build derived results and metric-only public reports from saved artifacts; this never dispatches OCR. */
export const buildBcOcrReports = async (options: BcOcrReportOptions = {}) => {
  const context = await prepare(options, true)
  const localRoot = context.profile.localRoot
  const selectedCases = context.prepared.filter(row => !options.buildCaseIds || options.buildCaseIds.includes(row.entry.id))
  if (options.reportProfile === 'newspapers') for (const row of selectedCases) {
    if (!row.providers.some(provider => provider.result) && await Bun.file(context.within(`${row.entry.runDir}/provider-comparison-report.json`)).exists()) {
      throw new AppValidationError('Zero-completion newspaper case has an existing comparison; preserve and reconcile it before replacing coverage')
    }
  }
  if (context.prepared.some(row => row.coverage.pendingModels > 0)) {
    if (options.reportProfile !== 'newspapers') throw new AppValidationError('Page slots are missing or running; report assembly is deferred')
    const pages = context.prepared.flatMap(row => row.providers.flatMap(provider => provider.pages.map(page => ({ ...page, provider: provider.target.provider, model: provider.target.model }))))
    const missing = pages.filter(page => page.status === 'missing')
    if (pages.some(page => page.status === 'running') || missing.some(page => page.receipts.length)) throw new AppValidationError('Missing newspaper slots are not confirmed terminal and unattempted')
    const executionPath = await realpath(context.within(`${localRoot}/execution.json`))
    const rel = relative(context.root, executionPath)
    if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new AppValidationError('Terminal execution evidence escapes project root')
    const execution: unknown = await Bun.file(executionPath).json()
    if (!record(execution) || !['completed', 'completed-with-provider-failure', 'blocked-retained-evidence'].includes(String(execution['status']))
      || execution['planSha256'] !== context.ledger.planSha256 || typeof execution['completedAt'] !== 'string' || !Number.isFinite(Date.parse(execution['completedAt']))
      || !record(execution['lanes']) || execution['lanes']['active'] !== 0
      || execution['intendedSlots'] !== pages.length || execution['pendingSlots'] !== missing.length || execution['completedSlots'] !== pages.length - missing.length
      || !Array.isArray(execution['slots'])) throw new AppValidationError('Missing newspaper slots lack a matching terminal execution snapshot')
    for (const key of ['activeByProvider', 'activeByModel']) {
      const active = execution['lanes'][key]
      if (!record(active) || Object.values(active).some(value => value !== 0)) throw new AppValidationError('Newspaper execution still has active provider work')
    }
    const expected = pages.filter(page => page.status !== 'missing').map(page => `${page.page.id}/${page.provider}/${page.model}/${page.status}`).sort()
    const actual = execution['slots'].map(value => record(value) ? `${String(value['caseId'])}/${String(value['provider'])}/${String(value['model'])}/${String(value['status'])}` : '').sort()
    if (!isDeepStrictEqual(actual, expected)) throw new AppValidationError('Terminal newspaper slot inventory differs from saved dispatch journals')
    for (const row of context.prepared) if (row.coverage.pendingModels) {
      row.coverage.status = 'terminal-not-fully-dispatched'
      row.coverage.qualityCoverage = 'The matching terminal execution snapshot confirms these selected slots were not dispatched and have no admitted receipts. Their scores remain unavailable; they are not fabricated provider failures.'
    }
    context.overview.cases = context.prepared.map(row => ({ id: row.entry.id, ...row.coverage }))
  }
  const writeJson = (path: string, value: unknown): void => writePortableFileSync(context.within(path), JSON.stringify(value) + '\n')
  const runConsensus = options.runConsensus ?? (async (argv: readonly string[], caseId: string): Promise<void> => {
    const child = Bun.spawn([process.execPath, 'scripts/run.ts', ...argv], { cwd: resolve(PROJECT_ROOT, '.codex/skills/consensus'), env: { ...process.env, AUTOSHOW_PROJECT_ROOT: context.root }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    if (exit !== 0) throw new AppInfrastructureError(`Local consensus report failed for ${caseId} (exit ${exit}): ${(stderr || stdout).slice(-1200)}`)
  })
  for (const row of selectedCases) {
    if (!row.fidelity) throw new AppValidationError('Supplemental fidelity metrics were not prepared for report assembly')
    const stage = `${localRoot}/benchmark-runs/.${row.entry.id}.assembly-${randomUUID()}`
    await mkdir(context.within(stage), { recursive: true })
    writeJson(`${stage}/manifest.json`, row.manifest)
    if (row.entry.referenceKind === 'existing-consensus') writePortableFileSync(context.within(`${stage}/consensus-extraction.txt`), row.referenceText)
    for (const provider of row.providers) {
      if (!provider.result) continue
      const destination = `${stage}/${bcOcrReportArtifactDir(provider.target.provider, provider.target.model)}`
      await mkdir(context.within(destination), { recursive: true })
      let analysisResult = provider.result
      if (row.newspapers) {
        writeJson(`${destination}/raw-result.json`, provider.result)
        writePortableFileSync(context.within(`${destination}/raw-extraction.txt`), provider.result.text + '\n')
        const pages = provider.result.pages.map(page => ({ ...page, text: page.text.trim() ? normalizeHistoricalReference(page.text) : '' }))
        analysisResult = { ...provider.result, pages, text: pages.some(page => page.text.trim()) ? pages.map(page => `--- Page ${page.pageNumber} ---\n${page.text}`).join('\n\n') : '' }
      }
      writeJson(`${destination}/result.json`, analysisResult)
      writePortableFileSync(context.within(`${destination}/extraction.txt`), analysisResult.text + '\n')
    }
    if (await Bun.file(context.within(`${row.privateDirectory}/manifest.json`)).exists()) {
      const backup = `${localRoot}/prior-assemblies/${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}/${row.entry.id}`
      await mkdir(dirname(context.within(backup)), { recursive: true })
      await rename(context.within(row.privateDirectory), context.within(backup))
    }
    await rename(context.within(stage), context.within(row.privateDirectory))
    await mkdir(context.within(row.entry.runDir), { recursive: true })
    writeJson(`${row.entry.runDir}/manifest.json`, row.manifest)
    writeJson(`${row.entry.runDir}/case-metadata.json`, row.metadata)
    writeJson(`${row.entry.runDir}/${row.diagnosticFileName}`, row.fidelity)
    if (row.newspapers && !row.providers.some(provider => provider.result)) {
      // The ordinary consensus builder cannot score an empty provider set.
      // Preserve selected-slot coverage without inventing a comparison report.
      continue
    }
    await runConsensus(['ocr', 'build-packet', context.within(row.privateDirectory), '--out', context.within(`${row.privateDirectory}/consensus-packet.json`)], row.entry.id)
    await runConsensus(['ocr', 'build-report', context.within(row.privateDirectory), '--markdown-out', context.within(`${row.entry.runDir}/provider-comparison-report.md`), '--json-out', context.within(`${row.entry.runDir}/provider-comparison-report.json`)], row.entry.id)
    const path = `${row.entry.runDir}/provider-comparison-report.json`
    const generatedReport: unknown = await Bun.file(context.within(path)).json()
    if (!record(generatedReport)) throw new AppValidationError('Generated metric report is invalid')
    let report: Record<string, unknown> = generatedReport
    if (row.partialReference) {
      const orderedDiagnostics: Array<Record<string, unknown>> = []
      if (record(report['providerGroups'])) for (const group of Object.values(report['providerGroups'])) {
        if (!record(group) || !Array.isArray(group['providers'])) continue
        for (const provider of group['providers']) {
          if (!record(provider) || !record(provider['metrics'])) throw new AppValidationError('Generated provider metrics are invalid')
          orderedDiagnostics.push({ providerKey: provider['providerKey'], normalizedWER: provider['metrics']['wer'] ?? null,
            normalizedCER: provider['metrics']['cer'] ?? null, werEditBreakdown: provider['werBreakdown'] ?? null, cerEditBreakdown: provider['cerBreakdown'] ?? null })
          provider['metrics'] = { ...provider['metrics'], wer: null, cer: null, score: null }
          provider['werBreakdown'] = null; provider['cerBreakdown'] = null
          provider['qualityMetric'] = null; provider['qualityValue'] = null; provider['qualityLabel'] = 'Unavailable: partial reference without output geometry'
          provider['qualityUnavailableReason'] = advertisementScopeReason
        }
      }
      report['metric'] = 'word-region-accuracy-unavailable'
      report['scoreFormula'] = null
      report['werFormula'] = 'Secondary derived-order / partial-reference edit comparison only; candidate additions are not automatically recognition errors.'
      report['primaryQualityUnavailableReason'] = advertisementScopeReason
      report['evaluation'] = row.evaluation
      report['notes'] = (Array.isArray(report['notes']) ? report['notes'] : []).filter(note => typeof note !== 'string' || !/^Best (?:local|cloud service)/.test(note))
      writeJson(`${row.entry.runDir}/${row.diagnosticFileName}`, { ...row.fidelity,
        orderedReferenceDiagnostics: { purpose: 'Secondary comparisons sensitive to the derived reading order and partial reference. Unmatched output may be valid unannotated image text; these edit counts are not primary OCR-error attribution.', providers: orderedDiagnostics } })
      writeJson(path, report)
      // Keep the excluded skill surface implementation outside the application's
      // TypeScript graph; this subprocess only rewrites local metric artifacts.
      const rewrite = Bun.spawn([process.execPath, '-e', 'const m = await import(process.argv[1]); m.rewriteComparisonReports({category:"ocr",jsonPath:process.argv[2],markdownPath:process.argv[3]});',
        resolve(PROJECT_ROOT, '.codex/skills/consensus/scripts/shared/report_surfaces.ts'), context.within(path), context.within(`${row.entry.runDir}/provider-comparison-report.md`)],
        { env: { ...process.env, AUTOSHOW_PROJECT_ROOT: context.root }, stdout: 'pipe', stderr: 'pipe' })
      const [, stderr, exit] = await Promise.all([new Response(rewrite.stdout).text(), new Response(rewrite.stderr).text(), rewrite.exited])
      if (exit !== 0) throw new AppInfrastructureError(`Local partial-reference report rewrite failed: ${stderr.slice(-1200)}`)
      const rewritten: unknown = await Bun.file(context.within(path)).json()
      if (!record(rewritten)) throw new AppValidationError('Rewritten partial-reference report is invalid')
      report = rewritten
      report['evaluation'] = row.evaluation
      report['primaryQualityUnavailableReason'] = advertisementScopeReason
      report['metric'] = 'word-region-accuracy-unavailable'
      report['scoreFormula'] = null
      if (record(report['referenceProvenance'])) report['referenceProvenance'] = { ...report['referenceProvenance'],
        evaluationScope: 'dataset-annotated-word-regions', fullImageReferenceExhaustive: false, primaryRegionAccuracyAvailable: false,
        referenceOrdering: 'Reviewed derived convention, not official dataset gold order' }
      for (const name of ['page-metrics.json', 'outliers.json', 'selective-adjudication-pages.json', 'variant-comparison-summary.json']) {
        const artifactPath = `${row.entry.runDir}/${name}`, artifact: unknown = await Bun.file(context.within(artifactPath)).json()
        if (!record(artifact)) throw new AppValidationError('Generated analysis sidecar is invalid')
        writeJson(artifactPath, { ...artifact, evaluation: row.evaluation, primaryQualityUnavailableReason: advertisementScopeReason })
      }
      const summaryPath = `${row.entry.runDir}/ocr-benchmark-summary.md`
      const summary = await Bun.file(context.within(summaryPath)).text()
      writePortableFileSync(context.within(summaryPath), `> Evaluation scope: ${advertisementScopeReason}\n\n${summary}\n\nAnnotated-token coverage and ordered-reference comparisons are diagnostics only; they do not establish localized or exhaustive full-image accuracy.\n`)
    }
    if (row.entry.referenceKind === 'existing-consensus') report['referenceProvenance'] = { kind: 'existing-consensus', independentOfProviders: false,
      path: row.entry.reference, sha256: row.entry.referenceSha256, sourceUrl: row.entry.sourceURL, sourceRevision: row.entry.sourceRevision,
      description: 'Existing archived multi-provider consensus reused byte for byte; this is not independently supplied publisher gold.' }
    if (row.efg) {
      report['evaluation'] = row.evaluation
      if (record(report['referenceProvenance'])) report['referenceProvenance'] = { ...report['referenceProvenance'],
        evaluationScope: row.entry.scope ?? 'archived-baseline-page', ...(row.entry.serializationPolicy ? { serializationPolicy: row.entry.serializationPolicy } : {}),
        structureAccuracyAvailable: false, primaryLexicalAccuracyAvailable: true }
      for (const name of ['page-metrics.json', 'outliers.json', 'selective-adjudication-pages.json', 'variant-comparison-summary.json']) {
        const artifactPath = `${row.entry.runDir}/${name}`, artifact: unknown = await Bun.file(context.within(artifactPath)).json()
        if (!record(artifact)) throw new AppValidationError('Generated analysis sidecar is invalid')
        writeJson(artifactPath, { ...artifact, evaluation: row.evaluation })
      }
      const summaryPath = `${row.entry.runDir}/ocr-benchmark-summary.md`, summary = await Bun.file(context.within(summaryPath)).text()
      writePortableFileSync(context.within(summaryPath), `> Evaluation scope: lexical recognition against the declared page/crop reference and its reading-order convention. Table structure, branch association and page geometry are unavailable from text-only outputs. Fidelity diagnostics are separate representation comparisons.\n\n${summary.trimEnd()}\n`)
    }
    const costLookup = new Map(row.providers.map(provider => [`${provider.target.provider}/${provider.target.model}`, summarizeBcOcrReceipts(provider.receipts)]))
    const attach = (value: unknown): void => {
      if (!record(value) || typeof value['providerKey'] !== 'string') return
      const money = costLookup.get(value['providerKey'])
      if (money) { value['costAccounting'] = money; value['costSource'] = money.heldReservationCents > 0 || money.settledConservativeCents > 0 ? 'conservative_upper_bound' : value['providerKey'] === 'tesseract/tesseract' ? 'local_zero' : 'provider_usage_at_reviewed_rates' }
    }
    if (record(report['providerGroups'])) for (const group of Object.values(report['providerGroups'])) if (record(group) && Array.isArray(group['providers'])) group['providers'].forEach(attach)
    if (record(report['metricRankings'])) for (const group of Object.values(report['metricRankings'])) if (record(group) && Array.isArray(group['price'])) group['price'].forEach(attach)
    const notes = ['Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.',
      row.entry.referenceKind === 'existing-consensus' ? 'Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.' : 'Reference provenance: immutable publisher canonical text supplied independently of provider outputs.',
      options.reportProfile === 'advertisements' || row.efg ? context.profile.protocol : 'The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.',
      'Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.',
      row.partialReference ? advertisementScopeReason : `Supplemental ${row.diagnosticFileName} retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.`]
    report['notes'] = [...(Array.isArray(report['notes']) ? report['notes'] : []), ...notes]
    if (row.entry.category === 'advertisements' || row.efg) report['evaluationDiagnosticsPath'] = `${row.entry.runDir}/${row.diagnosticFileName}`
    else report['fidelityMetricsPath'] = `${row.entry.runDir}/${row.diagnosticFileName}`
    report['coverage'] = row.coverage
    writeJson(path, report)
    const markdownPath = `${row.entry.runDir}/provider-comparison-report.md`
    let markdown = await Bun.file(context.within(markdownPath)).text()
    if (row.partialReference) markdown = markdown
      .replace('- Ranking metric: word error rate (WER) against the independent publisher canonical reference.', `- Primary region accuracy: unavailable. ${advertisementScopeReason}`)
      .replace('- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.', '- Annotated-token coverage and ordered-reference WER/CER are secondary diagnostics; they are not primary accuracy scores.')
      .replace('- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.', '- Publisher word-region text is independently supplied. Its reviewed order is a derived convention, and it is not exhaustive full-image gold.')
      .replace('- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.', '- Primary Quality Score values are unavailable for this partial-reference/text-only protocol; price and speed remain measurable.')
      .replace(/## Error Breakdown \(WER\)[\s\S]*?(?=\n## Notes)/, `## Primary region accuracy unavailable\n\n${advertisementScopeReason}\n\n`)
    if (row.partialReference) {
      const headers = ['Provider', 'Annotated-token coverage', 'Matched / reference', 'Missing tokens', 'Unmatched output tokens']
      const cells = row.fidelity.providers.flatMap(provider => {
        const value: Record<string, unknown> = { ...provider }
        if (typeof value['annotatedNormalizedTokenCoverage'] !== 'number') return []
        return [[`\`${String(value['providerKey'])}\``, `${(value['annotatedNormalizedTokenCoverage'] * 100).toFixed(2)}%`,
          `${String(value['matchedReferenceTokens'])} / ${String(value['referenceNormalizedTokenCount'])}`,
          String(value['missingReferenceTokens']), String(value['unmatchedCandidateTokens'])]]
      })
      const widths = headers.map((header, index) => Math.max(header.length, ...cells.map(cell => cell[index]!.length)))
      const tableRow = (values: string[]) => '| ' + values.map((value, index) => value.padEnd(widths[index]!)).join(' | ') + ' |'
      const table = [tableRow(headers), tableRow(widths.map(width => '-'.repeat(width))), ...cells.map(tableRow)].join('\n')
      markdown += `\n## Annotated-token coverage diagnostic\n\n${advertisementScopeReason}\n\nUnmatched output can be valid unannotated image text; the counts below are not false-positive counts. Duplicate targets count separately under the declared lexical normalization. These unranked text-presence diagnostics do not establish where a word was read.\n\n${table}\n\n[Evaluation policy and secondary ordered-text diagnostics](${row.diagnosticFileName}).\n`
    }
    if (row.efg && row.evaluation) {
      const evaluation = row.evaluation as Record<string, unknown>
      markdown += `\n## Lexical evaluation scope\n\nReference scope: ${row.entry.scope ?? 'archived baseline page'}. ${String(evaluation['referenceTextScope'])}\n\n${String(evaluation['lexicalMetricLimitation'])}\n\n${String(evaluation['structureAccuracyUnavailableReason'])}\n\n${String(evaluation['fidelityMetricLimitation'])}\n\n[Literal numeric, punctuation and alternate-reading diagnostics](${row.diagnosticFileName}) retain all source and provider text privately.\n`
    }
    writePortableFileSync(context.within(markdownPath), markdown.replaceAll('| Actual Cost |', '| Accounted Cost |') + `\n## Coverage and fidelity\n\n${notes.map(note => `- ${note}`).join('\n')}\n`)
  }
  return { ...context.overview, mode: 'built-local-reports-no-provider-calls' }
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2)
    if (args.length > 1 || args.some(arg => !['--help', '--build'].includes(arg))) throw new AppUsageError('Usage: bun src/tools/ocr-categories-bc-report.ts [--build]')
    if (args[0] === '--help') writeCommandPayload(('Usage: bun src/tools/ocr-categories-bc-report.ts [--build]\nDefault: read-only coverage/spending inspection. --build assembles saved page evidence and metric-only consensus reports. No network, OCR reruns or provider calls.') + '\n')
    else writeCommandPayload((JSON.stringify(args[0] === '--build' ? await buildBcOcrReports() : await inspectBcOcrReports(), null, 2)) + '\n')
  } catch (error) { writeCommandPayload((error instanceof Error ? error.message : 'Local B/C report assembly failed') + '\n', 'stderr'); process.exitCode = 1 }
}
