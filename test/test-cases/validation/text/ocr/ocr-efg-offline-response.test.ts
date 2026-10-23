import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { admitEfgOfflineReplayArtifact, createEfgOfflineGrokFetch, EFG_OFFLINE_ROOT as base, readEfgOfflineResponseReview, verifyEfgOfflineResponseReview } from '~/tools/ocr-categories-efg-offline-response'
import type { EfgOfflineResponseReview } from '~/tools/ocr-categories-efg-offline-response'
import { inspectEfgOcrReports } from '~/tools/ocr-categories-efg-report'
import { runGrokOcr } from '~/cli/commands/text/ocr/ocr-services/grok-ocr/run-grok-ocr'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const text = 'Privatefixture authentic saved response.'
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-offline-ocr-')); roots.push(root)
  const write = async (path: string, value: unknown): Promise<string | Uint8Array> => {
    const bytes = typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)
    await mkdir(dirname(join(root, path)), { recursive: true }); await Bun.write(join(root, path), bytes); return bytes
  }
  const id = 'efg-rerun-1-page-newspaper', pageId = `${id}-page-01`, input = `${base}/pages/input.png`, reference = `${base}/refs/reference.txt`, receiptId = 'offline-fixture-receipt'
  const body = { model: 'grok-4.7', max_completion_tokens: 4096, messages: [{ role: 'user', content: [{ type: 'text', text: [
    'Perform OCR on the provided page image.', 'Return only the text visible on the page.', 'Do not summarize, explain, or translate.', 'Preserve the visible reading order.',
    'Preserve paragraph breaks and line breaks when they are meaningful.', 'If the page is blank or unreadable, return an empty string.' ].join(' ') },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${Buffer.from(redDotPng).toString('base64')}` } }] }] }
  const page = { id: pageId, caseId: id, pageNumber: 1, input, inputSha256: hash(redDotPng), width: 1, height: 1 }
  const referenceText = `--- Page 1 ---\n${text}\n`
  const entry = { id, category: 'newspapers', input, inputSha256: page.inputSha256, reference, referenceSha256: hash(referenceText), referenceKind: 'existing-consensus', sourceURL: 'https://example.org/original', sourceRevision: 'original-fixture', runDir: `docs/benchmarks/ocr/${id}`, pages: [page] }
  const plan = { schemaVersion: 1, kind: 'ocr-categories-efg-execution-plan', approval: { status: 'approved', budgetCents: 3000, evidence: 'User approved up to $30 for categories 5–7' }, cases: [entry], pages: [page], targets: [{ provider: 'grok', model: 'grok-4.7' }, { provider: 'tesseract', model: 'tesseract' }] }
  const planBytes = String(await write(`${base}/execution-plan.json`, plan)), planSha256 = hash(planBytes)
  await write(input, redDotPng); await write(reference, referenceText)
  const evidencePath = `${base}/provider-response-evidence/${receiptId}.json`, response = { model: 'grok-4.7', choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: text, refusal: null } }],
    usage: { prompt_tokens: 3717, completion_tokens: 2896, total_tokens: 39994, completion_tokens_details: { reasoning_tokens: 33381 } } }
  const evidence = { schemaVersion: 1, receiptId, pageId, documentCaseId: id, provider: 'grok', model: 'grok-4.7', serialization: 'Parsed provider JSON serialized locally; not original response bytes.', response }
  const evidenceBytes = new TextEncoder().encode(String(await write(evidencePath, evidence)))
  const receipt = { id: receiptId, invocationId: 'original-paid-invocation', caseId: pageId, documentCaseId: id, provider: 'grok', model: 'grok-4.7', requestSha256: hash(JSON.stringify(body)), inputSha256: page.inputSha256,
    reservedCents: 34.9184, chargedCents: 34.9184, status: 'breach', httpStatus: 200, costBasis: 'conservative-upper-bound', responseEvidencePath: evidencePath, responseEvidenceSha256: hash(evidenceBytes),
    inputTokens: 3717, outputTokens: 36277, visibleOutputTokens: 2896, reasoningOutputTokens: 33381, createdAt: '2026-10-23T12:00:00.000Z', completedAt: '2026-10-23T12:06:05.858Z' }
  const ledger = { schemaVersion: 1, kind: 'ocr-categories-efg-spending-ledger', budgetCents: 3000, planSha256, receipts: [receipt] }
  await write(`${base}/spending-ledger.json`, ledger)
  const review: EfgOfflineResponseReview = { schemaVersion: 1, kind: 'ocr-categories-efg-offline-response-review', action: 'accept-saved-response-for-offline-artifact-recovery-only', policy: 'efg-saved-grok-response-under-existing-total-reservation-v1',
    planSha256, receiptId, receiptCanonicalJsonSha256: hash(JSON.stringify(receipt)), caseId: pageId, documentCaseId: id, provider: 'grok', model: 'grok-4.7', requestSha256: receipt.requestSha256, inputSha256: receipt.inputSha256,
    responseEvidencePath: evidencePath, responseEvidenceSha256: receipt.responseEvidenceSha256, retainedStatus: 'breach', reservedCents: 34.9184, chargedCents: 34.9184,
    usage: { inputTokens: 3717, outputTokens: 36277, visibleOutputTokens: 2896, reasoningOutputTokens: 33381, totalTokens: 39994 }, limits: { inputTokens: 64000, visibleOutputTokens: 4096, totalOutputTokens: 36864 }, conservativeUsageCents: 22.5096,
    content: { choiceIndex: 0, finishReason: 'stop', utf8Bytes: Buffer.byteLength(text), sha256: hash(text) }, allowsRedispatch: false, releasesCharge: false, reason: 'Synthetic manual review; no new dispatch or release.', createdAt: '2026-10-23T12:07:00.000Z' }
  const path = `${base}/offline-response-reviews/${receiptId}.json`, link = { path, sha256: hash(String(await write(path, review))) }
  const directory = `${base}/slots/${pageId}/grok-grok-4.7`, archive = `${base}/prior-attempts/saved-response-review/${receiptId}/grok-grok-4.7/dispatch.json`
  const original = { caseId: pageId, documentCaseId: id, provider: 'grok', model: 'grok-4.7', inputSha256: page.inputSha256, referenceSha256: entry.referenceSha256,
    directory, status: 'failed', startedAt: '2026-10-23T11:59:59.000Z', completedAt: '2026-10-23T12:06:06.000Z' }
  const originalLink = { path: archive, sha256: hash(String(await write(archive, original))) }
  const proofPath = `${base}/offline-replay-work/${receiptId}/proof.json`, proof = { schemaVersion: 1, kind: 'ocr-efg-offline-fetch-proof', review: link, receiptId,
    requestSha256: receipt.requestSha256, responseEvidenceSha256: receipt.responseEvidenceSha256, servedResponses: 1, blockedRequests: 0, networkCalls: 0 }
  const proofLink = { path: proofPath, sha256: hash(String(await write(proofPath, proof))) }
  const result = { text, pages: [{ pageNumber: 1, method: 'ocr', text }], totalPages: 1 }
  const manifest = { command: 'extract', scope: 'single', source: { kind: 'offline-native-adapter-reconstruction' }, items: [{ extractRoute: 'document', metadata: { source: { filePath: input } }, providers: [{ service: 'grok', model: 'grok-4.7', status: 'succeeded', artifactDir: '.', metadata: { processingTime: 365858 }, result }] }] }
  const journal = { ...original, status: 'succeeded', manifestSha256: hash(String(await write(`${directory}/manifest.json`, manifest))), offlineResponseReview: link,
    offlineReplay: { startedAt: '2026-10-23T12:07:01.000Z', completedAt: '2026-10-23T12:07:01.050Z', wallTimeMs: 50, originalProviderProcessingTimeMs: 365858, networkCalls: 0, servedResponses: 1, proof: proofLink, originalFailedDispatch: originalLink } }
  await write(`${directory}/result.json`, result); await write(`${directory}/dispatch.json`, journal)
  const localDir = `${base}/slots/${pageId}/tesseract-tesseract`
  const localManifest = { ...manifest, items: [{ ...manifest.items[0]!, providers: [{ ...manifest.items[0]!.providers[0]!, service: 'tesseract', model: 'tesseract' }] }] }
  await write(`${localDir}/dispatch.json`, { ...original, provider: 'tesseract', model: 'tesseract', directory: localDir, status: 'succeeded', manifestSha256: hash(String(await write(`${localDir}/manifest.json`, localManifest))) })
  return { root, write, body, planSha256, receipt, review, evidence, evidenceBytes, link, journal, proof, proofPath, directory, ledger }
}

describe('reviewed saved Grok response admission', () => {
  test('actual native adapter decodes authentic response with one-use offline fetch, unchanged usage and no receipt mutation', async () => {
    const f = await fixture(), before = await Bun.file(join(f.root, `${base}/spending-ledger.json`)).text(), verified = await readEfgOfflineResponseReview(f.link, f.root)
    const offline = createEfgOfflineGrokFetch(verified), priorFetch = globalThis.fetch, priorKey = process.env['XAI_API_KEY']
    try {
      globalThis.fetch = offline.fetch; process.env['XAI_API_KEY'] = 'nonbillable-offline-key'
      const native = await runGrokOcr(join(f.root, `${base}/pages/input.png`), { format: 'png', slug: 'fixture', pageCount: 1, fileSize: redDotPng.length }, 'grok-4.7', { dpi: 300, outputDir: f.root })
      expect(native.pages[0]?.text).toBe(text); expect(native.promptTokens).toBe(3717); expect(native.completionTokens).toBe(36277)
      expect(offline.stats).toEqual({ servedResponses: 1, blockedRequests: 0, networkCalls: 0 })
      await expect(offline.fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', body: JSON.stringify(f.body) })).rejects.toThrow('repeated')
      expect(await Bun.file(join(f.root, `${base}/spending-ledger.json`)).text()).toBe(before)
    } finally { globalThis.fetch = priorFetch; if (priorKey === undefined) delete process.env['XAI_API_KEY']; else process.env['XAI_API_KEY'] = priorKey }
  })
  test('different endpoint, body, source or cancelled request never invokes any network fallback', async () => {
    const f = await fixture(), verified = verifyEfgOfflineResponseReview(f.review, f.receipt, f.evidenceBytes, f.planSha256)
    const swapped = structuredClone(f.body); swapped.messages[0]!.content[1]!.image_url!.url = 'data:image/png;base64,Y2hhbmdlZA=='
    for (const [url, body] of [['https://api.x.ai/v1/chat/completions?extra=1', f.body], ['https://api.x.ai/v1/chat/completions', { ...f.body, max_completion_tokens: 8192 }], ['https://api.x.ai/v1/chat/completions', swapped]]) {
      const offline = createEfgOfflineGrokFetch(verified)
      await expect(offline.fetch(String(url), { method: 'POST', body: JSON.stringify(body) })).rejects.toThrow('blocked')
      expect(offline.stats.servedResponses).toBe(0); expect(offline.stats.networkCalls).toBe(0)
    }
    const cancelled = createEfgOfflineGrokFetch(verified)
    await expect(cancelled.fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', body: JSON.stringify(f.body), signal: AbortSignal.abort() })).rejects.toThrow('cancelled')
    expect(cancelled.stats.servedResponses).toBe(0)
  })
  test('changed receipts, text, evidence, missing usage, refusal, length stop or expanded limits cannot be salvaged', async () => {
    const f = await fixture()
    for (const patch of [{ chargedCents: 0 }, { status: 'settled' }, { httpStatus: 503 }, { requestSha256: 'a'.repeat(64) }]) expect(() => verifyEfgOfflineResponseReview(f.review, { ...f.receipt, ...patch }, f.evidenceBytes, f.planSha256)).toThrow()
    for (const patch of [{ allowsRedispatch: true }, { releasesCharge: true }, { conservativeUsageCents: 0 }, { content: { ...f.review.content, sha256: 'a'.repeat(64) } },
      { usage: { ...f.review.usage, totalTokens: 1 } }, { limits: { ...f.review.limits, totalOutputTokens: 999999 } }]) expect(() => verifyEfgOfflineResponseReview({ ...f.review, ...patch }, f.receipt, f.evidenceBytes, f.planSha256)).toThrow()
    for (const responsePatch of [{ choices: [{ finish_reason: 'length', message: { role: 'assistant', content: text } }] }, { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: text, refusal: 'refused' } }] }, { usage: {} }]) {
      const bytes = new TextEncoder().encode(JSON.stringify({ ...f.evidence, response: { ...f.evidence.response, ...responsePatch } }))
      const receipt = { ...f.receipt, responseEvidenceSha256: hash(bytes) }, review = { ...f.review, responseEvidenceSha256: hash(bytes), receiptCanonicalJsonSha256: hash(JSON.stringify(receipt)) }
      expect(() => verifyEfgOfflineResponseReview(review, receipt, bytes, f.planSha256)).toThrow()
    }
  })
  test('report admission retains original timing and charges the breach once; fabricated text/proof/timing is rejected', async () => {
    const f = await fixture(), before = await Bun.file(join(f.root, `${base}/spending-ledger.json`)).text()
    expect(await admitEfgOfflineReplayArtifact(f.journal, text, 365858, f.root)).toMatchObject({ retainedReceiptStatus: 'breach', retainedChargeCents: 34.9184, offlineReplayWallTimeMs: 50, originalProviderProcessingTimeMs: 365858, networkCalls: 0 })
    const inspected = await inspectEfgOcrReports({ projectRoot: f.root })
    expect(inspected.cases[0]).toMatchObject({ successfulModels: 2, failedModels: 0 })
    expect(inspected.spending).toMatchObject({ requestCount: 1, heldReservationCents: 34.9184, settledAccountedCents: 0, accountedCents: 34.9184 })
    await expect(admitEfgOfflineReplayArtifact(f.journal, 'fabricated', 365858, f.root)).rejects.toThrow('text')
    await expect(admitEfgOfflineReplayArtifact(f.journal, text, 50, f.root)).rejects.toThrow('timing')
    await f.write(f.proofPath, { ...f.proof, networkCalls: 1 })
    await expect(admitEfgOfflineReplayArtifact(f.journal, text, 365858, f.root)).rejects.toThrow('checksum')
    expect(await Bun.file(join(f.root, `${base}/spending-ledger.json`)).text()).toBe(before)
  })
  test('symlinked review or evidence outside its private prefix is rejected despite matching bytes', async () => {
    const f = await fixture(), outside = 'docs/review-copy.json'
    await f.write(outside, await Bun.file(join(f.root, f.link.path)).text())
    await rm(join(f.root, f.link.path)); await symlink(join(f.root, outside), join(f.root, f.link.path))
    await expect(readEfgOfflineResponseReview(f.link, f.root)).rejects.toThrow('private directory')
  })
})
