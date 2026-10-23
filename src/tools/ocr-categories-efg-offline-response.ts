import { AppValidationError } from '~/utils/error-handler'
import { realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import * as v from 'valibot'
import { PROJECT_ROOT } from '~/utils/project-root'

export const EFG_OFFLINE_ROOT = 'input/examples/document/ocr-categories-efg-run'
const pageId = 'efg-rerun-1-page-newspaper-page-01', documentId = 'efg-rerun-1-page-newspaper'
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nonempty = v.pipe(v.string(), v.nonEmpty()), digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const count = v.pipe(v.number(), v.integer(), v.minValue(0), v.finite()), money = v.pipe(v.number(), v.minValue(0), v.finite())
const reviewSchema = v.object({ schemaVersion: v.literal(1), kind: v.literal('ocr-categories-efg-offline-response-review'),
  action: v.literal('accept-saved-response-for-offline-artifact-recovery-only'), policy: v.literal('efg-saved-grok-response-under-existing-total-reservation-v1'),
  planSha256: digest, receiptId: nonempty, receiptCanonicalJsonSha256: digest, caseId: v.literal(pageId), documentCaseId: v.literal(documentId),
  provider: v.literal('grok'), model: v.literal('grok-4.7'), requestSha256: digest, inputSha256: digest, responseEvidencePath: nonempty, responseEvidenceSha256: digest,
  retainedStatus: v.literal('breach'), reservedCents: money, chargedCents: money,
  usage: v.object({ inputTokens: count, visibleOutputTokens: count, reasoningOutputTokens: count, outputTokens: count, totalTokens: count }),
  limits: v.object({ inputTokens: v.literal(64000), visibleOutputTokens: v.literal(4096), totalOutputTokens: v.literal(36864) }), conservativeUsageCents: money,
  content: v.object({ choiceIndex: v.literal(0), finishReason: v.literal('stop'), utf8Bytes: count, sha256: digest }),
  allowsRedispatch: v.literal(false), releasesCharge: v.literal(false), reason: nonempty, createdAt: nonempty })
export type EfgOfflineResponseReview = v.InferOutput<typeof reviewSchema>
export interface OfflineResponseReviewLink { path: string, sha256: string }

const portable = (path: string, prefix: string): void => {
  if (!path.startsWith(prefix) || isAbsolute(path) || /[:\\\x00]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new AppValidationError('Offline response proof must use its private normalized project-relative path')
}

/** Pure evidence verification. A review authorizes artifact decoding only; it never authorizes dispatch or changes a receipt. */
export const verifyEfgOfflineResponseReview = (value: unknown, receipt: unknown, evidenceBytes: Uint8Array, expectedPlanSha256: string) => {
  const review = v.parse(reviewSchema, value)
  if (!record(receipt) || review.planSha256 !== expectedPlanSha256 || hash(JSON.stringify(receipt)) !== review.receiptCanonicalJsonSha256
    || review.receiptId !== receipt['id'] || review.caseId !== receipt['caseId'] || review.documentCaseId !== receipt['documentCaseId']
    || review.provider !== receipt['provider'] || review.model !== receipt['model'] || review.inputSha256 !== receipt['inputSha256']
    || review.requestSha256 !== receipt['requestSha256'] || receipt['status'] !== 'breach' || receipt['httpStatus'] !== 200
    || receipt['costBasis'] !== 'conservative-upper-bound' || review.reservedCents !== receipt['reservedCents'] || review.chargedCents !== receipt['chargedCents']
    || review.reservedCents !== 34.9184 || review.chargedCents !== review.reservedCents
    || review.responseEvidencePath !== receipt['responseEvidencePath'] || review.responseEvidenceSha256 !== receipt['responseEvidenceSha256']
    || hash(evidenceBytes) !== review.responseEvidenceSha256) throw new AppValidationError('Offline response review differs from the unchanged retained HTTP200 breach receipt or evidence')
  portable(review.responseEvidencePath, `${EFG_OFFLINE_ROOT}/provider-response-evidence/`)
  const evidence: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(evidenceBytes))
  if (!record(evidence) || evidence['schemaVersion'] !== 1 || evidence['receiptId'] !== review.receiptId || evidence['pageId'] !== review.caseId
    || evidence['documentCaseId'] !== review.documentCaseId || evidence['provider'] !== review.provider || evidence['model'] !== review.model
    || evidence['serialization'] !== 'Parsed provider JSON serialized locally; not original response bytes.' || !record(evidence['response'])) throw new AppValidationError('Offline response wrapper identity or serialization changed')
  const response = evidence['response'], choices = response['choices'], usage = response['usage']
  if (response['model'] !== review.model || !Array.isArray(choices) || choices.length !== 1 || !record(choices[0]) || choices[0]['finish_reason'] !== 'stop'
    || !record(choices[0]['message']) || choices[0]['message']['role'] !== 'assistant' || typeof choices[0]['message']['content'] !== 'string'
    || !choices[0]['message']['content'].trim() || choices[0]['message']['refusal'] !== undefined && choices[0]['message']['refusal'] !== null
    || !record(usage) || !record(usage['completion_tokens_details'])) throw new AppValidationError('Offline response is not one complete non-refused assistant text response with usage')
  const text = choices[0]['message']['content'], u = review.usage
  if (Buffer.byteLength(text, 'utf8') !== review.content.utf8Bytes || hash(text) !== review.content.sha256
    || usage['prompt_tokens'] !== u.inputTokens || usage['completion_tokens'] !== u.visibleOutputTokens
    || usage['completion_tokens_details']['reasoning_tokens'] !== u.reasoningOutputTokens || usage['total_tokens'] !== u.totalTokens
    || u.visibleOutputTokens + u.reasoningOutputTokens !== u.outputTokens || u.inputTokens + u.outputTokens !== u.totalTokens
    || receipt['inputTokens'] !== u.inputTokens || receipt['visibleOutputTokens'] !== u.visibleOutputTokens || receipt['reasoningOutputTokens'] !== u.reasoningOutputTokens
    || receipt['outputTokens'] !== u.outputTokens || u.inputTokens > 64000 || u.visibleOutputTokens > 4096 || u.outputTokens > 36864 || u.reasoningOutputTokens <= 32768) throw new AppValidationError('Offline response text/usage is incomplete, changed or outside the reviewed total reservation')
  const conservativeUsageCents = Math.round((u.inputTokens * 200 + u.outputTokens * 600) / 1_000_000 * 1e8) / 1e8
  if (review.conservativeUsageCents !== conservativeUsageCents || conservativeUsageCents > review.chargedCents) throw new AppValidationError('Offline response usage exceeds its unchanged retained money reservation')
  const started = Date.parse(String(receipt['createdAt'])), completed = Date.parse(String(receipt['completedAt'])), reviewed = Date.parse(review.createdAt)
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started || !Number.isFinite(reviewed) || reviewed < completed) throw new AppValidationError('Offline response paid/review timing is invalid')
  return { review, response, text, originalRequestStartedAt: String(receipt['createdAt']), originalRequestCompletedAt: String(receipt['completedAt']),
    originalProviderProcessingTimeMs: completed - started, originalTimingPolicy: 'Original retained receipt admission-to-completion wall time, including network and response accounting; offline replay duration is separate.' }
}

export const readEfgOfflineResponseReview = async (link: OfflineResponseReviewLink, projectRoot = PROJECT_ROOT) => {
  const root = await realpath(projectRoot)
  const bytes = async (path: string, prefix = `${EFG_OFFLINE_ROOT}/`): Promise<Uint8Array> => {
    portable(path, prefix)
    const target = await realpath(resolve(root, path)), rel = relative(root, target)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || !rel.replaceAll(sep, '/').startsWith(prefix)) throw new AppValidationError('Offline response proof escaped its private directory')
    return await Bun.file(target).bytes()
  }
  const reviewBytes = await bytes(link.path, `${EFG_OFFLINE_ROOT}/offline-response-reviews/`)
  if (!/^[a-f0-9]{64}$/.test(link.sha256) || hash(reviewBytes) !== link.sha256) throw new AppValidationError('Offline response review checksum changed')
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(reviewBytes)), review = v.parse(reviewSchema, value)
  if (link.path !== `${EFG_OFFLINE_ROOT}/offline-response-reviews/${review.receiptId}.json`) throw new AppValidationError('Offline response review filename differs from receipt')
  const planBytes = await bytes(`${EFG_OFFLINE_ROOT}/execution-plan.json`), plan: unknown = JSON.parse(new TextDecoder().decode(planBytes))
  const ledger: unknown = JSON.parse(new TextDecoder().decode(await bytes(`${EFG_OFFLINE_ROOT}/spending-ledger.json`)))
  if (!record(plan) || plan['schemaVersion'] !== 1 || plan['kind'] !== 'ocr-categories-efg-execution-plan' || !record(plan['approval'])
    || plan['approval']['status'] !== 'approved' || plan['approval']['budgetCents'] !== 3000 || plan['approval']['evidence'] !== 'User approved up to $30 for categories 5–7'
    || !Array.isArray(plan['pages']) || !Array.isArray(plan['targets']) || !record(ledger) || ledger['kind'] !== 'ocr-categories-efg-spending-ledger'
    || ledger['budgetCents'] !== 3000 || ledger['planSha256'] !== hash(planBytes) || !Array.isArray(ledger['receipts'])) throw new AppValidationError('Offline response is outside the approved EFG plan/ledger')
  const receipts = ledger['receipts'].filter(row => record(row) && row['id'] === review.receiptId)
  const pages = plan['pages'].filter(row => record(row) && row['id'] === review.caseId)
  if (receipts.length !== 1 || pages.length !== 1 || !record(pages[0]) || pages[0]['caseId'] !== review.documentCaseId || pages[0]['inputSha256'] !== review.inputSha256
    || typeof pages[0]['input'] !== 'string' || !plan['targets'].some(row => record(row) && row['provider'] === 'grok' && row['model'] === 'grok-4.7')) throw new AppValidationError('Offline response page/target/receipt identity differs from approved plan')
  const inputBytes = await bytes(pages[0]['input'], 'input/')
  if (hash(inputBytes) !== review.inputSha256) throw new AppValidationError('Offline response source image hash changed')
  const verified = verifyEfgOfflineResponseReview(value, receipts[0], await bytes(review.responseEvidencePath), hash(planBytes))
  return { ...verified, link, input: pages[0]['input'] }
}

/** Bind a reconstructed native result to both the immutable paid failure and the one-request offline proof. */
export const admitEfgOfflineReplayArtifact = async (journal: unknown, text: string, processingTimeMs: unknown, projectRoot = PROJECT_ROOT) => {
  if (!record(journal) || !record(journal['offlineResponseReview']) || typeof journal['offlineResponseReview']['path'] !== 'string'
    || typeof journal['offlineResponseReview']['sha256'] !== 'string' || !record(journal['offlineReplay'])) throw new AppValidationError('Offline replay journal lacks its reviewed evidence/proof links')
  const link = { path: journal['offlineResponseReview']['path'], sha256: journal['offlineResponseReview']['sha256'] }
  const verified = await readEfgOfflineResponseReview(link, projectRoot), replay = journal['offlineReplay']
  if (journal['caseId'] !== verified.review.caseId || journal['documentCaseId'] !== verified.review.documentCaseId || journal['provider'] !== 'grok'
    || journal['model'] !== 'grok-4.7' || journal['inputSha256'] !== verified.review.inputSha256 || text !== verified.text
    || processingTimeMs !== verified.originalProviderProcessingTimeMs || replay['originalProviderProcessingTimeMs'] !== processingTimeMs
    || replay['networkCalls'] !== 0 || replay['servedResponses'] !== 1 || typeof replay['wallTimeMs'] !== 'number' || !Number.isFinite(replay['wallTimeMs']) || replay['wallTimeMs'] < 0
    || typeof replay['startedAt'] !== 'string' || typeof replay['completedAt'] !== 'string'
    || Date.parse(replay['completedAt']) - Date.parse(replay['startedAt']) !== replay['wallTimeMs']) throw new AppValidationError('Offline replay text, original paid timing or zero-network replay accounting changed')
  const root = await realpath(projectRoot)
  const linkedJson = async (value: unknown, prefix: string): Promise<unknown> => {
    if (!record(value) || typeof value['path'] !== 'string' || typeof value['sha256'] !== 'string') throw new AppValidationError('Missing offline replay artifact link')
    portable(value['path'], prefix)
    const target = await realpath(resolve(root, value['path'])), rel = relative(root, target).replaceAll(sep, '/')
    if (!rel.startsWith(prefix)) throw new AppValidationError('Offline replay artifact escaped its private directory')
    const bytes = await Bun.file(target).bytes()
    if (hash(bytes) !== value['sha256']) throw new AppValidationError('Offline replay artifact checksum changed')
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  }
  const original = await linkedJson(replay['originalFailedDispatch'], `${EFG_OFFLINE_ROOT}/prior-attempts/saved-response-review/`)
  const proof = await linkedJson(replay['proof'], `${EFG_OFFLINE_ROOT}/offline-replay-work/${verified.review.receiptId}/`)
  if (!record(original) || original['status'] !== 'failed' || original['caseId'] !== journal['caseId'] || original['documentCaseId'] !== journal['documentCaseId']
    || original['provider'] !== journal['provider'] || original['model'] !== journal['model'] || original['inputSha256'] !== journal['inputSha256']
    || original['referenceSha256'] !== journal['referenceSha256'] || original['directory'] !== journal['directory']
    || original['startedAt'] !== journal['startedAt'] || original['completedAt'] !== journal['completedAt']
    || Date.parse(String(original['startedAt'])) > Date.parse(verified.originalRequestStartedAt)
    || Date.parse(String(original['completedAt'])) < Date.parse(verified.originalRequestCompletedAt)
    || !record(proof) || proof['schemaVersion'] !== 1 || proof['kind'] !== 'ocr-efg-offline-fetch-proof'
    || !record(proof['review']) || proof['review']['path'] !== link.path || proof['review']['sha256'] !== link.sha256
    || proof['receiptId'] !== verified.review.receiptId || proof['requestSha256'] !== verified.review.requestSha256
    || proof['responseEvidenceSha256'] !== verified.review.responseEvidenceSha256 || proof['networkCalls'] !== 0 || proof['servedResponses'] !== 1 || proof['blockedRequests'] !== 0) throw new AppValidationError('Offline replay does not preserve its paid failed attempt or one-response proof')
  return { receiptId: verified.review.receiptId, review: link, source: 'hash-reviewed-original-HTTP200-response-replayed-offline',
    networkCalls: 0, retainedReceiptStatus: 'breach', retainedChargeCents: verified.review.chargedCents,
    originalProviderProcessingTimeMs: verified.originalProviderProcessingTimeMs, originalTimingPolicy: verified.originalTimingPolicy,
    offlineReplayWallTimeMs: replay['wallTimeMs'], noNewBillingReceipt: true, moneyReservationReleased: false }
}

/** No native fetch reference or network fallback exists. Exactly one matching original Grok POST can be replayed. */
export const createEfgOfflineGrokFetch = (verified: ReturnType<typeof verifyEfgOfflineResponseReview>) => {
  const stats = { servedResponses: 0, blockedRequests: 0, networkCalls: 0 }
  const fetchImplementation = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    const body = init?.body
    if (String(input) !== 'https://api.x.ai/v1/chat/completions' || init?.method !== 'POST' || typeof body !== 'string'
      || hash(body) !== verified.review.requestSha256 || stats.servedResponses !== 0 || init.signal?.aborted) {
      stats.blockedRequests++; throw new AppValidationError('Offline response replay blocked an unmatched, repeated or cancelled request; network fallback is disabled')
    }
    const parsed: unknown = JSON.parse(body)
    if (!record(parsed) || parsed['model'] !== 'grok-4.7' || parsed['max_completion_tokens'] !== 4096 || !Array.isArray(parsed['messages'])) throw new AppValidationError('Offline request model/output controls changed')
    const images = parsed['messages'].flatMap(message => record(message) && Array.isArray(message['content']) ? message['content'] : [])
      .filter(block => record(block) && block['type'] === 'image_url')
    const image = images[0]
    if (images.length !== 1 || !record(image) || !record(image['image_url']) || typeof image['image_url']['url'] !== 'string'
      || !image['image_url']['url'].startsWith('data:image/png;base64,')
      || hash(Buffer.from(image['image_url']['url'].slice('data:image/png;base64,'.length), 'base64')) !== verified.review.inputSha256) throw new AppValidationError('Offline request source PNG changed')
    stats.servedResponses++
    return new Response(JSON.stringify(verified.response), { status: 200, headers: { 'content-type': 'application/json' } })
  }, { preconnect: () => { throw new AppValidationError('Offline response replay forbids network preconnect') } }) as typeof fetch
  return { fetch: fetchImplementation, stats }
}

// This module is also the explicitly enabled preload for one private CLI child.
if (process.env['AUTOSHOW_OCR_EFG_OFFLINE_REPLAY'] === '1') {
  const path = process.env['AUTOSHOW_OCR_EFG_OFFLINE_REVIEW'], sha256 = process.env['AUTOSHOW_OCR_EFG_OFFLINE_REVIEW_SHA256'], proofPath = process.env['AUTOSHOW_OCR_EFG_OFFLINE_PROOF']
  if (!path || !sha256 || !proofPath) throw new AppValidationError('Offline response preload requires pinned review and proof paths')
  const verified = await readEfgOfflineResponseReview({ path, sha256 }), replay = createEfgOfflineGrokFetch(verified)
  portable(proofPath, `${EFG_OFFLINE_ROOT}/offline-replay-work/${verified.review.receiptId}/`)
  const proofDirectory = relative(await realpath(PROJECT_ROOT), await realpath(dirname(resolve(PROJECT_ROOT, proofPath)))).replaceAll(sep, '/') + '/'
  if (!proofDirectory.startsWith(`${EFG_OFFLINE_ROOT}/offline-replay-work/${verified.review.receiptId}/`)) throw new AppValidationError('Offline response proof output escaped its private replay directory')
  const persist = async () => await Bun.write(resolve(PROJECT_ROOT, proofPath), JSON.stringify({ schemaVersion: 1, kind: 'ocr-efg-offline-fetch-proof',
    review: verified.link, receiptId: verified.review.receiptId, requestSha256: verified.review.requestSha256,
    responseEvidenceSha256: verified.review.responseEvidenceSha256, ...replay.stats, updatedAt: new Date().toISOString() }) + '\n')
  globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    try { return await replay.fetch(input, init) } finally { await persist() }
  }, { preconnect: replay.fetch.preconnect }) as typeof fetch
}
