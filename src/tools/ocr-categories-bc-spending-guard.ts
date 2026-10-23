import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'
import { isRecord, readJsonResponse } from '~/utils/rest-client'
import { decodePngRgba8 } from '~/utils/lossless-png'
import sourceCatalog from '../../docs/benchmarks/ocr/source-catalog.json'
import { CLEAN_TYPOGRAPHY_SPENDING_RATES as CATEGORIES_BC_SPENDING_RATES } from './ocr-clean-typography-spending-guard'
export { CATEGORIES_BC_SPENDING_RATES }

// Isolated benchmark authorization, never a general CLI spending guarantee.
// The input allowance is a deliberately generous assumption, not a measured token count.
export const CATEGORIES_BC_INPUT_ALLOWANCE = 64_000
export const CATEGORIES_BC_OPENAI_OUTPUT_CAP = 16_384
export const CATEGORIES_BC_BUDGET_CENTS = 3000
export const CATEGORIES_BC_GROK_VISIBLE_OUTPUT_CAP = 4096
export const CATEGORIES_BC_GROK_REASONING_ALLOWANCE = 32_768
export const CATEGORIES_BC_GROK_REVIEWED_POLICY = 'grok-visible-4096-plus-unmeasured-reasoning-32768'
export const CATEGORIES_BC_GROK_DOCUMENTATION_URL = 'https://docs.x.ai/developers/rest-api-reference/inference/chat-completions'
const OPENAI_DEFAULT_CACHE_WRITE_MULTIPLIER = 1.25
const bcInputAssumption = 'Unmeasured conservative allowance: <=64,000 input tokens for one pinned PNG <=4096x4096 and <=8192 UTF-8 bytes of request text/schema; not a provider-enforced input-token ceiling. A reported breach stops further dispatch.'
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')

export interface OcrLosslessPngTransportPin {
  originalSha256: string, transportSha256: string, pixelSha256: string, width: number, height: number, policy: string
}
export const EFG_ANTHROPIC_NEWSPAPER_TRANSPORT: Readonly<OcrLosslessPngTransportPin> = {
  originalSha256: 'd4dd66697d461a41d4ab68a917bc9460f9d8f98b709382f78db002d5cbcb3937',
  transportSha256: '0d93ec4f84037ad3b4a4af801cf6f11f374b4861a2b55a43f7dde6d4680edd2b',
  pixelSha256: '6d86c1345fc3a1c46d98d75c2e4360f4ecdcd1626f6dd9d7ced481d5afe2b017',
  width: 1985, height: 3072, policy: 'efg-newspaper-anthropic-lossless-png-v1'
}
/** Content verification only; authorization remains the fixed case/provider check inside the guard. */
export const verifyOcrLosslessPngTransport = (
  original: Uint8Array, candidate: Uint8Array, expected: Readonly<OcrLosslessPngTransportPin>
): { transportInputSha256: string, transportPolicy: string } => {
  if (hash(original) !== expected.originalSha256 || hash(candidate) !== expected.transportSha256
    || candidate.length > 5 * 1024 * 1024) throw new Error('OCR spending guard: unapproved lossless PNG transport bytes')
  const source = decodePngRgba8(original), transport = decodePngRgba8(candidate)
  if (source.width !== expected.width || source.height !== expected.height || transport.width !== source.width || transport.height !== source.height
    || source.pixelSha256 !== expected.pixelSha256 || transport.pixelSha256 !== expected.pixelSha256
    || source.pixels.length !== transport.pixels.length || !source.pixels.every((value, i) => value === transport.pixels[i])) throw new Error('OCR spending guard: lossless PNG transport decoded pixels changed')
  return { transportInputSha256: expected.transportSha256, transportPolicy: expected.policy }
}

interface Rate { input: number, output: number, outputCap: number, pageCents?: number, cachedInput?: number }

export interface CategoriesBcSpendingReceipt {
  id: string
  invocationId: string
  caseId: string
  documentCaseId: string
  provider: string
  model: string
  requestSha256: string
  inputSha256: string
  reservedCents: number
  chargedCents: number
  status: 'reserved' | 'settled' | 'rejected' | 'ambiguous' | 'breach'
  createdAt: string
  completedAt?: string
  httpStatus?: number
  inputTokens?: number
  outputTokens?: number
  visibleOutputTokens?: number
  reasoningOutputTokens?: number
  responseEvidencePath?: string
  responseEvidenceSha256?: string
  responseEvidenceError?: string
  transportInputSha256?: string
  transportPolicy?: string
  costBasis?: 'conservative-upper-bound' | 'provider-usage-at-reviewed-rates'
  costNote?: string
  reason?: string
  recoveryOfReceiptId?: string
  recoveryReconciliationSha256?: string
}
export interface CategoriesBcManualReconciliation {
  schemaVersion: 1
  kind: 'ocr-categories-bc-manual-reconciliation'
  action: 'retain-full-reservation-and-authorize-one-recovery-invocation'
  approvalBudgetCents: 3000
  approvalEvidence: 'User approved up to $30'
  planSha256: string
  receiptId: string
  caseId: string
  documentCaseId: string
  provider: string
  model: string
  inputSha256: string
  httpStatus?: 503 | 200
  transportReview?: 'socket-closed-no-reported-usage' | 'timeout-no-reported-usage'
  failureEvidencePath?: string
  failureEvidenceSha256?: string
  reviewedPolicy?: typeof CATEGORIES_BC_GROK_REVIEWED_POLICY
  documentationUrl?: typeof CATEGORIES_BC_GROK_DOCUMENTATION_URL
  nativeVisibleOutputCap?: 4096
  reasoningAllowance?: 32768
  reservedCents: number
  chargedCents: number
  reason: string
  createdAt: string
}
export interface CategoriesBcSpendingLedger {
  schemaVersion: 1
  kind: 'ocr-categories-bc-spending-ledger'
  budgetCents: number
  inputTokenAssumption: string
  planSha256: string
  receipts: CategoriesBcSpendingReceipt[]
  reconciliations?: Array<{ path: string, sha256: string }>
}
export interface CategoriesBcPagePin { id: string, caseId: string, pageNumber: number, input: string, inputSha256: string, width: number, height: number, format?: 'png' | 'jpg' }
export interface CategoriesBcExecutionPlan {
  schemaVersion: 1
  kind: 'ocr-categories-bc-execution-plan'
  approval: { status: 'approved', budgetCents: 3000, evidence: 'User approved up to $30' }
  pages: CategoriesBcPagePin[]
  targets: Array<{ provider: string, model: string }>
}
export interface CategoriesBcSpendingGuardOptions {
  ledgerPath: string
  pageId: string
  provider: string
  model: string
  planSha256: string
  projectRoot?: string
  fetchImplementation?: typeof fetch
  planPath?: string
}
export const CATEGORIES_BC_CASE_PAGES: Readonly<Record<string, number>> = sourceCatalog.categoriesBcCasePages

export type ApprovedOcrBenchmarkGuardProfile = 'categories-bc' | 'category-d' | 'categories-efg' | 'newspaper-expansion'
const categoryDCasePages: Readonly<Record<string, number>> = {
  'advertisement-three-masons': 1, 'advertisement-newtown-cruise': 1, 'advertisement-legend-1900': 1,
  'advertisement-metrolink': 1, 'advertisement-nyc-skate': 1, 'd-rerun-01-ad-copy': 1
}
export const CATEGORIES_EFG_CASE_PAGES: Readonly<Record<string, number>> = {
  'numeric-tables-practitioner-attitudes': 1, 'numeric-tables-inflammatory-pathways': 1, 'numeric-tables-program-implementation': 1,
  'numeric-tables-synthetic-financial': 1, 'numeric-tables-synthetic-marketing': 1,
  'handwriting-washington-receipt': 1, 'handwriting-patton-travel': 1, 'handwriting-marker-prose': 1, 'handwriting-marker-table': 1, 'handwriting-marker-flowchart': 1,
  'newspapers-london-gazette': 1, 'newspapers-northern-star': 1, 'newspapers-leader': 1, 'newspapers-tomahawk': 1, 'newspapers-monthly-repository': 1,
  'efg-rerun-01-financial-data': 1, 'efg-rerun-01-handwriting': 1, 'efg-rerun-1-page-declaration': 1, 'efg-rerun-1-page-newspaper': 1
}
export const NEWSPAPER_EXPANSION_CASE_PAGES: Readonly<Record<string, number>> = {
  'newspapers-expansion-new-york-times-1929-10-24-p31': 1,
  'newspapers-expansion-independent-hindustan-1920-p3': 1,
  'newspapers-expansion-perth-gazette-1833-03-02-p1': 1,
  'newspapers-expansion-perth-gazette-1833-04-13-p1': 1,
  'newspapers-expansion-london-gazette-1815-p3': 1,
  'newspapers-expansion-london-gazette-1815-p4': 1,
  'newspapers-expansion-bln-morning-chronicle-inquest': 1,
  'newspapers-expansion-bln-charter-aldermen': 1,
  'newspapers-expansion-bln-era-burglars': 1,
  'newspapers-expansion-bln-lloyds-bank-robbery': 1,
  'newspapers-expansion-bln-police-news-putney': 1,
  'newspapers-expansion-courant-1721-article': 1
}

export interface NewspaperFinalBreachAccountingReview {
  schemaVersion: 1
  kind: 'ocr-newspaper-expansion-final-breach-accounting-review'
  action: 'retain-original-full-hold-and-continue-other-slots'
  approvalBudgetCents: 3000
  approvalEvidence: 'User approved up to $30 for the 12-input newspaper expansion'
  finalNoRedispatch: true
  planSha256: string
  receiptId: string
  receiptSha256: string
  caseId: string
  documentCaseId: string
  provider: 'grok'
  model: 'grok-4.7'
  inputSha256: string
  requestSha256: string
  httpStatus: 200
  responseEvidencePath: string
  responseEvidenceSha256: string
  nativeFinishReason: 'length'
  inputTokens: 3758
  visibleOutputTokens: 4096
  reasoningOutputTokens: 46749
  outputTokens: 50845
  reservedCents: 34.9184
  chargedCents: 34.9184
  reviewedUsageCents: 31.2586
  continueOnly: {
    caseId: string
    documentCaseId: string
    provider: 'anthropic'
    model: 'claude-fable-5'
    inputSha256: string
    rejectedReceiptId: string
    rejectedReceiptSha256: string
  }
  reason: string
  createdAt: string
}
export interface NewspaperFinalBreachAccountingProof {
  receiptId: string
  finalNoRedispatch: true
  reviewedUsageCents: number
  retainedChargedCents: number
  totalAccountedCents: number
  continueOnly: NewspaperFinalBreachAccountingReview['continueOnly']
}
const newspaperRoot = 'input/examples/document/ocr-newspaper-expansion/'
function finalReviewFailure(message: string): never { throw new Error(`OCR spending guard: final accounting review ${message}`) }
const sha256Value = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const validCents = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const knownNewspaperFinalUsage = { inputTokens: 3758, visibleOutputTokens: 4096, reasoningOutputTokens: 46749, outputTokens: 50845 } as const
const finalReviewKeys = new Set([
  'schemaVersion', 'kind', 'action', 'approvalBudgetCents', 'approvalEvidence', 'finalNoRedispatch', 'planSha256', 'receiptId', 'receiptSha256',
  'caseId', 'documentCaseId', 'provider', 'model', 'inputSha256', 'requestSha256', 'httpStatus', 'responseEvidencePath', 'responseEvidenceSha256',
  'nativeFinishReason', 'inputTokens', 'visibleOutputTokens', 'reasoningOutputTokens', 'outputTokens', 'reservedCents', 'chargedCents',
  'reviewedUsageCents', 'continueOnly', 'reason', 'createdAt'
])

/** A single reviewed terminal response can close global accounting only; it never permits another call to that slot. */
export const validateNewspaperFinalBreachAccountingReview = (options: {
  review: unknown, ledger: unknown, plan: unknown, planSha256: string, responseEvidenceBytes: Uint8Array
}): NewspaperFinalBreachAccountingProof => {
  const { review, ledger, plan, planSha256, responseEvidenceBytes } = options
  if (!isRecord(review) || Object.keys(review).some(key => !finalReviewKeys.has(key))
    || review['schemaVersion'] !== 1 || review['kind'] !== 'ocr-newspaper-expansion-final-breach-accounting-review'
    || review['action'] !== 'retain-original-full-hold-and-continue-other-slots' || review['finalNoRedispatch'] !== true
    || review['approvalBudgetCents'] !== 3000 || review['approvalEvidence'] !== 'User approved up to $30 for the 12-input newspaper expansion'
    || !sha256Value(planSha256) || review['planSha256'] !== planSha256
    || typeof review['receiptId'] !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(review['receiptId'])
    || !sha256Value(review['receiptSha256']) || !sha256Value(review['requestSha256']) || !sha256Value(review['inputSha256'])
    || !sha256Value(review['responseEvidenceSha256']) || typeof review['reason'] !== 'string' || !review['reason'].trim()
    || typeof review['createdAt'] !== 'string' || !Number.isFinite(Date.parse(review['createdAt']))) finalReviewFailure('does not establish its explicit continuation-only authority')
  if (!isRecord(plan) || plan['schemaVersion'] !== 1 || plan['kind'] !== 'ocr-newspaper-expansion-execution-plan'
    || !isRecord(plan['approval']) || plan['approval']['status'] !== 'approved' || plan['approval']['budgetCents'] !== 3000
    || plan['approval']['evidence'] !== review['approvalEvidence'] || !Array.isArray(plan['pages']) || plan['pages'].length !== 12
    || !Array.isArray(plan['targets']) || plan['targets'].length !== 21) finalReviewFailure('does not match the approved newspaper plan')
  const pageIds = new Set<string>()
  for (const pin of plan['pages']) {
    if (!isRecord(pin) || typeof pin['caseId'] !== 'string' || !Object.hasOwn(NEWSPAPER_EXPANSION_CASE_PAGES, pin['caseId'])
      || pin['id'] !== `${pin['caseId']}-page-01` || pin['pageNumber'] !== 1 || pin['format'] !== 'png'
      || pin['input'] !== `${newspaperRoot}cases/${pin['caseId']}/input.png` || !sha256Value(pin['inputSha256'])
      || typeof pin['width'] !== 'number' || !Number.isSafeInteger(pin['width']) || pin['width'] < 1 || pin['width'] > 3072
      || typeof pin['height'] !== 'number' || !Number.isSafeInteger(pin['height']) || pin['height'] < 1 || pin['height'] > 3072
      || pageIds.has(String(pin['id']))) finalReviewFailure('contains an altered approved page population')
    pageIds.add(String(pin['id']))
  }
  const targetKeys = plan['targets'].map(target => isRecord(target) ? `${target['provider']}/${target['model']}` : '').sort()
  const expectedTargets = [...Object.keys(CATEGORIES_BC_SPENDING_RATES).filter(key => key !== 'mistral/mistral-ocr-4-0'), 'tesseract/tesseract'].sort()
  if (JSON.stringify(targetKeys) !== JSON.stringify(expectedTargets)) finalReviewFailure('contains an altered approved model population')
  if (!isRecord(ledger) || ledger['schemaVersion'] !== 1 || ledger['kind'] !== 'ocr-newspaper-expansion-spending-ledger'
    || ledger['budgetCents'] !== 3000 || ledger['planSha256'] !== planSha256 || !Array.isArray(ledger['receipts'])) finalReviewFailure('does not match the current scoped ledger')
  const ids = new Set<string>(); let total = 0
  for (const entry of ledger['receipts']) {
    if (!isRecord(entry) || typeof entry['id'] !== 'string' || ids.has(entry['id'])
      || !validCents(entry['reservedCents']) || !validCents(entry['chargedCents'])
      || !['reserved', 'settled', 'rejected', 'ambiguous', 'breach'].includes(String(entry['status']))
      || !sha256Value(entry['requestSha256']) || !sha256Value(entry['inputSha256'])
      || !targetKeys.includes(`${entry['provider']}/${entry['model']}`)
      || !CATEGORIES_BC_SPENDING_RATES[`${entry['provider']}/${entry['model']}`]
      || !plan['pages'].some(pin => isRecord(pin) && pin['id'] === entry['caseId'] && pin['caseId'] === entry['documentCaseId'] && pin['inputSha256'] === entry['inputSha256'])) finalReviewFailure('contains invalid or altered receipt accounting')
    ids.add(entry['id']); total += entry['chargedCents']
    if ((entry['status'] === 'reserved' || entry['status'] === 'ambiguous') && entry['chargedCents'] !== entry['reservedCents']
      || entry['status'] === 'rejected' && entry['chargedCents'] !== 0
      || entry['status'] === 'settled' && entry['chargedCents'] > entry['reservedCents']
      || entry['id'] !== review['receiptId'] && (entry['status'] === 'ambiguous' || entry['status'] === 'breach')) finalReviewFailure('has another unresolved hold or altered charge')
  }
  if (!Number.isFinite(total) || total > 3000 + 1e-9) finalReviewFailure('exceeds the cumulative approval')
  const receipt = ledger['receipts'].find(entry => isRecord(entry) && entry['id'] === review['receiptId'])
  const documentCaseId = 'newspapers-expansion-new-york-times-1929-10-24-p31'
  if (!isRecord(receipt) || receipt['status'] !== 'breach' || receipt['httpStatus'] !== 200
    || receipt['provider'] !== 'grok' || receipt['model'] !== 'grok-4.7' || receipt['documentCaseId'] !== documentCaseId
    || receipt['caseId'] !== `${documentCaseId}-page-01` || review['nativeFinishReason'] !== 'length'
    || review['responseEvidencePath'] !== `${newspaperRoot}provider-response-evidence/${receipt['id']}.json`
    || receipt['responseEvidencePath'] !== review['responseEvidencePath'] || receipt['responseEvidenceSha256'] !== review['responseEvidenceSha256']
    || hash(JSON.stringify(receipt)) !== review['receiptSha256'] || receipt['reservedCents'] !== 34.9184 || receipt['chargedCents'] !== 34.9184
    || typeof receipt['completedAt'] !== 'string' || !Number.isFinite(Date.parse(receipt['completedAt']))
    || Date.parse(String(review['createdAt'])) < Date.parse(receipt['completedAt'])
    || ['caseId', 'documentCaseId', 'provider', 'model', 'inputSha256', 'requestSha256', 'httpStatus', 'reservedCents', 'chargedCents'].some(key => review[key] !== receipt[key])
    || Object.entries(knownNewspaperFinalUsage).some(([key, value]) => receipt[key] !== value || review[key] !== value)
    || ledger['receipts'].some(entry => isRecord(entry) && (entry['recoveryOfReceiptId'] === receipt['id']
      || entry['id'] !== receipt['id'] && entry['caseId'] === receipt['caseId'] && entry['provider'] === receipt['provider']
      && entry['model'] === receipt['model'] && entry['status'] !== 'rejected'))) finalReviewFailure('differs from the immutable terminal Grok receipt')
  if (responseEvidenceBytes.length > 8 * 1024 * 1024 || hash(responseEvidenceBytes) !== review['responseEvidenceSha256']) finalReviewFailure('response evidence checksum changed')
  let evidence: unknown
  try { evidence = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(responseEvidenceBytes)) } catch { return finalReviewFailure('response evidence is not valid UTF-8 JSON') }
  if (!isRecord(evidence) || evidence['schemaVersion'] !== 1 || evidence['receiptId'] !== receipt['id']
    || evidence['pageId'] !== receipt['caseId'] || evidence['documentCaseId'] !== receipt['documentCaseId']
    || evidence['provider'] !== 'grok' || evidence['model'] !== 'grok-4.7'
    || evidence['serialization'] !== 'Parsed provider JSON serialized locally; not original response bytes.'
    || !isRecord(evidence['response'])) finalReviewFailure('response envelope differs from the retained request')
  const payload = evidence['response'], usage = payload['usage'], choices = payload['choices']
  if (payload['model'] !== 'grok-4.7' || !Array.isArray(choices) || choices.length !== 1 || !isRecord(choices[0])
    || choices[0]['finish_reason'] !== 'length' || !isRecord(choices[0]['message'])
    || typeof choices[0]['message']['content'] !== 'string' || !choices[0]['message']['content'].trim()
    || !isRecord(usage) || usage['prompt_tokens'] !== 3758 || usage['completion_tokens'] !== 4096 || usage['total_tokens'] !== 54603
    || !isRecord(usage['completion_tokens_details']) || usage['completion_tokens_details']['reasoning_tokens'] !== 46749
    || usage['num_sources_used'] !== 0) finalReviewFailure('native response does not establish the exact reviewed terminal usage')
  const pricing = CATEGORIES_BC_SPENDING_RATES['grok/grok-4.7']!
  const cents = Math.ceil((3758 * pricing.input + 50845 * pricing.output) / 1_000_000 * 1_000_000) / 1_000_000
  const reserve = Math.ceil((CATEGORIES_BC_INPUT_ALLOWANCE * pricing.input
    + (CATEGORIES_BC_GROK_VISIBLE_OUTPUT_CAP + CATEGORIES_BC_GROK_REASONING_ALLOWANCE) * pricing.output) / 1_000_000 * 1_000_000) / 1_000_000
  if (cents !== 31.2586 || review['reviewedUsageCents'] !== cents || reserve !== receipt['reservedCents']
    || cents > Number(receipt['chargedCents']) + 1e-9) finalReviewFailure('native priced usage is not covered by the unchanged full hold')
  const continuation = review['continueOnly']
  const continuationKeys = new Set(['caseId', 'documentCaseId', 'provider', 'model', 'inputSha256', 'rejectedReceiptId', 'rejectedReceiptSha256'])
  if (!isRecord(continuation) || Object.keys(continuation).some(key => !continuationKeys.has(key))
    || continuation['caseId'] !== receipt['caseId'] || continuation['documentCaseId'] !== documentCaseId
    || continuation['provider'] !== 'anthropic' || continuation['model'] !== 'claude-fable-5'
    || continuation['inputSha256'] !== receipt['inputSha256'] || typeof continuation['rejectedReceiptId'] !== 'string'
    || !sha256Value(continuation['rejectedReceiptSha256'])) finalReviewFailure('does not isolate the already approved Fable NYT slot')
  const rejected = ledger['receipts'].find(entry => isRecord(entry) && entry['id'] === continuation['rejectedReceiptId'])
  if (!isRecord(rejected) || rejected['status'] !== 'rejected' || rejected['httpStatus'] !== 400 || rejected['chargedCents'] !== 0
    || rejected['caseId'] !== continuation['caseId'] || rejected['documentCaseId'] !== documentCaseId
    || rejected['provider'] !== 'anthropic' || rejected['model'] !== 'claude-fable-5' || rejected['inputSha256'] !== receipt['inputSha256']
    || hash(JSON.stringify(rejected)) !== continuation['rejectedReceiptSha256']
    || typeof rejected['completedAt'] !== 'string' || !Number.isFinite(Date.parse(rejected['completedAt']))
    || Date.parse(String(review['createdAt'])) < Date.parse(rejected['completedAt'])) finalReviewFailure('does not preserve the original zero-charge Fable rejection')
  return { receiptId: String(receipt['id']), finalNoRedispatch: true, reviewedUsageCents: cents,
    retainedChargedCents: Number(receipt['chargedCents']), totalAccountedCents: total,
    continueOnly: continuation as unknown as NewspaperFinalBreachAccountingReview['continueOnly'] }
}

/** Shared file/proof validation for the dispatcher and fetch guard; reads no unpinned or external evidence. */
export const readNewspaperFinalBreachAccountingReview = async (options: {
  projectRoot: string, reviewPath: string, reviewSha256: string, ledger: unknown, plan: unknown, planSha256: string
}): Promise<NewspaperFinalBreachAccountingProof> => {
  const root = await realpath(options.projectRoot)
  const readPrivate = async (path: string, prefix: string, expected: string, maximum: number): Promise<Uint8Array> => {
    if (!path.startsWith(prefix) || path.includes('\\') || path.split('/').some(part => !part || part.startsWith('.')) || !sha256Value(expected)) finalReviewFailure('requires a pinned private evidence path')
    const actual = await realpath(resolve(root, path))
    if (!relative(root, actual).replaceAll('\\', '/').startsWith(prefix)) finalReviewFailure('private evidence escaped its scoped directory')
    const bytes = new Uint8Array(await readFile(actual))
    if (bytes.length > maximum || hash(bytes) !== expected) finalReviewFailure('private evidence checksum changed')
    return bytes
  }
  const bytes = await readPrivate(options.reviewPath, `${newspaperRoot}reconciliations/`, options.reviewSha256, 16_384)
  let review: unknown
  try { review = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { return finalReviewFailure('record is not valid UTF-8 JSON') }
  if (!isRecord(review) || typeof review['receiptId'] !== 'string'
    || review['responseEvidencePath'] !== `${newspaperRoot}provider-response-evidence/${review['receiptId']}.json`
    || !sha256Value(review['responseEvidenceSha256'])) finalReviewFailure('record does not pin its own native response')
  const responseEvidenceBytes = await readPrivate(String(review['responseEvidencePath']), `${newspaperRoot}provider-response-evidence/`, review['responseEvidenceSha256'], 8 * 1024 * 1024)
  return validateNewspaperFinalBreachAccountingReview({ ...options, review, responseEvidenceBytes })
}

const createProfileGuard = (profile: ApprovedOcrBenchmarkGuardProfile) => {
  const isCategoryD = profile === 'category-d', isCategoriesEfg = profile === 'categories-efg', isNewspaper = profile === 'newspaper-expansion'
  const scope = isNewspaper ? {
    root: 'input/examples/document/ocr-newspaper-expansion/', planKind: 'ocr-newspaper-expansion-execution-plan',
    ledgerKind: 'ocr-newspaper-expansion-spending-ledger', manualKind: 'ocr-newspaper-expansion-manual-reconciliation',
    approvalEvidence: 'User approved up to $30 for the 12-input newspaper expansion', budgetCents: 3000, pageCount: 12, targetCount: 21,
    description: '12-file/12-page newspaper expansion', imageMime: 'image/png', casePages: NEWSPAPER_EXPANSION_CASE_PAGES,
    inputRoots: ['input/examples/document/ocr-newspaper-expansion/cases/']
  } : isCategoriesEfg ? {
    root: 'input/examples/document/ocr-categories-efg-run/', planKind: 'ocr-categories-efg-execution-plan',
    ledgerKind: 'ocr-categories-efg-spending-ledger', manualKind: 'ocr-categories-efg-manual-reconciliation',
    approvalEvidence: 'User approved up to $30 for categories 5–7', budgetCents: 3000, pageCount: 19, targetCount: 21,
    description: '19-file/19-page categories E–G', imageMime: 'mixed', casePages: CATEGORIES_EFG_CASE_PAGES,
    inputRoots: ['input/examples/document/ocr-numeric-tables/', 'input/examples/document/ocr-handwriting/', 'input/examples/document/ocr-newspapers/', 'input/examples/document/ocr-categories-efg-run/']
  } : isCategoryD ? {
    root: 'input/examples/document/ocr-category-d-run/', planKind: 'ocr-category-d-execution-plan',
    ledgerKind: 'ocr-category-d-spending-ledger', manualKind: 'ocr-category-d-manual-reconciliation',
    approvalEvidence: 'User approved up to $25 for category 4', budgetCents: 2500, pageCount: 6, targetCount: 21,
    description: '6-file/6-page category D', imageMime: 'image/jpeg',
    casePages: categoryDCasePages, inputRoots: ['input/examples/document/ocr-advertisements/', 'input/examples/document/ocr-category-d-run/']
  } : {
    root: 'input/examples/document/ocr-categories-bc-run/', planKind: 'ocr-categories-bc-execution-plan',
    ledgerKind: 'ocr-categories-bc-spending-ledger', manualKind: 'ocr-categories-bc-manual-reconciliation',
    approvalEvidence: 'User approved up to $30', budgetCents: 3000, pageCount: 29, targetCount: 22,
    description: '13-file/29-page', imageMime: 'image/png', casePages: CATEGORIES_BC_CASE_PAGES,
    inputRoots: ['input/examples/document/ocr-technical-code/', 'input/examples/document/ocr-historical-print/', 'input/examples/document/ocr-categories-bc-run/']
  }
  const batchRoot = scope.root, scopeCasePages = scope.casePages
  const scopeRates = Object.fromEntries(Object.entries(CATEGORIES_BC_SPENDING_RATES).filter(([key]) => profile === 'categories-bc' || key !== 'mistral/mistral-ocr-4-0'))
  const CATEGORIES_BC_BUDGET_CENTS = scope.budgetCents
  const inputAssumption = isNewspaper
    ? 'Unmeasured conservative allowance: <=64,000 input tokens for one pinned PNG <=3072x3072 and <=5MiB, with <=8192 UTF-8 bytes of request text/schema; not a provider-enforced input-token ceiling. A reported breach stops further dispatch.'
    : isCategoriesEfg
    ? 'Unmeasured conservative allowance: <=64,000 input tokens for one pinned PNG or original JPEG <=4096x4096, with the sole efg-rerun-1-page-declaration original JPEG exception exactly 3923x4656, and <=8192 UTF-8 bytes of request text/schema; not a provider-enforced input-token ceiling. A reported breach stops further dispatch.'
    : isCategoryD
    ? 'Unmeasured conservative allowance: <=64,000 input tokens for one pinned original JPEG <=4096x4096 and <=8192 UTF-8 bytes of request text/schema; not a provider-enforced input-token ceiling. A reported breach stops further dispatch.'
    : bcInputAssumption
  const privatePath = (path: string): void => {
    if (!path.startsWith(batchRoot) || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) fail('batch artifacts must use a private project-relative path')
  }
  const readApprovedPlan = async (options: CategoriesBcSpendingGuardOptions, root: string): Promise<CategoriesBcExecutionPlan> => {
    const planPath = options.planPath ?? batchRoot + 'execution-plan.json'
    privatePath(planPath)
    if (!/^[a-f0-9]{64}$/.test(options.planSha256)) fail('a checksum-pinned execution plan is required')
    const actual = await realpath(resolve(root, planPath))
    if (!relative(await realpath(root), actual).replaceAll('\\', '/').startsWith(batchRoot)) fail('execution plan escaped its private directory')
    const bytes = await readFile(actual)
    if (bytes.length > 4 * 1024 * 1024 || hash(bytes) !== options.planSha256) fail('execution plan checksum changed')
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const approval = isRecord(value) ? value['approval'] : undefined
    if (!isRecord(value) || value['schemaVersion'] !== 1 || value['kind'] !== scope.planKind
      || !isRecord(approval) || approval['status'] !== 'approved' || approval['budgetCents'] !== CATEGORIES_BC_BUDGET_CENTS
      || approval['evidence'] !== scope.approvalEvidence || !Array.isArray(value['pages']) || value['pages'].length !== scope.pageCount
      || !Array.isArray(value['targets']) || value['targets'].length !== scope.targetCount) fail(`the plan does not contain the explicit approved ${scope.description} batch`)
    const plan = value as unknown as CategoriesBcExecutionPlan
    const ids = new Set<string>(), positions = new Set<string>()
    for (const page of plan.pages) {
      const declarationException = isCategoriesEfg && page.caseId === 'efg-rerun-1-page-declaration'
        && page.format === 'jpg' && page.width === 3923 && page.height === 4656
      if (!isRecord(page) || typeof page.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(page.id) || ids.has(page.id)
        || typeof page.caseId !== 'string' || !scopeCasePages[page.caseId] || !Number.isSafeInteger(page.pageNumber)
        || page.pageNumber < 1 || page.pageNumber > scopeCasePages[page.caseId]!
        || positions.has(page.caseId + '/' + page.pageNumber) || typeof page.input !== 'string'
        || !/^[a-f0-9]{64}$/.test(page.inputSha256) || !Number.isSafeInteger(page.width) || !Number.isSafeInteger(page.height)
        || isCategoriesEfg && page.format !== 'png' && page.format !== 'jpg'
        || isNewspaper && (!Object.hasOwn(scopeCasePages, page.caseId) || page.format !== 'png' || page.id !== `${page.caseId}-page-01`
          || page.input !== `${batchRoot}cases/${page.caseId}/input.png`)
        || page.width < 1 || page.height < 1
        || (page.width > (isNewspaper ? 3072 : 4096) || page.height > (isNewspaper ? 3072 : 4096)) && !declarationException) fail('invalid or duplicate approved page identity')
      if (!scope.inputRoots.some(prefix => page.input.startsWith(prefix))
        || page.input.includes('\\') || page.input.split('/').some(part => !part || part === '.' || part === '..')) fail('page input must remain in the approved private input roots')
      ids.add(page.id); positions.add(page.caseId + '/' + page.pageNumber)
    }
    const keys = plan.targets.map(target => isRecord(target) ? String(target.provider) + '/' + String(target.model) : '')
    const expected = [...Object.keys(scopeRates), 'tesseract/tesseract'].sort()
    if (JSON.stringify([...keys].sort()) !== JSON.stringify(expected)) fail(`target inventory differs from the quoted ${scope.targetCount} models`)
    return plan
  }

  function fail(message: string): never { throw new Error(`OCR spending guard: ${message}`) }
  const finiteNonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
  const tokenCount = (value: unknown): value is number => finiteNonnegative(value) && Number.isSafeInteger(value)
  const roundedCents = (value: number): number => Math.ceil(value * 1_000_000) / 1_000_000
  const totalHeld = (ledger: CategoriesBcSpendingLedger): number => ledger.receipts.reduce((sum, receipt) => sum + receipt.chargedCents, 0)
  const reconciliationRoot = batchRoot + 'reconciliations/'

  // Official OpenAI documentation, checked 2026-10-23:
  // https://developers.openai.com/api/docs/guides/prompt-caching
  // Implicit caching is enabled by default; 30-minute writes use 1.25x input rates.
  // https://developers.openai.com/api/docs/guides/fast-mode
  // An omitted service_tier can inherit the project's higher-priced Fast setting.
  const applyOpenAIStandardBillingControls = (body: Record<string, unknown>): void => {
    if (body['service_tier'] !== undefined && body['service_tier'] !== 'default') fail('only the OpenAI default service tier is authorized')
    body['service_tier'] = 'default'
    if (body['prompt_cache_retention'] !== undefined || body['prompt_cache_key'] !== undefined) fail('unreviewed OpenAI cache options are not authorized')
    const options = body['prompt_cache_options']
    if (options !== undefined && (!isRecord(options)
      || Object.keys(options).some(key => key !== 'mode' && key !== 'ttl')
      || (options['mode'] !== undefined && options['mode'] !== 'implicit' && options['mode'] !== 'explicit')
      || (options['ttl'] !== undefined && options['ttl'] !== '30m'))) fail('only reviewed OpenAI implicit/explicit caching with 30m retention is authorized')
    body['prompt_cache_options'] = { mode: isRecord(options) ? options['mode'] ?? 'implicit' : 'implicit', ttl: '30m' }
    const inspectBreakpoints = (value: unknown): void => {
      if (Array.isArray(value)) { for (const child of value) inspectBreakpoints(child); return }
      if (!isRecord(value)) return
      if ('prompt_cache_breakpoint' in value) {
        const breakpoint = value['prompt_cache_breakpoint']
        if (!isRecord(breakpoint) || breakpoint['mode'] !== 'explicit'
          || Object.keys(breakpoint).some(key => key !== 'mode' && key !== 'ttl')
          || (breakpoint['ttl'] !== undefined && breakpoint['ttl'] !== '30m')) fail('only reviewed OpenAI explicit 30m cache breakpoints are authorized')
      }
      for (const child of Object.values(value)) inspectBreakpoints(child)
    }
    inspectBreakpoints(body['input'])
  }

  interface ReviewedUsage {
    inputTokens: number
    outputTokens: number
    visibleOutputTokens?: number
    reasoningOutputTokens?: number
    cents: number
    costBasis?: CategoriesBcSpendingReceipt['costBasis']
    costNote?: string
  }

  const readOpenAIStandardUsage = (usage: Record<string, unknown>, pricing: Rate): ReviewedUsage | undefined => {
    const inputTokens = usage['input_tokens'], outputTokens = usage['output_tokens']
    if (!tokenCount(inputTokens) || !tokenCount(outputTokens)) return undefined
    const details = usage['input_tokens_details']
    if (details !== undefined && !isRecord(details)) return undefined
    const reads = isRecord(details) ? details['cached_tokens'] : undefined
    const writes = isRecord(details) ? details['cache_write_tokens'] : undefined
    if ((reads !== undefined && !tokenCount(reads)) || (writes !== undefined && !tokenCount(writes))) return undefined
    if ((tokenCount(reads) && reads > inputTokens) || (tokenCount(writes) && writes > inputTokens)) return undefined
    const lifetimes = isRecord(details) ? details['cache_write_tokens_details'] : undefined
    if (lifetimes !== undefined && (!isRecord(lifetimes)
      || Object.keys(lifetimes).some(key => key !== 'ttl_30m_tokens' && key !== 'ttl_12h_tokens')
      || !tokenCount(lifetimes['ttl_30m_tokens']) || !tokenCount(lifetimes['ttl_12h_tokens'])
      || lifetimes['ttl_12h_tokens'] !== 0 || !tokenCount(writes)
      || lifetimes['ttl_30m_tokens'] !== writes)) return undefined
    if (tokenCount(reads) && tokenCount(writes)) {
      if (reads + writes > inputTokens || pricing.cachedInput === undefined) return undefined
      const ordinary = inputTokens - reads - writes
      return {
        inputTokens, outputTokens,
        cents: roundedCents((ordinary * pricing.input + reads * pricing.cachedInput
          + writes * pricing.input * OPENAI_DEFAULT_CACHE_WRITE_MULTIPLIER + outputTokens * pricing.output) / 1_000_000),
        costBasis: 'provider-usage-at-reviewed-rates',
        costNote: 'Provider-reported ordinary/read/30m-write input components and inclusive output tokens valued at reviewed Standard rates; not invoice-reconciled charges.'
      }
    }
    // Older/incomplete usage does not establish which input tokens incurred writes.
    // Value all input at the highest admitted input rate rather than assuming no writes.
    return {
      inputTokens, outputTokens,
      cents: roundedCents((inputTokens * pricing.input * OPENAI_DEFAULT_CACHE_WRITE_MULTIPLIER + outputTokens * pricing.output) / 1_000_000),
      costBasis: 'conservative-upper-bound',
      costNote: 'Cache component usage is incomplete; all OpenAI input valued at the 1.25x default 30m-write rate, output at Standard rates. Conservative budget accounting, not actual invoice cost.'
    }
  }

  const validateLedger = (value: unknown, plan: CategoriesBcExecutionPlan, planSha256: string): CategoriesBcSpendingLedger => {
    if (!isRecord(value) || value['schemaVersion'] !== 1 || value['kind'] !== scope.ledgerKind
      || value['budgetCents'] !== CATEGORIES_BC_BUDGET_CENTS || value['planSha256'] !== planSha256 || value['inputTokenAssumption'] !== inputAssumption || !Array.isArray(value['receipts'])) fail('invalid or changed cumulative ledger')
    const ledger = value as unknown as CategoriesBcSpendingLedger
    const ids = new Set<string>()
    for (const receipt of ledger.receipts) {
      if (!isRecord(receipt) || typeof receipt.id !== 'string' || ids.has(receipt.id)
        || !finiteNonnegative(receipt.reservedCents) || !finiteNonnegative(receipt.chargedCents)
        || !['reserved', 'settled', 'rejected', 'ambiguous', 'breach'].includes(receipt.status)
        || typeof receipt.caseId !== 'string' || typeof receipt.provider !== 'string' || typeof receipt.model !== 'string'
        || typeof receipt.invocationId !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.requestSha256)
        || typeof receipt.createdAt !== 'string' || !Number.isFinite(Date.parse(receipt.createdAt))
        || receipt.completedAt !== undefined && (!Number.isFinite(Date.parse(receipt.completedAt)) || Date.parse(receipt.completedAt) < Date.parse(receipt.createdAt))
        || !/^[a-f0-9]{64}$/.test(receipt.inputSha256)
        || !plan.pages.some(pin => pin.id === receipt.caseId && pin.caseId === receipt.documentCaseId && pin.inputSha256 === receipt.inputSha256)
        || !scopeRates[receipt.provider + '/' + receipt.model]) fail('invalid receipt in cumulative ledger')
      ids.add(receipt.id)
      if (receipt.status === 'rejected' && receipt.chargedCents !== 0) fail('rejected receipt carries unexpected spending')
      if (['reserved', 'ambiguous'].includes(receipt.status) && receipt.chargedCents !== receipt.reservedCents) fail('unresolved request reservation changed')
      if (receipt.recoveryOfReceiptId !== undefined && (typeof receipt.recoveryOfReceiptId !== 'string' || !receipt.recoveryOfReceiptId
        || typeof receipt.recoveryReconciliationSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.recoveryReconciliationSha256))) fail('invalid recovery receipt identity')
    }
    if (ledger.reconciliations !== undefined && (!Array.isArray(ledger.reconciliations)
      || ledger.reconciliations.some(entry => !isRecord(entry) || typeof entry.path !== 'string'
        || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)))) fail('invalid manual reconciliation overlay')
    return ledger
  }

  const validateSocketFailureEvidence = async (
    value: Record<string, unknown>, receipt: CategoriesBcSpendingReceipt, root: string
  ): Promise<boolean> => {
    const path = value['failureEvidencePath'], expectedHash = value['failureEvidenceSha256']
    const providerStem = `${receipt.provider}-${receipt.model}`.replace(/[^a-zA-Z0-9_.-]/g, '-')
    const suffix = `/${receipt.caseId}/${providerStem}/failure.txt`
    if (typeof path !== 'string' || !path.startsWith(`${batchRoot}prior-attempts/`) || !path.endsWith(suffix)
      || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')
      || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) fail('socket recovery must pin the matching private archived failure evidence')
    const actual = await realpath(resolve(root, path))
    if (!relative(await realpath(root), actual).replaceAll('\\', '/').startsWith(`${batchRoot}prior-attempts/`)) fail('socket failure evidence escaped its private archive')
    const bytes = await readFile(actual)
    if (bytes.length > 256 * 1024 || hash(bytes) !== expectedHash) fail('socket failure evidence checksum changed')
    const journal: unknown = JSON.parse(await readFile(resolve(dirname(actual), 'dispatch.json'), 'utf8'))
    const expectedDirectory = `${batchRoot}slots/${receipt.caseId}/${providerStem}`
    if (!isRecord(journal) || journal['caseId'] !== receipt.caseId || journal['documentCaseId'] !== receipt.documentCaseId
      || journal['provider'] !== receipt.provider || journal['model'] !== receipt.model || journal['inputSha256'] !== receipt.inputSha256
      || journal['directory'] !== expectedDirectory || journal['status'] !== 'failed'
      || typeof journal['startedAt'] !== 'string' || !Number.isFinite(Date.parse(journal['startedAt']))
      || typeof journal['completedAt'] !== 'string' || !Number.isFinite(Date.parse(journal['completedAt']))
      || Date.parse(journal['startedAt']) > Date.parse(receipt.createdAt)
      || Date.parse(journal['completedAt']) < Date.parse(receipt.completedAt ?? receipt.createdAt)
      || Date.parse(String(value['createdAt'])) < Date.parse(journal['completedAt'])
      || !Array.isArray(journal['artifactHashes']) || !journal['artifactHashes'].some(entry => isRecord(entry)
        && entry['path'] === `${expectedDirectory}/failure.txt` && entry['sha256'] === expectedHash)) fail('archived socket failure journal differs from the retained request')
    const rows = new TextDecoder('utf-8', { fatal: true }).decode(bytes).split('\n').filter(Boolean).flatMap(line => {
      try { return [JSON.parse(line) as unknown] } catch { return [] }
    })
    return rows.some(row => isRecord(row) && row['type'] === 'log' && row['level'] === 'error' && isRecord(row['error'])
      && (value['transportReview'] === 'socket-closed-no-reported-usage'
        ? row['error']['name'] === 'TypeError' && typeof row['error']['message'] === 'string'
          && row['error']['message'].startsWith('The socket connection was closed unexpectedly.')
        : (isCategoriesEfg || isNewspaper) && value['transportReview'] === 'timeout-no-reported-usage'
          && row['error']['name'] === 'AbortError' && row['error']['message'] === 'The operation timed out.'))
  }

  /** Reviewed historical holds remain unchanged and charged in full; a pinned record authorizes one recovery invocation. */
  const validateReconciliations = async (
    ledger: CategoriesBcSpendingLedger,
    root: string,
    plan: CategoriesBcExecutionPlan
  ): Promise<{ authorized: Map<string, { sha256: string, record: CategoriesBcManualReconciliation }>, finalReviews: Map<string, NewspaperFinalBreachAccountingProof> }> => {
    const pins = plan.pages
    const authorized = new Map<string, { sha256: string, record: CategoriesBcManualReconciliation }>()
    const finalReviews = new Map<string, NewspaperFinalBreachAccountingProof>()
    const paths = new Set<string>()
    for (const link of ledger.reconciliations ?? []) {
      if (!link.path.startsWith(reconciliationRoot) || link.path.includes('\\') || link.path.split('/').includes('..') || paths.has(link.path)) fail('manual reconciliation must have a unique private project-relative path')
      paths.add(link.path)
      const actual = await realpath(resolve(root, link.path))
      const local = relative(await realpath(root), actual).replaceAll('\\', '/')
      if (!local.startsWith(reconciliationRoot)) fail('manual reconciliation escaped its private directory')
      const bytes = await readFile(actual)
      if (bytes.length > 16_384 || hash(bytes) !== link.sha256) fail('manual reconciliation checksum changed')
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (isNewspaper && isRecord(value) && value['kind'] === 'ocr-newspaper-expansion-final-breach-accounting-review') {
        const proof = await readNewspaperFinalBreachAccountingReview({ projectRoot: root, reviewPath: link.path,
          reviewSha256: link.sha256, ledger, plan, planSha256: ledger.planSha256 })
        if (authorized.has(proof.receiptId) || finalReviews.has(proof.receiptId)) fail('duplicate final accounting authority for the retained receipt')
        finalReviews.set(proof.receiptId, proof)
        continue
      }
      if (!isRecord(value) || value['schemaVersion'] !== 1 || value['kind'] !== scope.manualKind
        || value['action'] !== 'retain-full-reservation-and-authorize-one-recovery-invocation'
        || value['approvalBudgetCents'] !== CATEGORIES_BC_BUDGET_CENTS || ledger.budgetCents !== CATEGORIES_BC_BUDGET_CENTS
        || value['planSha256'] !== ledger.planSha256
        || value['approvalEvidence'] !== scope.approvalEvidence || typeof value['receiptId'] !== 'string'
        || typeof value['reason'] !== 'string' || !value['reason'].trim() || typeof value['createdAt'] !== 'string'
        || !Number.isFinite(Date.parse(value['createdAt']))) fail('manual reconciliation does not establish the approved recovery action')
      const receipt = ledger.receipts.find(entry => entry.id === value['receiptId'])
      const pricing = receipt ? scopeRates[`${receipt.provider}/${receipt.model}`] : undefined
      const isHttp503 = receipt?.status === 'ambiguous' && receipt.httpStatus === 503 && value['httpStatus'] === 503
      const reviewedGrokBreach = receipt?.status === 'breach' && receipt.provider === 'grok'
        && receipt.httpStatus === 200 && value['httpStatus'] === 200 && pricing !== undefined
        && receipt.visibleOutputTokens === undefined && receipt.reasoningOutputTokens === undefined
        && receipt.reservedCents === roundedCents((CATEGORIES_BC_INPUT_ALLOWANCE * pricing.input + CATEGORIES_BC_GROK_VISIBLE_OUTPUT_CAP * pricing.output) / 1_000_000)
        && tokenCount(receipt.inputTokens) && receipt.inputTokens <= CATEGORIES_BC_INPUT_ALLOWANCE
        && tokenCount(receipt.outputTokens) && receipt.outputTokens > CATEGORIES_BC_GROK_VISIBLE_OUTPUT_CAP
        && receipt.outputTokens <= CATEGORIES_BC_GROK_VISIBLE_OUTPUT_CAP + CATEGORIES_BC_GROK_REASONING_ALLOWANCE
        && (receipt.inputTokens * pricing.input + receipt.outputTokens * pricing.output) / 1_000_000 <= receipt.reservedCents + 1e-9
        && value['reviewedPolicy'] === CATEGORIES_BC_GROK_REVIEWED_POLICY && value['documentationUrl'] === CATEGORIES_BC_GROK_DOCUMENTATION_URL
        && value['nativeVisibleOutputCap'] === CATEGORIES_BC_GROK_VISIBLE_OUTPUT_CAP && value['reasoningAllowance'] === CATEGORIES_BC_GROK_REASONING_ALLOWANCE
      const socketCandidate = receipt?.status === 'ambiguous' && receipt.httpStatus === undefined && value['httpStatus'] === undefined
        && receipt.inputTokens === undefined && receipt.outputTokens === undefined
        && receipt.visibleOutputTokens === undefined && receipt.reasoningOutputTokens === undefined
        && receipt.reason === 'transport outcome unknown; full reservation retained'
      && (value['transportReview'] === 'socket-closed-no-reported-usage'
        || (isCategoriesEfg || isNewspaper) && value['transportReview'] === 'timeout-no-reported-usage')
      const reviewedSocketFailure = socketCandidate && await validateSocketFailureEvidence(value, receipt, root)
      if (!receipt || (!isHttp503 && !reviewedGrokBreach && !reviewedSocketFailure)
        || receipt.chargedCents !== receipt.reservedCents || receipt.reservedCents <= 0
        || value['reservedCents'] !== receipt.reservedCents || value['chargedCents'] !== receipt.chargedCents
        || value['caseId'] !== receipt.caseId || value['documentCaseId'] !== receipt.documentCaseId || value['provider'] !== receipt.provider || value['model'] !== receipt.model
        || value['inputSha256'] !== receipt.inputSha256
        || !pins.some(pin => pin.id === receipt.caseId && pin.inputSha256 === receipt.inputSha256)
        || !scopeRates[`${receipt.provider}/${receipt.model}`]
        || Date.parse(value['createdAt']) < Date.parse(receipt.completedAt ?? receipt.createdAt)
        || authorized.has(receipt.id) || finalReviews.has(receipt.id)) fail('manual reconciliation differs from the retained provider receipt or reviewed policy')
      authorized.set(receipt.id, { sha256: link.sha256, record: value as unknown as CategoriesBcManualReconciliation })
    }
    const recoveries = new Map<string, Set<string>>()
    for (const [index, receipt] of ledger.receipts.entries()) {
      if (receipt.recoveryOfReceiptId === undefined) continue
      const authorization = authorized.get(receipt.recoveryOfReceiptId)
      const parentIndex = ledger.receipts.findIndex(entry => entry.id === receipt.recoveryOfReceiptId)
      const parent = ledger.receipts[parentIndex]
      if (!authorization || !parent || parentIndex >= index || receipt.invocationId === parent.invocationId
        || receipt.recoveryReconciliationSha256 !== authorization.sha256
        || receipt.caseId !== parent.caseId || receipt.documentCaseId !== parent.documentCaseId || receipt.provider !== parent.provider || receipt.model !== parent.model
        || receipt.inputSha256 !== parent.inputSha256 || Date.parse(receipt.createdAt) < Date.parse(authorization.record.createdAt)) fail('recovery request does not match its immutable manual authorization')
      const invocations = recoveries.get(parent.id) ?? new Set<string>()
      invocations.add(receipt.invocationId)
      if (invocations.size > 1) fail('a manual reconciliation cannot authorize a second recovery invocation')
      recoveries.set(parent.id, invocations)
    }
    return { authorized, finalReviews }
  }

  const atomicWrite = async (path: string, ledger: CategoriesBcSpendingLedger): Promise<void> => {
    const temporary = `${path}.${randomUUID()}.tmp`
    const file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(JSON.stringify(ledger, null, 2) + '\n'); await file.sync() } finally { await file.close() }
    await rename(temporary, path)
    const directory = await open(dirname(path), 'r')
    try { await directory.sync() } finally { await directory.close() }
  }

  const endpoint = (provider: string, model: string): string => {
    switch (provider) {
      case 'openai': return 'https://api.openai.com/v1/responses'
      case 'anthropic': return 'https://api.anthropic.com/v1/messages'
      case 'mistral': return 'https://api.mistral.ai/v1/ocr'
      case 'grok': return 'https://api.x.ai/v1/chat/completions'
      case 'deepinfra': return 'https://api.deepinfra.com/v1/openai/chat/completions'
      case 'gemini': return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      default: return fail('unrecognized provider')
    }
  }

  const validateImage = async (
    body: Record<string, unknown>, pin: CategoriesBcPagePin, provider: string, root: string
  ): Promise<{ transportInputSha256?: string, transportPolicy?: string }> => {
    const imageMime = isCategoriesEfg ? pin.format === 'png' ? 'image/png' : 'image/jpeg' : scope.imageMime
    const jpegInputs: Uint8Array[] = []
    const pngInputs: Uint8Array[] = []
    const equivalentTransports: Uint8Array[] = []
    let images = 0
    const check = (base64: string): string => {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) fail('invalid image base64')
      const bytes = Buffer.from(base64, 'base64')
      if (bytes.toString('base64') !== base64) fail('image does not match the authorized source hash')
      const actualHash = hash(bytes)
      if (actualHash !== pin.inputSha256) {
        const allowedTransport = isCategoriesEfg && provider === 'anthropic' && pin.caseId === 'efg-rerun-1-page-newspaper'
          && pin.format === 'png' && pin.width === EFG_ANTHROPIC_NEWSPAPER_TRANSPORT.width && pin.height === EFG_ANTHROPIC_NEWSPAPER_TRANSPORT.height
          && pin.inputSha256 === EFG_ANTHROPIC_NEWSPAPER_TRANSPORT.originalSha256 && actualHash === EFG_ANTHROPIC_NEWSPAPER_TRANSPORT.transportSha256
        if (!allowedTransport) fail('image does not match the authorized source hash')
        equivalentTransports.push(bytes)
      }
      if (imageMime === 'image/png') {
        if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
          || bytes.readUInt32BE(16) !== pin.width || bytes.readUInt32BE(20) !== pin.height
          || pin.width > (isNewspaper ? 3072 : 4096) || pin.height > (isNewspaper ? 3072 : 4096)
          || isNewspaper && bytes.length > 5 * 1024 * 1024) fail('image exceeds the reviewed PNG dimensions or byte allowance')
        if (isCategoriesEfg || isNewspaper) pngInputs.push(bytes)
      } else {
        if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) fail('expected original JPEG bytes')
        jpegInputs.push(bytes)
      }
      images++
      return '<verified-png>'
    }
    const scrub = (value: unknown): unknown => {
      if (typeof value === 'string') {
        if (value.startsWith(`data:${imageMime};base64,`)) return check(value.slice(`data:${imageMime};base64,`.length))
        if (/^(?:data:|https?:\/\/)/.test(value)) fail('unapproved remote or additional media input')
        return value
      }
      if (Array.isArray(value)) return value.map(scrub)
      if (!isRecord(value)) return value
      if (value['type'] === 'base64') {
        if (value['media_type'] !== imageMime || typeof value['data'] !== 'string') fail('unapproved inline image format')
        return { ...value, data: check(value['data']) }
      }
      if ('mimeType' in value && 'data' in value) {
        if (value['mimeType'] !== imageMime || typeof value['data'] !== 'string') fail('unapproved Gemini media input')
        return { ...value, data: check(value['data']) }
      }
      if ('fileData' in value || 'file_id' in value || 'file_uri' in value || 'cache_control' in value
        || ['input_file', 'document_url', 'document', 'file', 'input_audio', 'audio', 'input_video', 'video'].includes(String(value['type']))) fail('unapproved document, uploaded file or additional cached source')
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, scrub(child)]))
    }
    const scrubbed = scrub(body)
    if (images !== 1) fail(`expected exactly one authorized ${imageMime} input`)
    for (const bytes of pngInputs) {
      const image = new Bun.Image(bytes), metadata = await image.metadata()
      if (metadata.format !== 'png' || metadata.width !== pin.width || metadata.height !== pin.height
        || !(await image.png().bytes()).length) fail('PNG decoding or pinned dimensions differ')
    }
    for (const bytes of jpegInputs) {
      const image = new Bun.Image(bytes), metadata = await image.metadata()
      const declarationException = isCategoriesEfg && pin.caseId === 'efg-rerun-1-page-declaration'
        && pin.format === 'jpg' && metadata.width === 3923 && metadata.height === 4656
      if (!['jpg', 'jpeg'].includes(metadata.format) || metadata.width !== pin.width || metadata.height !== pin.height
        || (metadata.width > 4096 || metadata.height > 4096) && !declarationException || !(await image.png().bytes()).length) fail('JPEG decoding or pinned dimensions differ')
    }
    let transport: { transportInputSha256?: string, transportPolicy?: string } = {}
    for (const bytes of equivalentTransports) {
      const sourcePath = await realpath(resolve(root, pin.input))
      if (!scope.inputRoots.some(prefix => relative(root, sourcePath).replaceAll('\\', '/').startsWith(prefix))) fail('lossless PNG source escaped the approved input roots')
      transport = verifyOcrLosslessPngTransport(new Uint8Array(await readFile(sourcePath)), bytes, EFG_ANTHROPIC_NEWSPAPER_TRANSPORT)
    }
    if (Buffer.byteLength(JSON.stringify(scrubbed), 'utf8') > 8192) fail('request text/schema exceeds the reviewed 8192-byte allowance')
    return transport
  }

  const readUsage = (provider: string, payload: unknown, pricing: Rate): ReviewedUsage | undefined => {
    if (!isRecord(payload)) return undefined
    if (pricing.pageCents !== undefined) {
      const usage = payload['usage_info']
      if (!isRecord(usage) || usage['pages_processed'] !== 1) return undefined
      return { inputTokens: 0, outputTokens: 0, cents: pricing.pageCents }
    }
    const usage = provider === 'gemini' ? payload['usageMetadata'] : payload['usage']
    if (!isRecord(usage)) return undefined
    if (provider === 'openai') return readOpenAIStandardUsage(usage, pricing)
    let inputTokens: unknown, outputTokens: unknown
    if (provider === 'gemini') {
      inputTokens = usage['promptTokenCount']
      const candidates = usage['candidatesTokenCount'], thoughts = usage['thoughtsTokenCount'] ?? 0
      if (!tokenCount(candidates) || !tokenCount(thoughts)) return undefined
      outputTokens = candidates + thoughts
    } else if (provider === 'anthropic') {
      const input = usage['input_tokens'], cached = usage['cache_read_input_tokens'] ?? 0, created = usage['cache_creation_input_tokens'] ?? 0
      if (!tokenCount(input) || !tokenCount(cached) || !tokenCount(created) || cached !== 0 || created !== 0) return undefined
      inputTokens = input; outputTokens = usage['output_tokens']
    } else if (provider === 'grok') {
      inputTokens = usage['prompt_tokens']
      const visible = usage['completion_tokens'], details = usage['completion_tokens_details']
      const reasoning = isRecord(details) ? details['reasoning_tokens'] ?? 0 : 0
      if (!tokenCount(visible) || !tokenCount(reasoning)) return undefined
      const billableOutputTokens = visible + reasoning
      if (!tokenCount(inputTokens)) return undefined
      return { inputTokens, outputTokens: billableOutputTokens, visibleOutputTokens: visible, reasoningOutputTokens: reasoning,
        cents: roundedCents((inputTokens * pricing.input + billableOutputTokens * pricing.output) / 1_000_000),
        costBasis: 'provider-usage-at-reviewed-rates',
        costNote: 'xAI visible completion and separate reasoning tokens valued once at reviewed rates; the native 4096-token limit applies only to visible output. The additional 32768-token reasoning allowance is unmeasured, not provider-enforced or invoice-reconciled.' }
    } else {
      inputTokens = usage['prompt_tokens']; outputTokens = usage['completion_tokens']
      // OpenAI-compatible completion_tokens already includes reasoning; never add it again.
    }
    if (!tokenCount(inputTokens) || !tokenCount(outputTokens)) return undefined
    return { inputTokens, outputTokens, cents: roundedCents((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000) }
  }

  const createGuard = (inputOptions: CategoriesBcSpendingGuardOptions): typeof fetch => {
    const options = { ...inputOptions }
    const root = resolve(options.projectRoot ?? PROJECT_ROOT)
    privatePath(options.ledgerPath)
    const path = resolve(root, options.ledgerPath)
    if (relative(root, path).startsWith('..')) fail('ledger escaped the project')
    const budgetCents = CATEGORIES_BC_BUDGET_CENTS
    const pricing = scopeRates[`${options.provider}/${options.model}`]
    if (!pricing) fail('case/provider/model is outside the approved benchmark')
    const expectedEndpoint = endpoint(options.provider, options.model)
    const originalFetch = options.fetchImplementation ?? globalThis.fetch
    const invocationId = randomUUID()
    const update = async <T>(operation: (ledger: CategoriesBcSpendingLedger) => T | Promise<T>): Promise<T> => {
      const plan = await readApprovedPlan(options, root)
      await mkdir(dirname(path), { recursive: true })
      const ledgerDirectory = relative(await realpath(root), await realpath(dirname(path))).replaceAll('\\', '/')
      if (ledgerDirectory !== batchRoot.slice(0, -1) && !ledgerDirectory.startsWith(batchRoot)) fail('ledger directory escaped its private root')
      try { if (!relative(await realpath(root), await realpath(path)).replaceAll('\\', '/').startsWith(batchRoot)) fail('ledger escaped its private root') } catch (error) { if (!isRecord(error) || error['code'] !== 'ENOENT') throw error }
      const lock = await (async () => {
        const deadline = performance.now() + 10_000
        while (true) {
          try { return await open(`${path}.lock`, 'wx', 0o600) } catch (error) {
            if (!isRecord(error) || error['code'] !== 'EEXIST') throw error
            if (performance.now() >= deadline) fail('ledger remained locked for 10 seconds; an interrupted writer requires reconciliation')
            await new Promise(resolveWait => setTimeout(resolveWait, 25 + Math.floor(Math.random() * 10)))
          }
        }
      })()
      try {
        let value: unknown
        try { value = JSON.parse(await readFile(path, 'utf8')) } catch (error) {
          if (!isRecord(error) || error['code'] !== 'ENOENT') throw error
          value = { schemaVersion: 1, kind: scope.ledgerKind, budgetCents, inputTokenAssumption: inputAssumption, planSha256: options.planSha256, receipts: [] }
        }
        const ledger = validateLedger(value, plan, options.planSha256)
        const result = await operation(ledger)
        await atomicWrite(path, ledger)
        return result
      } finally { await lock.close(); await unlink(`${path}.lock`) }
    }
    const guarded = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const plan = await readApprovedPlan(options, root)
      const pin = plan.pages.find(page => page.id === options.pageId)
      if (!pin) fail('page is outside the approved benchmark')
      if (input instanceof Request || typeof init?.body !== 'string' || (init.method ?? 'GET') !== 'POST') fail('only explicit JSON generation POST requests are authorized')
      const url = new URL(String(input))
      if (url.href !== expectedEndpoint || url.username || url.password) fail('unapproved provider host, path, query, or model')
      let parsed: unknown
      try { parsed = JSON.parse(init.body) } catch { return fail('request body is not JSON') }
      if (!isRecord(parsed)) fail('request body is not an object')
      const body = parsed
      if (options.provider !== 'gemini' && body['model'] !== options.model) fail('request model differs from the approved target')
      if (body['stream'] === true || body['tools'] !== undefined || (options.provider !== 'openai' && body['service_tier'] !== undefined) || body['n'] !== undefined) fail('streaming, tools, alternate tiers, or multiple outputs are not authorized')
      if (['search_parameters', 'web_search_options', 'audio', 'modalities', 'response_modalities', 'file_search', 'cachedContent', 'previous_response_id', 'conversation'].some(key => key in body)) fail('unreviewed auxiliary tools, prior context or output modalities are not authorized')
      if (options.provider === 'openai') {
        applyOpenAIStandardBillingControls(body)
        if (body['max_output_tokens'] !== undefined && body['max_output_tokens'] !== CATEGORIES_BC_OPENAI_OUTPUT_CAP) fail('unexpected OpenAI output cap')
        body['max_output_tokens'] = CATEGORIES_BC_OPENAI_OUTPUT_CAP
      } else if (options.provider === 'gemini') {
        const config = body['generationConfig']
        if (!isRecord(config) || config['maxOutputTokens'] !== pricing.outputCap || config['candidateCount'] !== undefined) fail('unexpected Gemini output cap or candidate count')
      } else if (pricing.pageCents === undefined) {
        const field = options.provider === 'grok' ? 'max_completion_tokens' : 'max_tokens'
        if (body[field] !== pricing.outputCap) fail('unexpected native output cap')
      }
      const transport = await validateImage(body, pin, options.provider, root)
      const bodyText = JSON.stringify(body)
      const inputRate = pricing.input * (options.provider === 'openai' ? OPENAI_DEFAULT_CACHE_WRITE_MULTIPLIER : 1)
      const outputAllowance = options.provider === 'grok' ? CATEGORIES_BC_GROK_VISIBLE_OUTPUT_CAP + CATEGORIES_BC_GROK_REASONING_ALLOWANCE : pricing.outputCap
      const reserve = pricing.pageCents ?? roundedCents((CATEGORIES_BC_INPUT_ALLOWANCE * inputRate + outputAllowance * pricing.output) / 1_000_000)
      const receipt: CategoriesBcSpendingReceipt = {
        id: randomUUID(), invocationId, caseId: options.pageId, documentCaseId: pin.caseId, provider: options.provider, model: options.model,
        requestSha256: hash(bodyText), inputSha256: pin.inputSha256, reservedCents: reserve, chargedCents: reserve,
        status: 'reserved', createdAt: new Date().toISOString(),
        ...transport,
        ...(options.provider === 'openai' ? { costBasis: 'conservative-upper-bound' as const,
          costNote: 'Reservation uses the unmeasured 64k input allowance at the 1.25x default 30m-write rate and the output cap at Standard rates; not actual invoice cost.' }
          : options.provider === 'grok' ? { costBasis: 'conservative-upper-bound' as const,
            costNote: 'Reservation counts the native 4096 visible-output cap plus an UNMEASURED 32768 reasoning-token allowance, along with the unmeasured 64k input allowance. xAI does not enforce this reasoning allowance; an observed breach blocks further dispatch. Not invoice-confirmed cost.' } : {})
      }
      await update(async ledger => {
        const { authorized, finalReviews } = await validateReconciliations(ledger, root, plan)
        if (ledger.receipts.some(entry => entry.status === 'breach' && !authorized.has(entry.id) && !finalReviews.has(entry.id)
          || (entry.status === 'ambiguous' && !authorized.has(entry.id)))) fail('unresolved admitted request or allowance breach requires reconciliation')
        const slot = ledger.receipts.filter(entry => entry.caseId === options.pageId && entry.provider === options.provider && entry.model === options.model)
        if (slot.some(entry => finalReviews.has(entry.id))) fail('final accounting review permanently forbids redispatch of this slot')
        for (const proof of finalReviews.values()) {
          const only = proof.continueOnly
          if (options.pageId !== only.caseId || pin.caseId !== only.documentCaseId || options.provider !== only.provider
            || options.model !== only.model || pin.inputSha256 !== only.inputSha256) fail('final accounting review permits only the approved Fable NYT slot')
        }
        if (slot.some(entry => entry.status === 'reserved')) fail('this slot already has an in-flight request reservation')
        if (slot.some(entry => entry.invocationId !== invocationId && !authorized.has(entry.id)
          && (entry.status !== 'rejected' || entry.recoveryOfReceiptId !== undefined))) fail('this slot already has admitted evidence or consumed its recovery invocation; automatic redispatch is blocked')
        const priorAmbiguous = slot.filter(entry => authorized.has(entry.id)).reverse()
        if (priorAmbiguous.length > 0) {
          const parent = priorAmbiguous.find(entry => {
            const attempts = slot.filter(attempt => attempt.recoveryOfReceiptId === entry.id)
            return entry.invocationId !== invocationId && (attempts.length === 0 || attempts.every(attempt => attempt.invocationId === invocationId))
          })
          if (!parent) fail('the one manually authorized recovery invocation was already consumed')
          receipt.recoveryOfReceiptId = parent.id
          receipt.recoveryReconciliationSha256 = authorized.get(parent.id)!.sha256
        }
        if (slot.filter(entry => entry.status === 'settled').length >= 3 || slot.length >= 12) fail('maximum request attempts reached')
        if (totalHeld(ledger) + reserve > budgetCents + 1e-9) fail(`request reservation ${reserve.toFixed(6)} cents exceeds the remaining cumulative approval`)
        ledger.receipts.push(receipt)
      })
      const finish = async (change: Partial<CategoriesBcSpendingReceipt>): Promise<void> => {
        await update(ledger => {
          const found = ledger.receipts.find(entry => entry.id === receipt.id)
          if (!found || found.status !== 'reserved') fail('request reservation is missing or already settled')
          Object.assign(found, change, { completedAt: new Date().toISOString() })
        })
      }
      const failureEvidence = async (payload: unknown): Promise<Partial<CategoriesBcSpendingReceipt>> => {
        const evidencePath = `${batchRoot}provider-response-evidence/${receipt.id}.json`
        const text = JSON.stringify({ schemaVersion: 1, receiptId: receipt.id, pageId: receipt.caseId,
          documentCaseId: receipt.documentCaseId, provider: receipt.provider, model: receipt.model,
          serialization: 'Parsed provider JSON serialized locally; not original response bytes.', response: payload }) + '\n'
        try {
          const evidenceDirectory = dirname(resolve(root, evidencePath))
          await mkdir(evidenceDirectory, { recursive: true })
          if (!relative(await realpath(root), await realpath(evidenceDirectory)).replaceAll('\\', '/').startsWith(batchRoot)) fail('private response evidence escaped the batch directory')
          const file = await open(resolve(root, evidencePath), 'wx', 0o600)
          try { await file.writeFile(text); await file.sync() } finally { await file.close() }
          return { responseEvidencePath: evidencePath, responseEvidenceSha256: hash(text) }
        } catch {
          return { responseEvidenceError: 'Private provider-response evidence could not be persisted; original charge remains held.' }
        }
      }
      let response: Response
      try { response = await originalFetch(input, { ...init, body: bodyText, redirect: 'error' }) } catch (error) {
        await finish({ status: 'ambiguous', reason: 'transport outcome unknown; full reservation retained' })
        throw error
      }
      // These explicit rejection statuses do not indicate a generated inference response.
      if ([400, 401, 403, 404, 405, 413, 415, 422, 429].includes(response.status)) {
        let rejectedPayload: unknown
        try { rejectedPayload = await readJsonResponse(response.clone() as Response, 'OCR rejected admission', { maxBytes: 8 * 1024 * 1024 }) } catch { rejectedPayload = undefined }
        if (isRecord(rejectedPayload) && (rejectedPayload['usage'] !== undefined || rejectedPayload['usageMetadata'] !== undefined || rejectedPayload['usage_info'] !== undefined)) {
          await finish({ ...await failureEvidence(rejectedPayload), status: 'ambiguous', httpStatus: response.status, reason: 'rejected HTTP status included inference usage; full reservation retained' })
          return fail('rejected status included inference usage; further dispatch blocked')
        }
        await finish({ status: 'rejected', chargedCents: 0, httpStatus: response.status, reason: 'explicit pre-admission rejection' })
        return response
      }
      let payload: unknown
      try { payload = await readJsonResponse(response.clone() as Response, 'OCR spending receipt', { maxBytes: 8 * 1024 * 1024 }) } catch {
        await finish({ status: 'ambiguous', httpStatus: response.status, reason: 'unreadable provider usage; full reservation retained' })
        return fail('provider usage was unreadable; further dispatch blocked')
      }
      if (response.ok && options.provider === 'openai' && (!isRecord(payload) || payload['service_tier'] !== 'default')) {
        await finish({ ...await failureEvidence(payload), status: 'ambiguous', httpStatus: response.status, reason: 'OpenAI response did not confirm the Standard default service tier; full reservation retained' })
        return fail('OpenAI response did not confirm the Standard default service tier; further dispatch blocked')
      }
      const usage = response.ok ? readUsage(options.provider, payload, pricing) : undefined
      if (!usage) {
        await finish({ ...await failureEvidence(payload), status: 'ambiguous', httpStatus: response.status, reason: 'missing complete usage or ambiguous HTTP status; full reservation retained' })
        return fail('provider response did not establish complete usage; further dispatch blocked')
      }
      const outputBreach = options.provider === 'grok'
        ? !tokenCount(usage.visibleOutputTokens) || !tokenCount(usage.reasoningOutputTokens)
          || usage.visibleOutputTokens > CATEGORIES_BC_GROK_VISIBLE_OUTPUT_CAP || usage.reasoningOutputTokens > CATEGORIES_BC_GROK_REASONING_ALLOWANCE
        : usage.outputTokens > outputAllowance
      const breach = usage.inputTokens > CATEGORIES_BC_INPUT_ALLOWANCE || outputBreach || usage.outputTokens > outputAllowance || usage.cents > reserve + 1e-9
      await finish({ ...(breach ? await failureEvidence(payload) : {}), status: breach ? 'breach' : 'settled', chargedCents: Math.max(breach ? reserve : 0, usage.cents),
        httpStatus: response.status, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        ...(usage.visibleOutputTokens === undefined ? {} : { visibleOutputTokens: usage.visibleOutputTokens, reasoningOutputTokens: usage.reasoningOutputTokens }),
        ...(breach ? { costBasis: 'conservative-upper-bound' as const,
          costNote: 'Allowance breach: retain the greater of the reservation and locally valued usage; not invoice-reconciled charges.' }
          : usage.costBasis ? { costBasis: usage.costBasis, costNote: usage.costNote } : {}),
        ...(breach ? { reason: 'reported usage exceeded the reserved allowance; further dispatch blocked' } : {}) })
      if (breach) return fail('reported usage exceeded the reserved allowance; further dispatch blocked')
      return response
    }) as typeof fetch
    guarded.preconnect = originalFetch.preconnect
    return guarded
  }


  return createGuard
}
const bcProfileGuard = createProfileGuard('categories-bc')
const categoryDProfileGuard = createProfileGuard('category-d')
const categoriesEfgProfileGuard = createProfileGuard('categories-efg')
const newspaperExpansionProfileGuard = createProfileGuard('newspaper-expansion')
/** Only fixed, explicitly approved benchmark profiles are exposed; arbitrary spending/scope overrides are not accepted. */
export const createApprovedOcrBenchmarkSpendingGuard = (
  profile: ApprovedOcrBenchmarkGuardProfile, options: CategoriesBcSpendingGuardOptions
): typeof fetch => {
  if (profile === 'categories-bc') return bcProfileGuard(options)
  if (profile === 'category-d') return categoryDProfileGuard(options)
  if (profile === 'categories-efg') return categoriesEfgProfileGuard(options)
  if (profile === 'newspaper-expansion') return newspaperExpansionProfileGuard(options)
  throw new Error('OCR spending guard: unknown approved benchmark profile')
}
export const createCategoriesBcSpendingGuard = (options: CategoriesBcSpendingGuardOptions): typeof fetch =>
  createApprovedOcrBenchmarkSpendingGuard('categories-bc', options)

if (process.env['AUTOSHOW_OCR_BC_GUARD'] === '1') {
  const required = (name: string): string => process.env[name]?.trim() || (() => { throw new Error(`OCR spending guard: missing ${name}`) })()
  globalThis.fetch = createCategoriesBcSpendingGuard({
    planPath: required('AUTOSHOW_OCR_BC_PLAN'), planSha256: required('AUTOSHOW_OCR_BC_PLAN_SHA256'),
    ledgerPath: required('AUTOSHOW_OCR_BC_LEDGER'), pageId: required('AUTOSHOW_OCR_BC_PAGE'),
    provider: required('AUTOSHOW_OCR_BC_PROVIDER'), model: required('AUTOSHOW_OCR_BC_MODEL')
  })
}
