import { inspectGeminiSynthesisVoices } from './gemini-voice-availability'
import { mkdir, rename, open } from 'node:fs/promises'
import { join } from 'node:path'
import type { GeminiBatchSlot, GeminiProviderJob, GeminiProviderJobRun } from '~/types/tts-workflow/gemini-provider-job-types'
import { geminiJsonRequest, geminiFetch, geminiUploadFile } from '~/utils/gemini/gemini-rest'
import { hashCanonicalTtsValue, sha256Bytes } from '../../script-to-audio/contract-identity'
import { decodeGeminiGenerateContent, geminiObject, validateGeminiWav } from './gemini-tts-audio'
import { reconcileGeminiTtsUsage } from './gemini-tts-pricing'
import { UsageError } from '~/utils/error-handler'
import { providerAccountScopeHash } from '../../script-to-audio/advanced-provider-contracts'

export const GEMINI_JOB_FILE = 'gemini-provider-jobs.json'
const INLINE_LIMIT = 20_000_000
const PARTITION_LIMIT = 128_000_000 // bounded local JSONL partitions, below Google's 2 GB ceiling
export const persistGeminiJobs = async (root: string, run: GeminiProviderJobRun): Promise<void> => {
  const path = join(root, GEMINI_JOB_FILE), temp = `${path}.${crypto.randomUUID()}.tmp`
  const handle = await open(temp, 'wx', 0o600)
  try { await handle.writeFile(JSON.stringify(run, null, 2) + '\n'); await handle.sync() } finally { await handle.close() }
  await rename(temp, path)
}
export const partitionGeminiJobs = (slots: readonly GeminiBatchSlot[], limit = PARTITION_LIMIT): GeminiProviderJob[] => {
  const jobs: GeminiProviderJob[] = []
  for (const model of [...new Set(slots.map(s => s.model))]) {
    let group: GeminiBatchSlot[] = [], size = 0
    const flush = () => { if (!group.length) return; jobs.push({ schemaVersion: 1, model, keys: group.map(s => s.key), requestFingerprint: hashCanonicalTtsValue(group.map(s => [s.key, s.requestFingerprint])), state: 'prepared' }); group = []; size = 0 }
    for (const slot of slots.filter(s => s.model === model)) {
      const bytes = Buffer.byteLength(JSON.stringify({ key: slot.key, request: slot.request })) + 1
      if (bytes > limit) throw UsageError('Gemini batch item exceeds the local payload limit.')
      if (size + bytes > limit) flush()
      group.push(slot); size += bytes
    }
    flush()
  }
  return jobs
}
const safeJobId = (value: unknown): string => {
  if (typeof value !== 'string' || !/^batches\/[A-Za-z0-9_-]+$/.test(value)) throw UsageError('Gemini returned an invalid batch job ID.')
  return value
}
const safeFileId = (value: unknown): string => {
  if (typeof value !== 'string' || !/^files\/[A-Za-z0-9_-]+$/.test(value)) throw UsageError('Gemini returned an invalid result file ID.')
  return value
}
export const submitGeminiJobs = async (root: string, run: GeminiProviderJobRun, apiKey: string, signal?: AbortSignal): Promise<void> => {
  if (run.accountScopeHash !== providerAccountScopeHash('gemini', apiKey)) throw UsageError('Gemini batch credentials do not match the submitting account.')
  for (const job of run.jobs) {
    signal?.throwIfAborted()
    if (job.jobId || ['completed', 'failed', 'cancelled', 'expired'].includes(job.state)) continue
    if (job.state === 'submitting') throw UsageError('Gemini batch submission is ambiguous; reconcile the provider job ID before redispatch. No new job was submitted.')
    if (job.state === 'uploading' && !job.uploadHandle) throw UsageError('Gemini batch upload was interrupted; reconcile its upload handle before submission.')
    const slots = job.keys.map(key => run.slots.find(slot => slot.key === key)!)
    const voices = slots.flatMap(slot => {
      const speech = geminiObject(geminiObject(slot.request)['generationConfig'])['speechConfig']
      const config = geminiObject(speech)
      if (config['voiceConfig']) return [String(geminiObject(config['voiceConfig'])['voice'])]
      const speakers = geminiObject(config['multiSpeakerVoiceConfig'])['speakerVoiceConfigs']
      if (!Array.isArray(speakers)) throw UsageError('Invalid Gemini Batch speaker configuration.')
      return speakers.map(speaker => String(geminiObject(geminiObject(geminiObject(speaker)['voiceConfig'])['prebuiltVoiceConfig'])['voiceName']))
    })
    // A prepared job can be resumed much later than its original local preflight.
    await inspectGeminiSynthesisVoices(apiKey, job.model, voices)
    const inline = { requests: { requests: slots.map(slot => ({ request: slot.request, metadata: { key: slot.key } })) } }
    let input: unknown = inline
    // Limit the potential inline response as well as input bytes. File results stream by item.
    const maximumReplyBytes = slots.length * (16384 / 25 * 48000 + 44) * 4 / 3
    if (Buffer.byteLength(JSON.stringify(inline)) + 1024 >= INLINE_LIMIT || maximumReplyBytes > 256 * 1024 * 1024) {
      if (!job.uploadHandle) {
        job.state = 'uploading'; await persistGeminiJobs(root, run)
        const filePath = join(root, `batch-input-${job.requestFingerprint}.jsonl`)
        await Bun.write(filePath, slots.map(slot => JSON.stringify({ key: slot.key, request: slot.request })).join('\n') + '\n')
        const file = await geminiUploadFile(apiKey, filePath, { mimeType: 'application/jsonl', displayName: `autoshow-${job.requestFingerprint}`, abortSignal: signal })
        job.uploadHandle = safeFileId(file.name); job.state = 'prepared'; await persistGeminiJobs(root, run)
      }
      input = { fileName: job.uploadHandle }
    }
    job.state = 'submitting'; await persistGeminiJobs(root, run)
    const response = geminiObject((await geminiJsonRequest(apiKey, `models/${job.model}:batchGenerateContent`, { method: 'POST', body: { batch: { displayName: `autoshow-${job.requestFingerprint}`, inputConfig: input } }, abortSignal: signal })).json)
    job.jobId = safeJobId(response['name']); job.state = 'pending'; await persistGeminiJobs(root, run)
  }
}
export const validateRetained = async (root: string, slot: GeminiBatchSlot): Promise<boolean> => {
  if (!slot.audioPath || !slot.audioSha256) return false
  if (!/^gemini-audio\/[a-f0-9]{64}\.wav$/.test(slot.audioPath)) throw UsageError('Gemini slot audio path escaped the retained-artifact directory.')
  try { const bytes = Buffer.from(await Bun.file(join(root, slot.audioPath)).arrayBuffer()); validateGeminiWav(bytes); return sha256Bytes(bytes) === slot.audioSha256 } catch { return false }
}
export const collectGeminiJobResults = async (root: string, run: GeminiProviderJobRun, job: GeminiProviderJob, rows: AsyncIterable<unknown> | Iterable<unknown>): Promise<void> => {
  const seen = new Set<string>()
  await mkdir(join(root, 'gemini-audio'), { recursive: true })
  for await (const value of rows) {
    const row = geminiObject(value), metadata = row['metadata'] ? geminiObject(row['metadata']) : {}
    const key = row['key'] ?? metadata['key']
    if (typeof key !== 'string' || !job.keys.includes(key) || seen.has(key)) throw UsageError('Gemini batch results contain a missing, unknown, or duplicate request key.')
    seen.add(key)
    const slot = run.slots.find(slot => slot.key === key)!
    if (await validateRetained(root, slot)) continue
    if (row['error']) { slot.error = 'provider-item-error'; await persistGeminiJobs(root, run); continue }
    try {
      const bytes = decodeGeminiGenerateContent(row['response'])
      const path = `gemini-audio/${key}.wav`, temp = join(root, `${path}.download`)
      await Bun.write(temp, bytes); await rename(temp, join(root, path))
      slot.audioPath = path; slot.audioSha256 = sha256Bytes(bytes); delete slot.error
      slot.usage = reconcileGeminiTtsUsage(slot.model, 'batch', geminiObject(row['response'])['usageMetadata'], new Date(run.createdAt))
    } catch { slot.error = 'invalid-or-incomplete-audio' }
    await persistGeminiJobs(root, run)
  }
  for (const key of job.keys) {
    const slot = run.slots.find(slot => slot.key === key)!
    if (!seen.has(key) && !await validateRetained(root, slot)) slot.error = 'missing-result'
  }
  await persistGeminiJobs(root, run)
}
const downloadRows = async function* (response: Response): AsyncGenerator<unknown> {
  if (!response.body) throw UsageError('Gemini result download is empty.')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let pending = '', total = 0
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break
      total += next.value.length
      if (total > 2_000_000_000) throw UsageError('Gemini result download exceeds 2 GB.')
      pending += decoder.decode(next.value, { stream: true })
      let index: number
      while ((index = pending.indexOf('\n')) >= 0) { const line = pending.slice(0, index).trim(); pending = pending.slice(index + 1); if (line) yield JSON.parse(line) }
      if (pending.length > 90_000_000) throw UsageError('Gemini result line exceeds the audio payload bound.')
    }
    pending += decoder.decode(); if (pending.trim()) yield JSON.parse(pending)
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
// A request fingerprint is also the remote display name. Recover an acknowledged
// job after a client crash by listing operations before considering redispatch.
export const recoverGeminiSubmissions = async (root: string, run: GeminiProviderJobRun, apiKey: string, allowAmbiguousRedispatch = false, signal?: AbortSignal): Promise<void> => {
  if (run.accountScopeHash !== providerAccountScopeHash('gemini', apiKey)) throw UsageError('Gemini batch credentials do not match the submitting account.')
  for (const job of run.jobs.filter(job => !job.jobId && job.state === 'submitting')) {
    const matches: string[] = []; let pageToken = ''
    const pages = new Set<string>()
    do {
      if (pages.has(pageToken) || pages.size >= 100) throw UsageError('Gemini job reconciliation exceeded its bounded pagination limit.')
      pages.add(pageToken)
      const payload = geminiObject((await geminiJsonRequest(apiKey, 'batches?pageSize=100' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''), { method: 'GET', abortSignal: signal })).json)
      const operations = payload['operations'] ?? []
      if (!Array.isArray(operations)) throw UsageError('Gemini job reconciliation returned invalid operations.')
      for (const value of operations) {
        const operation = geminiObject(value), metadata = operation['metadata'] ? geminiObject(operation['metadata']) : {}
        if (metadata['displayName'] === 'autoshow-' + job.requestFingerprint || metadata['display_name'] === 'autoshow-' + job.requestFingerprint) matches.push(safeJobId(operation['name']))
      }
      pageToken = typeof payload['nextPageToken'] === 'string' ? payload['nextPageToken'] : ''
    } while (pageToken)
    if (matches.length > 1) throw UsageError('Multiple Gemini jobs match this submission; reconcile the job ID manually before collection.')
    if (matches[0]) { job.jobId = matches[0]; job.state = 'pending'; await persistGeminiJobs(root, run) }
    else if (allowAmbiguousRedispatch) { job.state = 'prepared'; await persistGeminiJobs(root, run) }
    else throw UsageError('Gemini batch submission remains ambiguous; automatic redispatch is blocked pending reconciliation. --allow-ambiguous-redispatch can purchase these missing slots again.')
  }
  for (const job of run.jobs.filter(job => !job.jobId && job.state === 'uploading' && !job.uploadHandle)) {
    if (!allowAmbiguousRedispatch) throw UsageError('Gemini upload remains ambiguous; retain this run and reconcile the upload handle, or explicitly allow ambiguous redispatch.')
    job.state = 'prepared'; await persistGeminiJobs(root, run)
  }
}
export const reconcileGeminiJobs = async (root: string, run: GeminiProviderJobRun, apiKey: string, action: 'status' | 'wait' | 'cancel', waitSeconds: number, signal?: AbortSignal): Promise<void> => {
  if (run.accountScopeHash !== providerAccountScopeHash('gemini', apiKey)) throw UsageError('Gemini batch credentials do not match the submitting account.')
  const deadline = Date.now() + waitSeconds * 1000
  let delay = 1000
  do {
    for (const job of run.jobs) {
      signal?.throwIfAborted()
      if (!job.jobId) {
        if (action === 'cancel' && job.state === 'prepared') { job.state = 'cancelled'; for (const key of job.keys) run.slots.find(slot => slot.key === key)!.error = 'cancelled-before-submission'; await persistGeminiJobs(root, run) }
        continue
      }
      safeJobId(job.jobId)
      if (job.state !== 'pending' && (await Promise.all(job.keys.map(key => validateRetained(root, run.slots.find(slot => slot.key === key)!)))).every(Boolean)) continue
      if (action === 'cancel' && !job.cancellationRequested && job.state === 'pending') {
        job.cancellationRequested = true; await persistGeminiJobs(root, run)
        try { await geminiJsonRequest(apiKey, `${job.jobId}:cancel`, { method: 'POST', body: {}, abortSignal: signal }) } catch (error) { job.cancellationRequested = false; await persistGeminiJobs(root, run); throw error }
      }
      const response = geminiObject((await geminiJsonRequest(apiKey, job.jobId, { method: 'GET', abortSignal: signal })).json)
      const metadata = response['metadata'] ? geminiObject(response['metadata']) : {}
      const providerError = response['error'] ? geminiObject(response['error']) : undefined
      const state = String(response['state'] ?? metadata['state'] ?? (response['done'] === true ? providerError ? providerError['code'] === 1 ? 'BATCH_STATE_CANCELLED' : 'BATCH_STATE_FAILED' : 'BATCH_STATE_SUCCEEDED' : '')).replace(/^JOB_STATE_/, 'BATCH_STATE_')
      if (!['BATCH_STATE_PENDING', 'BATCH_STATE_RUNNING', 'BATCH_STATE_SUCCEEDED', 'BATCH_STATE_CANCELLED', 'BATCH_STATE_EXPIRED', 'BATCH_STATE_FAILED'].includes(state)) throw UsageError('Gemini returned an unrecognized batch state; the job has been preserved.')
      job.providerState = state
      job.state = state === 'BATCH_STATE_SUCCEEDED' ? 'completed' : state === 'BATCH_STATE_CANCELLED' ? 'cancelled' : state === 'BATCH_STATE_EXPIRED' ? 'expired' : state === 'BATCH_STATE_FAILED' ? 'failed' : 'pending'
      await persistGeminiJobs(root, run)
      // REST long-running operation response and SDK-shaped destinations are distinct envelopes.
      const result = response['response'] ? geminiObject(response['response']) : response
      const dest = result['output'] ? geminiObject(result['output']) : metadata['output'] ? geminiObject(metadata['output']) : result['dest'] ? geminiObject(result['dest']) : result
      const inline = dest['inlinedResponses'] ?? dest['inlined_responses']
      const inlined = Array.isArray(inline) ? inline : inline && typeof inline === 'object' ? geminiObject(inline)['inlinedResponses'] : undefined
      if (Array.isArray(inlined)) await collectGeminiJobResults(root, run, job, inlined)
      const file = dest['fileName'] ?? dest['responsesFile'] ?? dest['responses_file']
      if (file) {
        job.resultFile = safeFileId(file); await persistGeminiJobs(root, run)
        const download = await geminiFetch(`https://generativelanguage.googleapis.com/download/v1beta/${job.resultFile}:download?alt=media`, { method: 'GET', headers: { 'x-goog-api-key': apiKey }, ...(signal ? { signal } : {}) })
        await collectGeminiJobResults(root, run, job, downloadRows(download))
      }
      if (job.state !== 'pending' && !inlined && !file) for (const key of job.keys) { const slot = run.slots.find(s => s.key === key)!; if (!await validateRetained(root, slot)) slot.error = 'missing-result' }
      await persistGeminiJobs(root, run)
    }
    if (action !== 'wait' || run.jobs.every(job => !['pending', 'prepared', 'submitting', 'uploading'].includes(job.state)) || Date.now() >= deadline) return
    await new Promise<void>((resolve, reject) => { const finish = () => { signal?.removeEventListener('abort', abort); resolve() }; const timer = setTimeout(finish, Math.min(delay, Math.max(0, deadline - Date.now()))); const abort = () => { clearTimeout(timer); reject(signal?.reason) }; signal?.addEventListener('abort', abort, { once: true }) })
    delay = Math.min(delay * 2, 30000)
  } while (Date.now() < deadline)
}
