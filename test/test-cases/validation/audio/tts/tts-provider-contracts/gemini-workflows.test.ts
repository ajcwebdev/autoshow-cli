import { afterEach, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readdir, mkdir } from 'node:fs/promises'
import { runGeminiRemoteBatch } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-batch-workflow'
import { runSingleTtsInput } from '~/cli/commands/audio/tts/tts-single-run'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { dispatchResume } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { expectUnknownFlag, parseRootCli } from '../../../../../test-utils/cli-assertions'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import { createSyntheticWavBytes } from '../../../../../test-utils/media-fixtures'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import { FLASH, LITE, batchAudio, sse, unary } from './gemini-fixtures'
import type { TtsOptions, CliCommandContext } from '~/types'
const { makeTempDir } = setupTtsContractLifecycle()
afterEach(resetPinnedRunDir)

test('both Gemini models resume into separate retained slots with distinct decoded audio and no repeated synthesis', async () => {
  const root = await makeTempDir('gemini-distinct-slots-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'Short test line.'); configurePinnedRunDir(output); process.env['GEMINI_API_KEY'] = 'workflow-key'
  let reject = true
  const audioByModel = new Map([
    [FLASH, createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 0.3, frequencyHz: 330, amplitude: 0.2 })],
    [LITE, createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 0.5, frequencyHz: 660, amplitude: 0.2 })],
  ])
  const calls = installMockFetch(call => reject
    ? jsonResponse({ error: { code: 400, message: 'Fixture rejection' } }, { status: 400 })
    : jsonResponse(unary(audioByModel.get(String(call.bodyJson?.['model']))!.toString('base64'))))
  const options = { batchConcurrency: 1, price: false, allowOverBudget: false, geminiTtsModels: [FLASH, LITE], geminiTtsVoice: 'Kore' }
  await expect(runSingleTtsInput(input, options, collectTtsTargets(options), undefined)).rejects.toThrow()
  reject = false
  await dispatchResume(output, {})
  const manifest = await readManifest(output)
  expect(manifest?.items[0]?.status).toBe('full')
  const slots = (await readdir(join(output, 'slots'))).filter(path => path.endsWith('.wav'))
  expect(slots).toHaveLength(2)
  expect(new Set(await Promise.all(slots.map(async path => Buffer.from(await Bun.file(join(output, 'slots', path)).bytes()).toString('base64'))))).toEqual(new Set([...audioByModel.values()].map(audio => audio.toString('base64'))))
  await dispatchResume(output, {})
  expect(calls).toHaveLength(4)
}, 20000)

test('remote directory batch waits by default and assembles both models in original order', async () => {
  const root = await makeTempDir('gemini-workflow-'), input = join(root, 'input'), output = join(root, 'output')
  await mkdir(input)
  await Bun.write(join(input, '02.txt'), 'Second chapter.')
  await Bun.write(join(input, '01.txt'), 'First chapter.')
  configurePinnedRunDir(output); process.env['GEMINI_API_KEY'] = 'workflow-key'
  const requests = new Map<string, Array<{ metadata: { key: string } }>>()
  const calls = installMockFetch(call => {
    if (call.method === 'POST') {
      const id = 'batches/job-' + requests.size
      const body = call.bodyJson as { batch: { inputConfig: { requests: { requests: Array<{ metadata: { key: string } }> } } } }
      requests.set(id, body.batch.inputConfig.requests.requests)
      return jsonResponse({ name: id, metadata: { state: 'BATCH_STATE_PENDING' } })
    }
    const id = call.url.split('/v1beta/')[1]!
    return jsonResponse({ name: id, metadata: { state: 'BATCH_STATE_SUCCEEDED' }, done: true, response: { inlinedResponses: { inlinedResponses: [...requests.get(id)!].reverse().map(request => ({ metadata: request.metadata, response: batchAudio() })) } } })
  })
  const options: TtsOptions = { geminiTtsModels: [FLASH, LITE], geminiTtsMode: 'batch' }
  await runGeminiRemoteBatch(input, options, collectTtsTargets(options))
  const manifest = await readManifest(output)
  expect(manifest?.providerJobs).toMatchObject({ schemaVersion: 1, provider: 'gemini', path: 'gemini-provider-jobs.json' })
  expect(manifest?.items.map(item => item.status)).toEqual(['full', 'full'])
  const audio = (await readdir(output)).filter(name => name.endsWith('.wav')).sort()
  expect(audio).toEqual([`001-01-${LITE}.wav`, `001-01-${FLASH}.wav`, `002-02-${LITE}.wav`, `002-02-${FLASH}.wav`].sort())
  const before = calls.length
  await dispatchResume(output, { 'provider-job-action': 'wait' })
  expect(calls).toHaveLength(before)
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(2)
}, 20000)

test('batch wait=0 submits without polling and CLI resume status retrieves an existing pending job', async () => {
  const root = await makeTempDir('gemini-submit-only-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'A short request.'); configurePinnedRunDir(output); process.env['GEMINI_API_KEY'] = 'workflow-key'
  const calls = installMockFetch(call => jsonResponse(call.method === 'POST' ? { name: 'batches/pending' } : { name: 'batches/pending', metadata: { state: 'BATCH_STATE_RUNNING' } }))
  const options: TtsOptions = { geminiTtsModels: [LITE], geminiTtsMode: 'batch', geminiTtsBatchWaitSeconds: 0 }
  await runGeminiRemoteBatch(input, options, collectTtsTargets(options))
  expect(calls.map(call => call.method)).toEqual(['POST'])
  await dispatchResume(output, { 'provider-job-action': 'status' })
  expect(calls.map(call => call.method)).toEqual(['POST', 'GET'])
})

test('remote Batch price is isolated from credentials, network, output writes and locks', async () => {
  const root = await makeTempDir('gemini-price-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'Price this request.'); configurePinnedRunDir(output)
  const calls = installMockFetch(() => { throw Error('No network authorized') })
  const options: TtsOptions = { price: true, geminiTtsModels: [FLASH, LITE], geminiTtsMode: 'batch' }
  await runGeminiRemoteBatch(input, options, collectTtsTargets(options))
  expect(await readdir(root)).toEqual(['source.txt'])
  expect(calls).toHaveLength(0)
})

for (const mode of ['unary', 'stream'] as const) test('standard ' + mode + ' run resumes using retained voice, controls and transport without duplicate synthesis', async () => {
  const root = await makeTempDir('gemini-unary-resume-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'An ordinary retained streaming request.'); configurePinnedRunDir(output); process.env['GEMINI_API_KEY'] = 'workflow-key'
  const calls = installMockFetch(() => mode === 'stream' ? new Response(sse(), { headers: { 'content-type': 'text/event-stream' } }) : jsonResponse(unary()))
  const options = { batchConcurrency: 1, price: false, allowOverBudget: false, geminiTtsModels: [LITE], geminiTtsMode: mode, geminiTtsVoice: 'Puck', geminiTtsInstructions: 'Softly.' }
  await runSingleTtsInput(input, options, collectTtsTargets(options), undefined)
  await dispatchResume(output, { price: true })
  await dispatchResume(output, {})
  expect(calls).toHaveLength(1)
  expect((await readManifest(output))?.items[0]?.providers[0]?.transport).toBe('gemini-' + mode)
}, 20000)

test('public selectors default to Flash-Lite/Kore, retain both models, and reject incompatible transport flags', () => {
  expect(collectTtsTargets(buildOptsFromFlags({ 'gemini-tts': true }))[0]).toMatchObject({ model: LITE, voice: 'Kore' })
  expect(collectTtsTargets(buildOptsFromFlags({ 'gemini-tts': [FLASH, LITE] })).map(target => target.model)).toEqual([FLASH, LITE])
  expect(() => buildOptsFromFlags({ 'all-tts': true, 'gemini-tts-mode': 'batch' })).toThrow('explicit')
  expect(() => buildOptsFromFlags({ 'gemini-tts': LITE, 'gemini-tts-batch-wait-seconds': '0' })).toThrow('requires batch')
})

test('CLI unsupported controls and invalid format fail before dispatch', async () => {
  const root = await makeTempDir('gemini-cli-controls-'), input = join(root, 'source.txt')
  await Bun.write(input, 'No synthesis.')
  const calls = installMockFetch(() => { throw Error('Dispatch occurred') })
  for (const [flag, value] of [['tts-speed', '1.2'], ['tts-language', 'en'], ['tts-seed', '1'], ['tts-stability', '0.5'], ['tts-similarity', '0.5'], ['tts-pronunciation-dictionary', 'dictionary'], ['tts-response-format', 'mp3']]) {
    const parsed = parseRootCli(['tts', input, '--provider', 'gemini', '--' + flag, value!, '--price'])
    const context: CliCommandContext = { argv: parsed.argv, command: parsed.command!, parameters: parsed.parameters, flags: parsed.flags, rawParsed: parsed.rawParsed, store: {} }
    let rejected = false
    try { await parsed.command!.handler(context) } catch { rejected = true }
    expect({ flag, rejected }).toEqual({ flag, rejected: true })
  }
  expectUnknownFlag(['tts', input, '--provider', 'gemini', '--tts-ref-audio', 'reference.wav', '--price'], '--tts-ref-audio')
  expect(calls).toHaveLength(0)
})

test('interrupted unary resume restores request controls and purchases only the unresolved slot', async () => {
  const root = await makeTempDir('gemini-interrupted-unary-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'This sentence belongs in a retained chunk. '.repeat(45))
  configurePinnedRunDir(output); process.env['GEMINI_API_KEY'] = 'workflow-key'
  let attempt = 0
  const calls = installMockFetch(() => ++attempt === 2 ? jsonResponse({ error: { code: 400, message: 'Fixture rejection' } }, { status: 400 }) : jsonResponse(unary()))
  const options = { batchConcurrency: 1, price: false, allowOverBudget: false, ttsChunkConcurrency: 1, geminiTtsModels: [LITE], geminiTtsVoice: 'Puck', geminiTtsInstructions: 'Softly.' }
  await expect(runSingleTtsInput(input, options, collectTtsTargets(options), undefined)).rejects.toThrow()
  expect(calls).toHaveLength(2)
  await dispatchResume(output, {})
  expect(calls).toHaveLength(3)
  expect(calls[2]?.bodyJson).toEqual(calls[1]?.bodyJson)
  expect((await readManifest(output))?.items[0]?.status).toBe('full')
}, 20000)

test('HTTP 400 resume retries only the rejected model, preserves completed audio and needs no ambiguous-redispatch override', async () => {
  const root = await makeTempDir('gemini-rejected-resume-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'Short test line.'); configurePinnedRunDir(output); process.env['GEMINI_API_KEY'] = 'workflow-key'
  let reject = true
  const calls = installMockFetch(call => {
    if ((reject && call.bodyJson?.['model'] === FLASH) || JSON.stringify(call.bodyJson).includes('"speaker":')) return jsonResponse({ error: { code: 400, message: 'Invalid input received.' } }, { status: 400 })
    return jsonResponse(unary())
  })
  const options = { batchConcurrency: 1, price: false, allowOverBudget: false, ttsChunkConcurrency: 1, geminiTtsModels: [FLASH, LITE], geminiTtsVoice: 'Kore' }
  await runSingleTtsInput(input, options, collectTtsTargets(options), undefined)
  const partial = await readManifest(output)
  expect(partial?.items[0]?.status).toBe('incomplete')
  expect(partial?.items[0]?.providers.map(provider => ({ model: provider.model, status: provider.status }))).toEqual([
    { model: FLASH, status: 'failed' }, { model: LITE, status: 'succeeded' },
  ])
  expect(calls).toHaveLength(2)
  const rejectionFiles = (await readdir(output, { recursive: true })).filter(path => path.endsWith('-rejection.json'))
  expect(rejectionFiles).toHaveLength(1)
  const originalEvidence = await Bun.file(join(output, rejectionFiles[0]!)).text()
  expect(JSON.parse(originalEvidence)).toMatchObject({ evidenceKind: 'rejection', fields: { status: 400, retryable: false } })
  const completedAudio = (await readdir(output)).find(path => path.endsWith(LITE + '.wav'))!
  const retainedBytes = await Bun.file(join(output, completedAudio)).bytes()
  expect(retainedBytes.length).toBeGreaterThan(44)
  reject = false
  await dispatchResume(output, {})
  expect(calls).toHaveLength(3)
  expect(calls[2]?.bodyJson?.['model']).toBe(FLASH)
  expect((await readManifest(output))?.items[0]?.status).toBe('full')
  // Successful resume compacts attempt evidence into the final render archive.
  expect(await Bun.file(join(output, completedAudio)).bytes()).toEqual(retainedBytes)
  await dispatchResume(output, {})
  expect(calls).toHaveLength(3)
}, 20000)
