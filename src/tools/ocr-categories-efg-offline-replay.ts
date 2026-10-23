import { AppValidationError, AppUsageError, AppInfrastructureError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { cp, mkdir, readdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'
import { runGrokOcr } from '~/cli/commands/text/ocr/ocr-services/grok-ocr/run-grok-ocr'
import { EFG_OFFLINE_ROOT, admitEfgOfflineReplayArtifact, readEfgOfflineResponseReview, verifyEfgOfflineResponseReview } from './ocr-categories-efg-offline-response'
import type { EfgOfflineResponseReview } from './ocr-categories-efg-offline-response'

const receiptId = '91f8c6cd-500d-4b0b-b933-90919ac8b081'
const stage = `${EFG_OFFLINE_ROOT}/offline-replay-work/${receiptId}`
const directory = `${EFG_OFFLINE_ROOT}/slots/efg-rerun-1-page-newspaper-page-01/grok-grok-4.7`
const reviewPath = `${EFG_OFFLINE_ROOT}/offline-response-reviews/${receiptId}.json`
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const json = async (path: string, value: unknown) => { await mkdir(dirname(path), { recursive: true }); await Bun.write(path, JSON.stringify(value, null, 2) + '\n') }
const inventory = async (root: string): Promise<Array<{ path: string, sha256: string }>> => {
  const result: Array<{ path: string, sha256: string }> = []
  for (const entry of (await readdir(root, { withFileTypes: true })).filter(entry => !entry.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = `${root}/${entry.name}`
    if (entry.isSymbolicLink()) throw new AppValidationError('Offline replay artifacts cannot contain symlinks')
    if (entry.isDirectory()) result.push(...await inventory(path))
    else if (entry.isFile() && entry.name !== 'dispatch.json') result.push({ path, sha256: hash(await Bun.file(path).bytes()) })
  }
  return result
}

const runNativeAdapterChild = async () => {
  if (process.env['AUTOSHOW_OCR_EFG_OFFLINE_REPLAY'] !== '1') throw new AppValidationError('Native adapter child requires the strict offline response preload')
  const path = process.env['AUTOSHOW_OCR_EFG_OFFLINE_REVIEW']!, sha256 = process.env['AUTOSHOW_OCR_EFG_OFFLINE_REVIEW_SHA256']!
  const verified = await readEfgOfflineResponseReview({ path, sha256 }), started = Date.now()
  const native = await runGrokOcr(verified.input, { format: 'png', fileSize: Bun.file(verified.input).size, slug: verified.review.documentCaseId, pageCount: 1 }, 'grok-4.7', { dpi: 300, outputDir: stage })
  if (native.pages.length !== 1 || native.pages[0]?.text !== verified.text || native.promptTokens !== verified.review.usage.inputTokens || native.completionTokens !== verified.review.usage.outputTokens) throw new AppValidationError('Native adapter decoding differs from saved text/usage')
  await json(`${stage}/native-adapter-result.json`, { native, offlineNativeAdapterProcessingTimeMs: Date.now() - started })
}

/** One isolated native adapter call receives the saved HTTP200 JSON; no CLI/profile/history pipeline runs. */
export const stageEfgOfflineReplay = async () => {
  const ledgerPath = `${EFG_OFFLINE_ROOT}/spending-ledger.json`, beforeLedger = await Bun.file(ledgerPath).bytes()
  const ledger = JSON.parse(new TextDecoder().decode(beforeLedger)), receipt = ledger.receipts.find((row: { id: string }) => row.id === receiptId)
  if (!receipt || receipt.status !== 'breach' || receipt.httpStatus !== 200) throw new AppValidationError('Expected original retained HTTP200 breach receipt')
  const planSha256 = hash(await Bun.file(`${EFG_OFFLINE_ROOT}/execution-plan.json`).bytes()), evidenceBytes = await Bun.file(receipt.responseEvidencePath).bytes()
  const review: EfgOfflineResponseReview = { schemaVersion: 1, kind: 'ocr-categories-efg-offline-response-review', action: 'accept-saved-response-for-offline-artifact-recovery-only', policy: 'efg-saved-grok-response-under-existing-total-reservation-v1',
    planSha256, receiptId, receiptCanonicalJsonSha256: hash(JSON.stringify(receipt)), caseId: 'efg-rerun-1-page-newspaper-page-01', documentCaseId: 'efg-rerun-1-page-newspaper', provider: 'grok', model: 'grok-4.7', requestSha256: receipt.requestSha256,
    inputSha256: receipt.inputSha256, responseEvidencePath: receipt.responseEvidencePath, responseEvidenceSha256: receipt.responseEvidenceSha256, retainedStatus: 'breach', reservedCents: receipt.reservedCents, chargedCents: receipt.chargedCents,
    usage: { inputTokens: 3717, visibleOutputTokens: 2896, reasoningOutputTokens: 33381, outputTokens: 36277, totalTokens: 39994 }, limits: { inputTokens: 64000, visibleOutputTokens: 4096, totalOutputTokens: 36864 }, conservativeUsageCents: 22.5096,
    content: { choiceIndex: 0, finishReason: 'stop', utf8Bytes: 12672, sha256: '2e5c053504241f19007c9b195503744a328901cacb45d1f1d38bb713efb2b4d6' }, allowsRedispatch: false, releasesCharge: false,
    reason: 'Reviewed complete saved Grok HTTP200 response: reasoning exceeded the unmeasured component assumption while total output and conservatively valued usage stayed inside the original retained reservation. Accept authentic text offline only; retain the entire breach charge and block new dispatch.', createdAt: new Date().toISOString() }
  verifyEfgOfflineResponseReview(review, receipt, evidenceBytes, planSha256)
  if (await Bun.file(`${stage}/stage-result.json`).exists()) throw new AppValidationError('Completed staging exists; preserve it and use --install')
  if (!await Bun.file(reviewPath).exists()) await json(reviewPath, review)
  const link = { path: reviewPath, sha256: hash(await Bun.file(reviewPath).bytes()) }, verified = await readEfgOfflineResponseReview(link)
  const journalBytes = await Bun.file(`${directory}/dispatch.json`).bytes(), original = JSON.parse(new TextDecoder().decode(journalBytes))
  if (original.status !== 'failed' || original.provider !== 'grok' || original.model !== 'grok-4.7') throw new AppValidationError('Original failed journal differs')
  await mkdir(stage, { recursive: true }); await Bun.write(`${stage}/original-failed-dispatch.json`, journalBytes)
  const proofPath = `${stage}/native-adapter-fetch-proof.json`, started = Date.now(), startedAt = new Date(started).toISOString()
  const child = Bun.spawn([process.execPath, 'src/tools/ocr-categories-efg-offline-replay.ts', '--adapter-child'], { cwd: PROJECT_ROOT, env: { ...process.env, XAI_API_KEY: 'offline-replay-not-a-provider-key', AUTOSHOW_PROJECT_ROOT: PROJECT_ROOT,
    AUTOSHOW_OCR_SPENDING_GUARD: undefined, AUTOSHOW_OCR_BC_GUARD: undefined, AUTOSHOW_OCR_D_GUARD: undefined, AUTOSHOW_OCR_EFG_GUARD: undefined,
    AUTOSHOW_OCR_EFG_OFFLINE_REPLAY: '1', AUTOSHOW_OCR_EFG_OFFLINE_REVIEW: link.path, AUTOSHOW_OCR_EFG_OFFLINE_REVIEW_SHA256: link.sha256, AUTOSHOW_OCR_EFG_OFFLINE_PROOF: proofPath }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const completed = Date.now(), completedAt = new Date(completed).toISOString(), wallTimeMs = completed - started
  await Bun.write(`${stage}/native-adapter.stdout.txt`, stdout); await Bun.write(`${stage}/native-adapter.stderr.txt`, stderr)
  if (exitCode !== 0) throw new AppInfrastructureError(`Offline native adapter failed; evidence preserved at ${stage}`)
  const { native, offlineNativeAdapterProcessingTimeMs } = await Bun.file(`${stage}/native-adapter-result.json`).json()
  const proof = await Bun.file(proofPath).json()
  if (proof.networkCalls !== 0 || proof.servedResponses !== 1 || proof.blockedRequests !== 0 || proof.requestSha256 !== receipt.requestSha256) throw new AppValidationError('Offline adapter replay proof differs')
  const adapterSources = await Promise.all(['src/cli/commands/text/ocr/ocr-services/grok-ocr/run-grok-ocr.ts', 'src/cli/commands/text/ocr/ocr-utils/chat-image-ocr.ts', 'src/cli/commands/text/ocr/ocr-utils/hosted-ocr-utils.ts', 'src/utils/openai/grok-chat-usage.ts'].map(async path => ({ path, sha256: hash(await Bun.file(path).bytes()) })))
  const runDir = `${stage}/native-adapter-run`, result = { text: native.pages.map((page: { pageNumber: number, text: string }) => `--- Page ${page.pageNumber} ---\n${page.text}`).join('\n\n'), pages: native.pages, totalPages: 1, ocrPages: 1, textPages: 0 }
  const metadata = { processingTime: verified.originalProviderProcessingTimeMs, totalPages: 1, ocrPages: 1, textPages: 0, promptTokens: native.promptTokens, completionTokens: native.completionTokens,
    offlineResponseRecovery: { review: link, sourceKind: 'offline-native-adapter-reconstruction', adapterSources, networkCalls: 0, originalTimingPolicy: verified.originalTimingPolicy, offlineReplayWallTimeMs: wallTimeMs, offlineNativeAdapterProcessingTimeMs } }
  await json(`${runDir}/result.json`, result); await Bun.write(`${runDir}/extraction.txt`, result.text + '\n')
  await json(`${runDir}/manifest.json`, { command: 'extract', scope: 'single', createdAt: completedAt, source: { kind: 'offline-native-adapter-reconstruction', review: link, originalFailedDispatchSha256: hash(journalBytes), adapterSources, newProviderCalls: 0 },
    items: [{ extractRoute: 'document', metadata: { source: { filePath: verified.input } }, providers: [{ service: 'grok', model: 'grok-4.7', status: 'succeeded', artifactDir: '.', options: {}, metadata, result }] }] })
  await json(`${stage}/stage-result.json`, { schemaVersion: 1, kind: 'ocr-efg-offline-native-adapter-stage', review: link, receiptId, runDir, startedAt, completedAt, wallTimeMs, networkCalls: 0, servedResponses: 1,
    originalProviderProcessingTimeMs: verified.originalProviderProcessingTimeMs, originalTimingPolicy: verified.originalTimingPolicy, offlineNativeAdapterProcessingTimeMs, adapterSources,
    resultSha256: hash(await Bun.file(`${runDir}/result.json`).bytes()), proof: { path: proofPath, sha256: hash(await Bun.file(proofPath).bytes()) } })
  if (hash(await Bun.file(ledgerPath).bytes()) !== hash(beforeLedger)) throw new AppValidationError('Offline replay must not mutate spending ledger')
  return { mode: 'offline-native-adapter-staged', stage, review: link, networkCalls: 0, recoveredTextBytes: verified.review.content.utf8Bytes, originalProviderProcessingTimeMs: verified.originalProviderProcessingTimeMs, offlineReplayWallTimeMs: wallTimeMs, offlineNativeAdapterProcessingTimeMs }
}

export const installEfgOfflineReplay = async () => {
  const ledgerPath = `${EFG_OFFLINE_ROOT}/spending-ledger.json`, beforeLedger = await Bun.file(ledgerPath).bytes(), staged = await Bun.file(`${stage}/stage-result.json`).json()
  const verified = await readEfgOfflineResponseReview(staged.review), originalBytes = await Bun.file(`${stage}/original-failed-dispatch.json`).bytes()
  const original = JSON.parse(new TextDecoder().decode(originalBytes)), archive = `${EFG_OFFLINE_ROOT}/prior-attempts/saved-response-review/${receiptId}/grok-grok-4.7`
  if (hash(await Bun.file(`${directory}/dispatch.json`).bytes()) !== hash(originalBytes) || await Bun.file(`${archive}/dispatch.json`).exists()) throw new AppValidationError('Canonical failed slot changed or preservation destination exists')
  for (const artifact of original.artifactHashes) if (hash(await Bun.file(artifact.path).bytes()) !== artifact.sha256) throw new AppValidationError('Original failure artifact changed')
  if (hash(await Bun.file(`${staged.runDir}/result.json`).bytes()) !== staged.resultSha256 || (await Bun.file(`${staged.runDir}/result.json`).json()).pages[0].text !== verified.text) throw new AppValidationError('Staged native result changed')
  await mkdir(dirname(archive), { recursive: true }); await rename(directory, archive)
  await cp(staged.runDir, directory, { recursive: true, errorOnExist: true, force: false })
  const journal = { ...original, status: 'succeeded', exitCode: 0, manifestSha256: hash(await Bun.file(`${directory}/manifest.json`).bytes()), offlineResponseReview: staged.review,
    offlineReplay: { startedAt: staged.startedAt, completedAt: staged.completedAt, wallTimeMs: staged.wallTimeMs, originalProviderProcessingTimeMs: verified.originalProviderProcessingTimeMs,
      networkCalls: 0, servedResponses: 1, proof: staged.proof, originalFailedDispatch: { path: `${archive}/dispatch.json`, sha256: hash(originalBytes) } }, artifactHashes: await inventory(directory) }
  await admitEfgOfflineReplayArtifact(journal, verified.text, verified.originalProviderProcessingTimeMs)
  await json(`${directory}/dispatch.json`, journal)
  const executionPath = `${EFG_OFFLINE_ROOT}/execution.json`, executionBytes = await Bun.file(executionPath).bytes(), execution = JSON.parse(new TextDecoder().decode(executionBytes))
  await Bun.write(`${stage}/execution-before-offline-install.json`, executionBytes)
  execution.slots = execution.slots.map((slot: { caseId: string, provider: string, model: string }) => slot.caseId === journal.caseId && slot.provider === journal.provider && slot.model === journal.model ? journal : slot)
  execution.successfulSlots = execution.slots.filter((slot: { status: string }) => slot.status === 'succeeded').length; execution.failedSlots = execution.slots.filter((slot: { status: string }) => slot.status === 'failed').length
  execution.status = 'completed-with-provider-failure'; execution.completedSlots = execution.slots.length; execution.pendingSlots = 0; execution.blockedReason = null
  execution.offlineResponseRecovery = { receiptId, review: staged.review, networkCalls: 0, retainedBreachBlocksFurtherProviderDispatch: true, newBillingReceipts: 0 }; execution.updatedAt = new Date().toISOString()
  if (execution.successfulSlots !== 398 || execution.failedSlots !== 1 || execution.completedSlots !== 399) throw new AppValidationError('Unexpected final EFG coverage')
  await json(executionPath, execution)
  if (hash(await Bun.file(ledgerPath).bytes()) !== hash(beforeLedger)) throw new AppValidationError('Offline installation must not mutate spending ledger')
  return { mode: 'offline-native-adapter-installed', directory, archive, review: staged.review, usableOutputs: 398, failedOutputs: 1, intendedOutputs: 399, networkCalls: 0 }
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2)
    if (args.length !== 1 || !['--stage', '--install', '--adapter-child'].includes(args[0]!)) throw new AppUsageError('Usage: bun src/tools/ocr-categories-efg-offline-replay.ts --stage|--install (saved-response processing only)')
    if (args[0] === '--adapter-child') await runNativeAdapterChild()
    else writeCommandPayload((JSON.stringify(args[0] === '--stage' ? await stageEfgOfflineReplay() : await installEfgOfflineReplay(), null, 2)) + '\n')
  } catch (error) { writeCommandPayload((error instanceof Error ? error.message : 'Offline reconstruction failed') + '\n', 'stderr'); process.exitCode = 1 }
}
