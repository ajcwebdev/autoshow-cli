import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { validateData } from '~/utils/validate/validation'
import { AutoshowConfigSchema } from '~/types'
import { createHostedTtsChunkScheduler, bindHostedTtsChunkScheduler } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-chunk-scheduler'
import { splitSonioxTtsText } from '~/cli/commands/audio/tts/tts-services/tts-soniox/soniox-tts-chunks'
import { createSonioxRequestLimiter } from '~/cli/commands/audio/tts/tts-services/tts-soniox/soniox-request-limiter'
import { decodeSonioxWavDuration } from '~/cli/commands/audio/tts/tts-services/tts-soniox/soniox-tts-audio'
import { estimateSonioxTtsCost } from '~/cli/commands/audio/tts/tts-services/tts-soniox/soniox-tts-pricing'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { buildTtsTargetEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/tts-estimates'
import { createSyntheticWavBytes } from '../../../../../test-utils/media-fixtures'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import type { TtsOptions, TtsTargetInvocation } from '~/types'

// Independent expectations: Soniox generate_tts, supported-languages, speech-speed and pricing
// documentation checked 2026-09-24. Synthetic PCM proves integrity, never spoken correctness/quality.
const { makeTempDir } = setupTtsContractLifecycle()
const wav = (seconds = 0.1) => createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: seconds, amplitude: 0.2, frequencyHz: 440 })
const options = (extra: TtsOptions = {}): TtsOptions => ({ sonioxTtsModels: ['tts-rt-v2'], hostedTtsChunkScheduler: createHostedTtsChunkScheduler(), ...extra })

test('documented REST defaults and override/reset controls reach actual target dispatch', async () => {
  process.env['SONIOX_API_KEY'] = 'soniox-contract-key'
  const calls = installMockFetch(() => new Response(wav()))
  const defaults = options()
  const target = collectTtsTargets(defaults)[0]!
  const text = '[warm] Hello 世界. [pause] Welcome.'
  const result = await target.run(text, await makeTempDir('soniox-default-'), defaults)
  expect(result.metadata.sonioxProviderAudioSeconds).toBeCloseTo(0.1)
  expect(calls[0]).toMatchObject({ url: 'https://tts-rt.soniox.com/tts', method: 'POST', bodyJson: { model: 'tts-rt-v2', text, voice: 'Adrian', language: 'en', speed: 1, audio_format: 'wav', sample_rate: 24000 } })
  expect(calls[0]!.bodyJson).toEqual({ model: 'tts-rt-v2', text, voice: 'Adrian', language: 'en', speed: 1, audio_format: 'wav', sample_rate: 24000 })
  expect(calls[0]!.headers.get('authorization')).toBe('Bearer soniox-contract-key')
  expect(calls[0]!.headers.get('content-type')).toBe('application/json')
  const configured = options({ sonioxTtsVoice: 'Clone_CaseSensitive', sonioxTtsLanguage: 'fr', sonioxTtsSpeed: 0.7 })
  const configuredTarget = collectTtsTargets(configured)[0]!
  await configuredTarget.run(text, await makeTempDir('soniox-config-'), configured)
  const invocation: TtsTargetInvocation = { sourceId: 'dialogue-turn-001', sourceIndex: 0, speaker: 'Host', voice: { kind: 'id', value: 'Another_Clone' }, controls: { language: 'ja', speed: 1.3 } }
  await configuredTarget.run(text, await makeTempDir('soniox-override-'), configured, invocation)
  await configuredTarget.run(text, await makeTempDir('soniox-reset-'), configured, { ...invocation, controls: { language: null, speed: null } })
  expect(calls[1]!.bodyJson).toMatchObject({ voice: 'Clone_CaseSensitive', language: 'fr', speed: 0.7 })
  expect(calls[2]!.bodyJson).toMatchObject({ voice: 'Another_Clone', language: 'ja', speed: 1.3 })
  expect(calls[3]!.bodyJson).toMatchObject({ voice: 'Another_Clone', language: 'en', speed: 1 })
})

test('selection and controls reject invalid values before any synthesis dispatch', async () => {
  const calls = installMockFetch(() => { throw Error('Unexpected network') })
  expect(collectTtsTargets(buildOptsFromFlags({ 'soniox-tts': true }))[0]).toMatchObject({ service: 'soniox', model: 'tts-rt-v2', voice: 'Adrian' })
  for (const extra of [{ sonioxTtsModels: ['tts-rt-v1'] }, { sonioxTtsVoice: '' }, { sonioxTtsVoice: 'x'.repeat(51) }, { sonioxTtsLanguage: 'auto' }, { sonioxTtsLanguage: 'en-US' }, { sonioxTtsSpeed: 0.69 }, { sonioxTtsSpeed: 1.31 }, { sonioxTtsSpeed: NaN }]) expect(() => collectTtsTargets(options(extra))).toThrow()
  for (const [flag, value] of [['tts-instructions', 'Be happy'], ['tts-ref-audio', 'sample.wav'], ['tts-response-format', 'mp3'], ['tts-speed', '1.4'], ['tts-language', 'auto']]) expect(() => buildOptsFromFlags({ 'soniox-tts': true, [flag!]: ['soniox=' + value] })).toThrow()
  const opts = options(), target = collectTtsTargets(opts)[0]!, output = await makeTempDir('soniox-invalid-')
  await expect(target.run('hello', output, opts)).rejects.toThrow('SONIOX_API_KEY')
  process.env['SONIOX_API_KEY'] = 'soniox-contract-key'
  await expect(target.run('hello', output, opts, { sourceId: 'dialogue-turn-001', sourceIndex: 0, speaker: 'Host', voice: { kind: 'id', value: 'Adrian' }, controls: { instructions: 'Happy' } })).rejects.toThrow('does not support')
  await expect(target.run('hello', output, opts, { sourceId: 'dialogue-turn-001', sourceIndex: 0, speaker: 'Host', voice: { kind: 'ref-audio', value: 'sample.wav' }, controls: {} })).rejects.toThrow('reference audio')
  expect(calls).toHaveLength(0)
})

test('sentence chunks enforce the safety ceiling and preserve Unicode and whole tags', () => {
  const text = ('Hello 🌍. [warm] Here is another complete sentence. ').repeat(100)
  for (const maxChars of [40, 500, 5000]) {
    const chunks = splitSonioxTtsText(text, { maxChars, boundary: 'legacy' })
    expect(chunks.every(chunk => chunk.length <= Math.min(maxChars, 500) && chunk.isWellFormed())).toBe(true)
    expect(chunks.join(' ').replace(/\s+/gu, ' ')).toBe(text.trim())
    expect(chunks.every(chunk => [...chunk].filter(c => c === '[').length === [...chunk].filter(c => c === ']').length)).toBe(true)
  }
  expect(splitSonioxTtsText('a'.repeat(497) + '[pause]🌍')).toEqual(['a'.repeat(497), '[pause]🌍'])
  expect(() => splitSonioxTtsText('[a very long tag]' + 'x'.repeat(30), { boundary: 'smart', maxChars: 3 })).toThrow('tag exceeds')
  expect(() => splitSonioxTtsText('🌍🌍', { boundary: 'smart', maxChars: 1 })).toThrow('Unicode')
})

test('decoded WAV integrity rejects empty, JSON, corrupt, truncated and near-cap artifacts without retries', async () => {
  process.env['SONIOX_API_KEY'] = 'soniox-contract-key'
  const corrupt = wav(); corrupt.writeUInt32LE(1234, 28)
  const trailing = Buffer.concat([wav(), Buffer.from([0])])
  const invalid = [new Uint8Array(), Buffer.from('{"audio":"not audio"}'), wav().subarray(0, 50), corrupt, trailing, wav(119), wav(120)]
  let body: Uint8Array = invalid[0]!
  const calls = installMockFetch(() => new Response(body))
  const opts = options(), target = collectTtsTargets(opts)[0]!
  for (const artifact of invalid) {
    body = artifact
    const output = await makeTempDir('soniox-invalid-wav-')
    await expect(target.run('Short request.', output, opts)).rejects.toThrow()
    expect(new Uint8Array(await Bun.file(join(output, 'soniox-response-chunk-001.wav')).arrayBuffer())).toEqual(new Uint8Array(body))
  }
  expect(calls).toHaveLength(invalid.length)
  expect(decodeSonioxWavDuration(wav(118.9))).toBeCloseTo(118.9)
})

test('decoded integrity accepts standard streaming integer and extensible float WAVs, rejecting broken samples', async () => {
  // Independently generated by ffmpeg: WAV streaming headers have unknown RIFF/data lengths.
  const encoded = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-ac', '2', '-c:a', 'pcm_f32le', '-f', 'wav', 'pipe:1'], { input: wav() })
  expect(encoded.status).toBe(0)
  const floating = encoded.stdout
  expect(floating.readUInt32LE(4)).toBe(0xffffffff)
  expect(decodeSonioxWavDuration(floating)).toBeCloseTo(0.1)
  const nonFinite = Buffer.from(floating)
  nonFinite.writeFloatLE(NaN, nonFinite.indexOf('data') + 8)
  expect(() => decodeSonioxWavDuration(nonFinite)).toThrow('non-finite')
  expect(() => decodeSonioxWavDuration(floating.subarray(0, floating.length - 1))).toThrow('incomplete sample frames')
  const integer = wav()
  integer.writeUInt32LE(0xffffffff, 4); integer.writeUInt32LE(0xffffffff, 40)
  expect(decodeSonioxWavDuration(integer)).toBeCloseTo(0.1)
  process.env['SONIOX_API_KEY'] = 'soniox-contract-key'
  installMockFetch(() => new Response(floating))
  const opts = options()
  const result = await collectTtsTargets(opts)[0]!.run('Streaming format fixture.', await makeTempDir('soniox-stream-wav-'), opts)
  expect(result.metadata.sonioxProviderAudioSeconds).toBeCloseTo(0.1)
})

test('structured failures retain status, error_type and request_id; only explicit rate rejection retries', async () => {
  process.env['SONIOX_API_KEY'] = 'soniox-contract-key'
  let status = 400, errorType = 'invalid_request'
  const calls = installMockFetch(() => jsonResponse({ error_type: errorType, error_message: 'Contract fixture', request_id: 'request-42' }, { status }))
  const opts = options(), target = collectTtsTargets(opts)[0]!
  for (const entry of [[400, 'invalid_request'], [401, 'unauthenticated'], [402, 'organization_balance_exhausted'], [408, 'request_timeout'], [500, 'internal_error'], [503, 'service_unavailable']] as const) {
    ;[status, errorType] = entry
    await expect(target.run('Hello', await makeTempDir('soniox-errors-'), opts)).rejects.toThrow(`HTTP ${status}, ${errorType}, request_id=request-42`)
  }
  expect(calls).toHaveLength(6)
  const retryCalls = installMockFetch(() => retryCalls.length === 1 ? jsonResponse({ error_type: 'limit_exceeded', request_id: 'rate-id' }, { status: 429, headers: { 'retry-after': '0' } }) : new Response(wav()))
  await target.run('Hello', await makeTempDir('soniox-rate-'), opts)
  expect(retryCalls).toHaveLength(2)
})

test('one provider lane limits concurrent HTTP bodies to three across jobs and bound scopes', async () => {
  process.env['SONIOX_API_KEY'] = 'soniox-contract-key'
  let active = 0, peak = 0
  const calls = installMockFetch(async () => {
    peak = Math.max(peak, ++active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    return new Response(wav())
  })
  const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 30 })
  await Promise.all(Array.from({ length: 5 }, async (_, index) => {
    const opts = options({ hostedTtsChunkScheduler: bindHostedTtsChunkScheduler(scheduler, { scopeLabel: `file-${index}` }) })
    await collectTtsTargets(opts)[0]!.run('A short sentence. '.repeat(50), await makeTempDir('soniox-concurrent-'), opts)
  }))
  expect(peak).toBe(3)
  expect(calls.length).toBeGreaterThan(5)
  expect(scheduler.getProviderSnapshot('soniox').maxLimit).toBe(3)
})

test('rolling window admits 100 starts per minute and shares its budget with retries; waiting is cancellable', async () => {
  let now = 0
  const waits: number[] = []
  const admit = createSonioxRequestLimiter(() => now, async ms => { waits.push(ms); now += ms })
  for (let index = 0; index < 100; index++) await admit()
  expect(waits).toEqual([])
  await admit() // retry requests use the same admission path
  expect(waits).toEqual([60_000])
  const controller = new AbortController(); controller.abort()
  await expect(admit(controller.signal)).rejects.toThrow()
})

test('token estimates use native rates, numeric speed and measured provider duration with heuristic labeling', async () => {
  expect(estimateSonioxTtsCost(50_000)).toMatchObject({ estimatedTextTokens: 15_000, estimatedAudioTokens: 30_000, estimatedDurationSeconds: 3600, totalCost: 70.5 })
  expect(estimateSonioxTtsCost(50_000, 1.3).totalCost).toBeCloseTo(6 + 64.5 / 1.3)
  const opts = options({ sonioxTtsSpeed: 0.7 })
  const estimates = await buildTtsTargetEstimates(collectTtsTargets(opts), opts, 50_000)
  expect(estimates[0]!.totalCost).toBeCloseTo(6 + 64.5 / 0.7)
  const metadata = { ttsService: 'soniox' as const, ttsModel: 'tts-rt-v2', sonioxInputCharacters: 50_000, sonioxProviderAudioSeconds: 1800, processingTime: 1, audioFileName: 'speech.wav', audioFileSize: 44, chunkCount: 100 }
  expect(computeActualCosts({ step4: [metadata], ttsCharacterCount: 50_000 }).steps[0]).toMatchObject({ cost: 38.25, costSource: 'heuristic', pricingNote: expect.stringContaining('measured provider audio') })
})

test('configuration defaults and CLI overrides reach dispatch without altering Soniox STT defaults', async () => {
  process.env['SONIOX_API_KEY'] = 'soniox-contract-key'
  const config = validateData(AutoshowConfigSchema, { defaults: { tts: { sonioxTts: ['tts-rt-v2'], voice: 'soniox=Clone_Config', speed: 'soniox=0.9', language: 'soniox=de' }, extract: { stt: { sonioxStt: ['stt-async-v5'] } } } }, 'Soniox fixture config')
  const merged = mergeConfigIntoRawFlags({}, config, new Set(), 'tts')
  const opts = { ...buildOptsFromFlags(merged), hostedTtsChunkScheduler: createHostedTtsChunkScheduler() }
  const calls = installMockFetch(() => new Response(wav()))
  await collectTtsTargets(opts)[0]!.run('Configuration fixture.', await makeTempDir('soniox-config-default-'), opts)
  expect(calls[0]!.bodyJson).toMatchObject({ voice: 'Clone_Config', speed: 0.9, language: 'de' })
  const override = mergeConfigIntoRawFlags({ 'tts-speed': ['soniox=1.2'] }, config, new Set(['tts-speed']), 'tts')
  const changed = { ...buildOptsFromFlags(override), hostedTtsChunkScheduler: createHostedTtsChunkScheduler() }
  await collectTtsTargets(changed)[0]!.run('Override fixture.', await makeTempDir('soniox-config-override-'), changed)
  expect(calls[1]!.bodyJson).toMatchObject({ voice: 'Clone_Config', speed: 1.2, language: 'de' })
  expect(config.defaults?.extract?.stt?.sonioxStt).toEqual(['stt-async-v5'])
})

test('cancellation before dispatch and during transport does not retry or mark audio complete', async () => {
  process.env['SONIOX_API_KEY'] = 'soniox-contract-key'
  const canceled = new AbortController(); canceled.abort()
  const opts = options(), target = collectTtsTargets(opts)[0]!
  const invocation: TtsTargetInvocation = { sourceId: 'dialogue-turn-001', sourceIndex: 0, speaker: 'Host', voice: { kind: 'id', value: 'Adrian' }, controls: {}, signal: canceled.signal }
  const active = new AbortController()
  const calls = installMockFetch(async (_call, _input, init) => {
    active.abort()
    init?.signal?.throwIfAborted()
    throw Error('Expected cancellation')
  })
  await expect(target.run('Canceled.', await makeTempDir('soniox-cancel-before-'), opts, invocation)).rejects.toThrow()
  expect(calls).toHaveLength(0)
  await expect(target.run('Cancel in flight.', await makeTempDir('soniox-cancel-active-'), opts, { ...invocation, signal: active.signal })).rejects.toThrow()
  expect(calls).toHaveLength(1)
})
