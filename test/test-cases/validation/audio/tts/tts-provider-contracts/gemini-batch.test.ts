import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { collectGeminiJobResults, partitionGeminiJobs, persistGeminiJobs, reconcileGeminiJobs, recoverGeminiSubmissions, submitGeminiJobs, GEMINI_JOB_FILE } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-batch-jobs'
import { resumeGeminiRemoteBatch, geminiBatchManifest } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-batch-workflow'
import { hashCanonicalTtsValue } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { providerAccountScopeHash } from '~/cli/commands/audio/tts/script-to-audio/advanced-provider-contracts'
import { writeManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import type { GeminiProviderJobRun } from '~/types/tts-workflow/gemini-provider-job-types'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import { FLASH, LITE, batchAudio, wav } from './gemini-fixtures'
const { makeTempDir } = setupTtsContractLifecycle()
const key = 'batch-fixture-key'
const makeRun = (models: string[] = [LITE, LITE]): GeminiProviderJobRun => {
  const slots = models.map((model, index) => {
    const request = { contents: [{ role: 'user', parts: [{ text: `Sentence ${index}.`, speech_metadata: { speaker: 'Narrator' } }] }], generationConfig: { responseModalities: ['AUDIO'], maxOutputTokens: 16384, speechConfig: { voiceConfig: { voice: 'Kore' } } } }
    return { key: hashCanonicalTtsValue(index), itemIndex: 0, model, generationSlotId: `slot-${index}`, request, requestFingerprint: hashCanonicalTtsValue({ model, request }) }
  })
  return { schemaVersion: 1, kind: 'gemini-tts-provider-jobs', accountScopeHash: providerAccountScopeHash('gemini', key), createdAt: '2026-09-24T00:00:00Z', items: [{ input: 'input/examples/text.txt', stem: 'fixture' }], slots, jobs: partitionGeminiJobs(slots), delivery: {}, outputs: [] }
}
const load = (root: string) => Bun.file(join(root, GEMINI_JOB_FILE)).json() as Promise<GeminiProviderJobRun>

test('Batch submission persists an ambiguous marker before POST and partitions by model', async () => {
  const root = await makeTempDir('gemini-batch-submit-'), run = makeRun([FLASH, LITE])
  const calls = installMockFetch(async call => {
    const disk = await load(root)
    const job = disk.jobs.find(job => call.url.includes(job.model))!
    expect(job.state).toBe('submitting')
    expect(call.bodyJson).toMatchObject({ batch: { displayName: `autoshow-${job.requestFingerprint}`, inputConfig: { requests: { requests: [{ metadata: { key: job.keys[0] }, request: { generationConfig: { responseModalities: ['AUDIO'] } } }] } } } })
    expect(JSON.stringify(call.bodyJson)).not.toContain('response_format')
    return jsonResponse({ name: `batches/job-${disk.jobs.indexOf(job)}`, metadata: { state: 'BATCH_STATE_PENDING' } })
  })
  await submitGeminiJobs(root, run, key)
  expect(calls).toHaveLength(2)
  await submitGeminiJobs(root, await load(root), key)
  expect(calls).toHaveLength(2)
})

test('lost submission response is reconciled by fingerprint, without a second POST', async () => {
  const root = await makeTempDir('gemini-batch-ambiguous-'), run = makeRun()
  let admit = true
  const calls = installMockFetch(call => {
    if (call.method === 'POST') { if (admit) { admit = false; throw Error('Connection lost after admission') }; throw Error('Duplicate submission') }
    return jsonResponse({ operations: [{ name: 'batches/recovered', metadata: { displayName: `autoshow-${run.jobs[0]!.requestFingerprint}`, state: 'BATCH_STATE_RUNNING' } }] })
  })
  await expect(submitGeminiJobs(root, run, key)).rejects.toThrow()
  const restored = await load(root)
  expect(restored.jobs[0]?.state).toBe('submitting')
  await expect(submitGeminiJobs(root, restored, key)).rejects.toThrow('ambiguous')
  await recoverGeminiSubmissions(root, restored, key)
  await submitGeminiJobs(root, restored, key)
  expect(restored.jobs[0]?.jobId).toBe('batches/recovered')
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('unresolved ambiguity blocks redispatch and unknown accounts cannot retrieve jobs', async () => {
  const root = await makeTempDir('gemini-batch-unresolved-'), run = makeRun()
  run.jobs[0]!.state = 'submitting'
  const calls = installMockFetch(() => jsonResponse({}))
  await expect(recoverGeminiSubmissions(root, run, key)).rejects.toThrow('blocked pending reconciliation')
  await expect(reconcileGeminiJobs(root, run, 'different-key', 'status', 0)).rejects.toThrow('account')
  expect(calls).toHaveLength(1)
})

test('out-of-order inline results bind by key, reconcile usage, and repeated resume reuses audio', async () => {
  const root = await makeTempDir('gemini-batch-inline-'), run = makeRun()
  run.jobs[0]!.jobId = 'batches/inline'; run.jobs[0]!.state = 'pending'
  const calls = installMockFetch(() => jsonResponse({ name: 'batches/inline', done: true, metadata: { state: 'BATCH_STATE_SUCCEEDED' }, response: { inlinedResponses: { inlinedResponses: [...run.slots].reverse().map(slot => ({ metadata: { key: slot.key }, response: batchAudio() })) } } }))
  await reconcileGeminiJobs(root, run, key, 'wait', 0)
  expect(run.slots.every(slot => slot.audioSha256 && slot.usage?.observedAudioTokens === 8)).toBe(true)
  for (const slot of run.slots) expect(Buffer.from(await Bun.file(join(root, slot.audioPath!)).arrayBuffer())).toEqual(Buffer.from(wav))
  await reconcileGeminiJobs(root, await load(root), key, 'wait', 0)
  expect(calls).toHaveLength(1)
})

test('partial failure retains successes, missing items and corrupt audio remain incomplete', async () => {
  const root = await makeTempDir('gemini-batch-partial-'), run = makeRun([LITE, LITE, LITE, LITE])
  await collectGeminiJobResults(root, run, run.jobs[0]!, [
    { key: run.slots[0]!.key, response: batchAudio() },
    { key: run.slots[1]!.key, error: { code: 400 } },
    { key: run.slots[2]!.key, response: batchAudio('garbage') }
  ])
  expect(run.slots.map(slot => slot.error)).toEqual([undefined, 'provider-item-error', 'invalid-or-incomplete-audio', 'missing-result'])
  const retained = run.slots[0]!.audioSha256
  await expect(collectGeminiJobResults(root, run, run.jobs[0]!, [
    { key: run.slots[0]!.key, response: batchAudio() }, { key: run.slots[0]!.key, response: batchAudio() }
  ])).rejects.toThrow('duplicate')
  expect((await load(root)).slots[0]?.audioSha256).toBe(retained)
})

test('interrupted JSONL downloads retain completed items and recover remaining audio', async () => {
  const root = await makeTempDir('gemini-batch-download-'), run = makeRun()
  run.jobs[0]!.jobId = 'batches/file'; run.jobs[0]!.state = 'pending'
  let fail = true
  const calls = installMockFetch(call => {
    if (!call.url.includes(':download')) return jsonResponse({ name: 'batches/file', done: true, metadata: { state: 'BATCH_STATE_SUCCEEDED' }, response: { responsesFile: 'files/results' } })
    const first = JSON.stringify({ key: run.slots[0]!.key, response: batchAudio() }) + '\n'
    if (fail) { fail = false; return new Response(first + '{invalid remainder') }
    return new Response(first + JSON.stringify({ key: run.slots[1]!.key, response: batchAudio() }) + '\n')
  })
  await expect(reconcileGeminiJobs(root, run, key, 'wait', 0)).rejects.toThrow()
  expect((await load(root)).slots[0]?.audioPath).toBeDefined()
  await reconcileGeminiJobs(root, await load(root), key, 'wait', 0)
  expect((await load(root)).slots.every(slot => slot.audioPath)).toBe(true)
  expect(calls.every(call => call.method === 'GET')).toBe(true)
})

test('cancellation reconciles completed results; timeout and local interruption do not cancel', async () => {
  const root = await makeTempDir('gemini-batch-cancel-'), run = makeRun()
  run.jobs[0]!.jobId = 'batches/cancel'; run.jobs[0]!.state = 'pending'
  let cancelled = false
  const calls = installMockFetch(call => {
    if (call.url.endsWith(':cancel')) { cancelled = true; return jsonResponse({}) }
    return jsonResponse({ metadata: { state: cancelled ? 'BATCH_STATE_CANCELLED' : 'BATCH_STATE_RUNNING' }, ...(cancelled ? { response: { inlinedResponses: { inlinedResponses: [{ metadata: { key: run.slots[0]!.key }, response: batchAudio() }] } } } : {}) })
  })
  await reconcileGeminiJobs(root, run, key, 'wait', 0)
  expect(run.jobs[0]?.state).toBe('pending')
  expect(calls.map(call => call.method)).toEqual(['GET'])
  await expect(reconcileGeminiJobs(root, run, key, 'wait', 10, AbortSignal.abort())).rejects.toThrow()
  expect(calls).toHaveLength(1)
  await reconcileGeminiJobs(root, run, key, 'cancel', 0)
  expect(String(run.jobs[0]?.state)).toBe('cancelled')
  expect(run.slots[0]?.audioPath).toBeDefined()
  expect(run.slots[1]?.error).toBe('missing-result')
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('resume price performs no calls or writes and exposes possible unsubmitted spending', async () => {
  const root = await makeTempDir('gemini-batch-price-'), run = makeRun()
  await persistGeminiJobs(root, run)
  await writeManifest(root, geminiBatchManifest(run))
  const before = await Bun.file(join(root, GEMINI_JOB_FILE)).text(), files = await readdir(root)
  const calls = installMockFetch(() => { throw Error('Price attempted network') })
  const price = await resumeGeminiRemoteBatch(root, { price: true })
  expect(price?.['possibleAdditionalCostCents']).toBeGreaterThan(0)
  expect(calls).toHaveLength(0)
  expect(await Bun.file(join(root, GEMINI_JOB_FILE)).text()).toBe(before)
  expect(await readdir(root)).toEqual(files)
})

test('payloads above the documented 20 MB inline ceiling upload JSONL and reuse the saved file handle', async () => {
  const root = await makeTempDir('gemini-batch-upload-'), run = makeRun(Array(3400).fill(LITE))
  for (const slot of run.slots) {
    slot.request = { contents: [{ role: 'user', parts: [{ text: 'x'.repeat(6000), speech_metadata: { speaker: 'Narrator' } }] }], generationConfig: { responseModalities: ['AUDIO'], maxOutputTokens: 16384, speechConfig: { voiceConfig: { voice: 'Kore' } } } }
    slot.requestFingerprint = hashCanonicalTtsValue({ model: slot.model, request: slot.request })
  }
  run.jobs = partitionGeminiJobs(run.slots)
  const calls = installMockFetch(async call => {
    if (call.url.endsWith('/upload/v1beta/files')) {
      expect((await load(root)).jobs[0]?.state).toBe('uploading')
      expect(Number(call.headers.get('x-goog-upload-header-content-length'))).toBeGreaterThan(20_000_000)
      expect(call.bodyJson).toMatchObject({ file: { mimeType: 'application/jsonl' } })
      return new Response('', { headers: { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/fixture' } })
    }
    if (call.url.endsWith('/upload/fixture')) {
      expect(call.bodyBytes).toBeGreaterThan(0)
      return jsonResponse({ file: { name: 'files/input-fixture' } }, { headers: { 'x-goog-upload-status': 'final' } })
    }
    expect((await load(root)).jobs[0]).toMatchObject({ state: 'submitting', uploadHandle: 'files/input-fixture' })
    expect(call.bodyJson).toMatchObject({ batch: { inputConfig: { fileName: 'files/input-fixture' } } })
    return jsonResponse({ name: 'batches/uploaded' })
  })
  await submitGeminiJobs(root, run, key)
  const submittedCalls = calls.length
  const lines = (await Bun.file(join(root, 'batch-input-' + run.jobs[0]!.requestFingerprint + '.jsonl')).text()).trim().split('\n')
  expect(lines).toHaveLength(run.slots.length)
  expect(JSON.parse(lines[0]!)).toEqual({ key: run.slots[0]!.key, request: run.slots[0]!.request })
  await submitGeminiJobs(root, await load(root), key)
  expect(calls).toHaveLength(submittedCalls)
}, 30000)

test('expired jobs retain completed audio, report missing results and never resubmit', async () => {
  const root = await makeTempDir('gemini-batch-expired-'), run = makeRun()
  run.jobs[0]!.jobId = 'batches/expired'; run.jobs[0]!.state = 'pending'
  await collectGeminiJobResults(root, run, run.jobs[0]!, [{ key: run.slots[0]!.key, response: batchAudio() }])
  const retained = run.slots[0]!.audioSha256
  const calls = installMockFetch(() => jsonResponse({ metadata: { state: 'BATCH_STATE_EXPIRED' } }))
  await reconcileGeminiJobs(root, run, key, 'wait', 0)
  await submitGeminiJobs(root, await load(root), key)
  expect(String(run.jobs[0]!.state)).toBe('expired')
  expect(run.slots[0]!.audioSha256).toBe(retained)
  expect(run.slots[1]!.error).toBe('missing-result')
  expect(calls.map(call => call.method)).toEqual(['GET'])
})

test('prepared jobs inspect custom-voice expiry again before resumed submission', async () => {
  const root = await makeTempDir('gemini-batch-voice-expiry-'), run = makeRun([LITE])
  const slot = run.slots[0]!
  slot.request = { contents: [{ role: 'user', parts: [{ text: 'A stored-voice request.' }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: 'voice_expired' } } } }
  slot.requestFingerprint = hashCanonicalTtsValue({ model: slot.model, request: slot.request }); run.jobs = partitionGeminiJobs(run.slots)
  await persistGeminiJobs(root, run)
  const calls = installMockFetch(() => jsonResponse({ id: 'voice_expired', model: LITE, expire_time: '2020-01-01T00:00:00Z' }))
  await expect(submitGeminiJobs(root, await load(root), key)).rejects.toThrow('expired')
  expect(calls.map(call => call.method)).toEqual(['GET'])
  expect((await load(root)).jobs[0]!.state).toBe('prepared')
})
