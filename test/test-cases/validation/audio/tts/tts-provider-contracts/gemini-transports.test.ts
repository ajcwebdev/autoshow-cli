import { join } from 'node:path'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { describe, expect, test } from 'bun:test'
import { runGeminiTts } from '~/cli/commands/audio/tts/tts-services/tts-gemini/run-gemini-tts'
import { decodeGeminiBase64, decodeGeminiAudio, decodeGeminiInteraction, decodeGeminiGenerateContent } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-audio'
import { readGeminiSpeechStream } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-stream'
import { serializeGeminiBatchSpeech, serializeGeminiInteraction } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-request'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { buildPureCurrentTtsRenderPlan } from '~/cli/commands/audio/tts/script-to-audio/attempt-planning'
import { createHostedTtsChunkScheduler } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-chunk-scheduler'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import { FLASH, LITE, wav, unary, batchAudio, sse } from './gemini-fixtures'
import type { TtsOptions } from '~/types'
const { makeTempDir } = setupTtsContractLifecycle()
const scheduler = () => createHostedTtsChunkScheduler({ maxConcurrency: 2, concurrencyMode: 'immediate' })

describe('Gemini REST transport and decoded artifact integrity', () => {
  for (const model of [FLASH, LITE]) {
    test(`${model} dispatches unary WAV with separate style metadata and observed usage`, async () => {
      process.env['GEMINI_API_KEY'] = 'fixture-key'
      const calls = installMockFetch(() => jsonResponse(unary()))
      const root = await makeTempDir('gemini-unary-')
      const result = await runGeminiTts('A <short pause> here; café.', root, { model, voice: 'Kore', instructions: 'Warm and clear.', hostedTtsChunkScheduler: scheduler() })
      expect(calls).toHaveLength(1)
      expect(calls[0]).toMatchObject({ url: 'https://generativelanguage.googleapis.com/v1beta/interactions', method: 'POST', bodyJson: {
        model, input: [{ type: 'user_input', content: [{ type: 'text', text: 'A <short pause> here; café.', annotations: [{ type: 'speech_metadata', style: 'Warm and clear.' }] }] }],
        response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 }, generation_config: { max_output_tokens: 16384, speech_config: [{ voice: 'Kore' }] }
      } })
      expect(JSON.stringify(calls[0]?.bodyJson)).not.toContain('"speaker":')
      expect(calls[0]!.headers.get('x-goog-api-key')).toBe('fixture-key')
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata.geminiTtsUsageComplete).toBe(true)
      expect(result.metadata.geminiTtsUsage?.[0]).toMatchObject({ observedTextTokens: 30, observedAudioTokens: 8 })
    })
    test(`${model} dispatches streaming PCM and retains a decoded artifact`, async () => {
      process.env['GEMINI_API_KEY'] = 'fixture-key'
      const calls = installMockFetch(() => new Response(sse(), { headers: { 'content-type': 'text/event-stream' } }))
      const result = await runGeminiTts('Stream this sentence.', await makeTempDir('gemini-stream-'), { model, voice: 'Kore', geminiTtsMode: 'stream', hostedTtsChunkScheduler: scheduler() })
      expect(calls[0]?.bodyJson).toMatchObject({ stream: true, input: [{ content: [{ type: 'text', text: 'Stream this sentence.' }] }], response_format: { mime_type: 'audio/l16' }, generation_config: { speech_config: [{ voice: 'Kore' }] } })
      expect(JSON.stringify(calls[0]?.bodyJson)).not.toContain('"speaker":')
      expect(JSON.stringify(calls[0]?.bodyJson)).not.toContain('"annotations":')
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata.transport).toBe('gemini-stream')
    })
    test(`${model} serializes Batch GenerateContent independently of Interactions`, () => {
      const turns = [{ speaker: 'A', voice: 'Kore', text: 'Hello.', style: 'Softly.' }, { speaker: 'B', voice: 'Puck', text: 'Welcome.' }]
      expect(serializeGeminiBatchSpeech(model, turns)).toEqual({ contents: [{ role: 'user', parts: [
        { text: 'Hello.', speech_metadata: { speaker: 'A', style: 'Softly.' } }, { text: 'Welcome.', speech_metadata: { speaker: 'B' } }
      ] }], generationConfig: { responseModalities: ['AUDIO'], maxOutputTokens: 16384, speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: [
        { speaker: 'A', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }, { speaker: 'B', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
      ] } } } })
      expect(() => serializeGeminiBatchSpeech(model, turns, 'pcm')).toThrow('supports WAV')
      expect(decodeGeminiGenerateContent(batchAudio())).toEqual(wav)
    })
  }
  for (const [mime, data, sample] of [['audio/l16', Buffer.from([1, 0, 255, 255]), 1], ['audio/mulaw', Buffer.from([255, 127]), 0], ['audio/alaw', Buffer.from([213, 85]), 8]] as const) {
    test(`decoded ${mime} integrity uses the documented sample encoding`, () => {
      const decoded = decodeGeminiAudio({ mime_type: mime, data: data.toString('base64') }, mime)
      expect(decoded.readUInt32LE(24)).toBe(24000)
      expect(decoded.readInt16LE(44)).toBe(sample)
    })
  }
  test('rejects corrupt containers, malformed base64, MIME mismatches, JSON errors and truncated generation', () => {
    const bad = [unary('a==='), unary(wav.subarray(0, -2).toString('base64')), unary(wav.toString('base64'), 'audio/l16'), { status: 'completed', steps: [] }, { ...unary(), status: 'incomplete' }, { error: { code: 500 } }]
    for (const payload of bad) expect(() => decodeGeminiInteraction(payload, 'audio/wav')).toThrow()
    const truncated = batchAudio(); truncated.candidates[0]!.finishReason = 'MAX_TOKENS'
    expect(() => decodeGeminiGenerateContent(truncated)).toThrow('incomplete')
    expect(() => decodeGeminiAudio({ mime_type: 'audio/l16', data: Buffer.from('{"error":1}').toString('base64') }, 'audio/l16')).toThrow()
    expect(() => decodeGeminiAudio({ mime_type: 'audio/l16;rate=16000', data: 'AAAA' }, 'audio/l16')).toThrow()
  })
  test('stream parser tolerates CRLF split across bytes and rejects incomplete streams', async () => {
    const bytes = new TextEncoder().encode(sse(true, true))
    const response = new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close() } }), { headers: { 'content-type': 'text/event-stream' } })
    expect((await readGeminiSpeechStream(response, 'audio/l16')).audio).toEqual(wav)
    await expect(readGeminiSpeechStream(new Response(sse(false), { headers: { 'content-type': 'text/event-stream' } }), 'audio/l16')).rejects.toThrow('before complete')
    await expect(readGeminiSpeechStream(new Response('{}', { headers: { 'content-type': 'application/json' } }), 'audio/l16')).rejects.toThrow('SSE')
  })
  test('expired custom voices fail inspection before any synthesis dispatch', async () => {
    process.env['GEMINI_API_KEY'] = 'fixture-key'
    const calls = installMockFetch(() => jsonResponse({ id: 'voice_expired', expire_time: '2020-01-01T00:00:00Z', model: LITE }))
    await expect(runGeminiTts('No purchase.', await makeTempDir('gemini-expired-'), { model: LITE, voice: 'voice_expired' })).rejects.toThrow('expired')
    expect(calls.map(call => call.method)).toEqual(['GET'])
  })
  test('token planning includes style overhead before dispatch', () => {
    expect(() => serializeGeminiInteraction(LITE, [{ text: 'short', speaker: 'N', voice: 'Kore', style: 'x'.repeat(8192) }])).toThrow('input-token')
  })
})

describe('Gemini planned dialogue and actual dispatch', () => {
  for (const model of [FLASH, LITE]) for (const mode of ['unary', 'stream'] as const) {
    test(`${model} ${mode} single-voice dispatch preserves default, override and reset styles without speaker fields`, async () => {
      process.env['GEMINI_API_KEY'] = 'fixture-key'
      const calls = installMockFetch(call => {
        // The documented single-voice request names only the voice. Live probes on
        // 2026-09-24 rejected the earlier named-speaker request with HTTP 400.
        if (JSON.stringify(call.bodyJson).includes('"speaker":')) return jsonResponse({ error: { code: 400, message: 'Invalid input received.' } }, { status: 400 })
        return mode === 'stream' ? new Response(sse(), { headers: { 'content-type': 'text/event-stream' } }) : jsonResponse(unary())
      })
      const options: TtsOptions = { geminiTtsModels: [model], geminiTtsMode: mode, geminiTtsInstructions: 'Warmly.', ttsSpeakers: ['Narrator=Kore'], ttsDialogueFormat: 'labeled', ttsChunkConcurrency: 1, ttsTurnControls: { 'dialogue-turn-002': { gemini: { instructions: 'Softly.' } }, 'dialogue-turn-003': { gemini: { instructions: null } } }, hostedTtsChunkScheduler: scheduler() }
      const result = await runTtsForTargets('Narrator: Default.\nNarrator: Override.\nNarrator: Reset.', await makeTempDir('gemini-single-style-'), options, collectTtsTargets(options))
      expect(result.metadata[0]?.generationCheckpoint).toBeUndefined()
      expect(calls).toHaveLength(3)
      expect(calls.map(call => call.bodyJson?.['input'])).toEqual([
        [{ type: 'user_input', content: [{ type: 'text', text: 'Default.', annotations: [{ type: 'speech_metadata', style: 'Warmly.' }] }] }],
        [{ type: 'user_input', content: [{ type: 'text', text: 'Override.', annotations: [{ type: 'speech_metadata', style: 'Softly.' }] }] }],
        [{ type: 'user_input', content: [{ type: 'text', text: 'Reset.' }] }],
      ])
      for (const call of calls) expect(call.bodyJson?.['generation_config']).toMatchObject({ speech_config: [{ voice: 'Kore' }] })
    }, 20000)
  }
  test('two prebuilt voices use one native take with reset and override styles', async () => {
    process.env['GEMINI_API_KEY'] = 'fixture-key'
    const calls = installMockFetch(() => jsonResponse(unary()))
    const options: TtsOptions = { geminiTtsModels: [LITE], geminiTtsInstructions: 'Baseline.', ttsSpeakers: ['A=Kore', 'B=Puck'], ttsDialogueFormat: 'labeled', ttsTurnControls: { 'dialogue-turn-001': { gemini: { instructions: null } }, 'dialogue-turn-002': { gemini: { instructions: 'Cheerfully.' } } }, hostedTtsChunkScheduler: scheduler() }
    const text = 'A: Hello.\nB: Welcome.'
    const targets = collectTtsTargets(options)
    const planned = buildPureCurrentTtsRenderPlan({ target: targets[0]!, sourceText: text, ttsOptions: options })
    expect(planned.planned.strategy).toBe('native-dialogue')
    const result = await runTtsForTargets(text, await makeTempDir('gemini-native-'), options, targets)
    expect(result.metadata).toHaveLength(1)
    expect(calls.filter(call => call.method === 'POST')).toHaveLength(1)
    expect(calls[0]?.bodyJson).toMatchObject({ input: [{ content: [
      { annotations: [{ type: 'speech_metadata', speaker: 'A' }] }, { annotations: [{ type: 'speech_metadata', speaker: 'B', style: 'Cheerfully.' }] }
    ] }], generation_config: { speech_config: { mode: 'conversational', speakers: [{ speaker: 'A', voice: 'Kore' }, { speaker: 'B', voice: 'Puck' }] } } })
    expect(JSON.stringify(calls[0]?.bodyJson)).not.toContain('Baseline.')
  }, 20000)
  test('larger casts and custom voices choose segmented rendering', async () => {
    for (const voices of [['Kore', 'Puck', 'Zephyr'], ['Kore', 'voice_custom']]) {
      const options: TtsOptions = { geminiTtsModels: [FLASH], ttsSpeakers: voices.map((voice, i) => `${String.fromCharCode(65 + i)}=${voice}`), ttsDialogueFormat: 'labeled' }
      const text = voices.map((_, i) => `${String.fromCharCode(65 + i)}: Hello.`).join('\n')
      expect(buildPureCurrentTtsRenderPlan({ target: collectTtsTargets(options)[0]!, sourceText: text, ttsOptions: options }).planned.strategy).toBe('segmented')
    }
  })
  test('unsupported per-turn controls fail planning without a provider call', () => {
    const calls = installMockFetch(() => { throw Error('Unexpected network') })
    for (const control of ['speed', 'language', 'seed', 'stability', 'similarityBoost', 'pronunciationDictionaryLocators']) {
      const options: TtsOptions = { geminiTtsModels: [LITE], ttsTurnControls: { 'dialogue-turn-001': { gemini: { [control]: control === 'language' ? 'en' : 1 } } } }
      expect(() => buildPureCurrentTtsRenderPlan({ target: collectTtsTargets(options)[0]!, sourceText: 'No request.', ttsOptions: options })).toThrow()
    }
    expect(calls).toHaveLength(0)
  })
})

for (const model of [FLASH, LITE]) {
  for (const [format, mime, bytes] of [
    ['pcm', 'audio/l16', wav.subarray(44)],
    ['mulaw', 'audio/mulaw', Buffer.alloc(7200, 255)],
    ['alaw', 'audio/alaw', Buffer.alloc(7200, 213)]
  ] as const) {
    test(`${model} dispatches ${format} and retains a decoded WAV container`, async () => {
      process.env['GEMINI_API_KEY'] = 'fixture-key'
      const calls = installMockFetch(() => jsonResponse(unary(bytes.toString('base64'), mime)))
      const result = await runGeminiTts('A format fixture.', await makeTempDir('gemini-format-'), { model, voice: 'Kore', responseFormat: format, hostedTtsChunkScheduler: scheduler() })
      expect(calls[0]?.bodyJson).toMatchObject({ response_format: { type: 'audio', mime_type: mime, sample_rate: 24000 } })
      const retained = Buffer.from(await Bun.file(result.audioPath).arrayBuffer())
      expect(retained.toString('ascii', 0, 4)).toBe('RIFF')
      expect(retained.readUInt32LE(4)).toBe(retained.length - 8)
    })
  }
}

test('incompatible turn formats segment and preserve default, override, and explicit reset through dispatch', async () => {
  process.env['GEMINI_API_KEY'] = 'fixture-key'
  const formats: Record<string, string> = {}
  installMockFetch(call => {
    const mime = (call.bodyJson?.['response_format'] as { mime_type: string }).mime_type
    const input = call.bodyJson?.['input'] as Array<{ content: Array<{ text: string }> }>
    formats[input[0]!.content[0]!.text] = mime
    const bytes = mime === 'audio/wav' ? wav : mime === 'audio/l16' ? wav.subarray(44) : Buffer.alloc(7200, 255)
    return jsonResponse(unary(bytes.toString('base64'), mime))
  })
  const options: TtsOptions = { geminiTtsModels: [LITE], geminiTtsResponseFormat: 'mulaw', ttsSpeakers: ['A=Kore', 'B=Puck'], ttsDialogueFormat: 'labeled', ttsTurnControls: { 'dialogue-turn-002': { gemini: { responseFormat: 'pcm' } }, 'dialogue-turn-003': { gemini: { responseFormat: null } } }, hostedTtsChunkScheduler: scheduler() }
  const text = 'A: Default.\nB: Override.\nA: Reset.'
  const targets = collectTtsTargets(options)
  expect(buildPureCurrentTtsRenderPlan({ target: targets[0]!, sourceText: text, ttsOptions: options }).planned.strategy).toBe('segmented')
  const result = await runTtsForTargets(text, await makeTempDir('gemini-format-reset-'), options, targets)
  expect(result.metadata[0]?.generationCheckpoint).toBeUndefined()
  expect(formats).toEqual({ 'Default.': 'audio/mulaw', 'Override.': 'audio/l16', 'Reset.': 'audio/wav' })
}, 20000)

test('large valid base64 decodes without a regular-expression backtracking limit', () => {
  const bytes = Buffer.alloc(6 * 1024 * 1024, 127)
  expect(decodeGeminiBase64(bytes.toString('base64'))).toEqual(bytes)
  for (const invalid of ['AA=A', 'A===', '=AAA', 'AAAA=', 'AA--', 'AB==']) expect(() => decodeGeminiBase64(invalid)).toThrow()
})

test('stream rejects rate mismatches and explicit provider failure events', async () => {
  await expect(readGeminiSpeechStream(new Response(sse().replace('audio/l16', 'audio/l16;rate=16000'), { headers: { 'content-type': 'text/event-stream' } }), 'audio/l16')).rejects.toThrow('sample rate')
  await expect(readGeminiSpeechStream(new Response('data: {"event_type":"interaction.failed"}\n\n', { headers: { 'content-type': 'text/event-stream' } }), 'audio/l16')).rejects.toThrow('failed')
})

test('native grouping has identical planned and dispatched boundaries for long dialogue', async () => {
  process.env['GEMINI_API_KEY'] = 'fixture-key'
  const options: TtsOptions = { geminiTtsModels: [FLASH], ttsSpeakers: ['A=Kore', 'B=Puck'], ttsDialogueFormat: 'labeled', hostedTtsChunkScheduler: scheduler() }
  const text = Array.from({ length: 12 }, (_, index) => `${index % 2 ? 'B' : 'A'}: ${'An ordinary spoken sentence. '.repeat(25)}`).join('\n')
  const targets = collectTtsTargets(options)
  const plan = buildPureCurrentTtsRenderPlan({ target: targets[0]!, sourceText: text, ttsOptions: options })
  expect(plan.planned.strategy).toBe('native-dialogue')
  expect(plan.planned.slots.length).toBeGreaterThan(1)
  const calls = installMockFetch(() => jsonResponse(unary()))
  const result = await runTtsForTargets(text, await makeTempDir('gemini-long-dialogue-'), options, targets)
  expect(result.metadata[0]?.generationCheckpoint).toBeUndefined()
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(plan.planned.slots.length)
}, 20000)

test('stream dialogue eligibility resolves implicit PCM before comparing per-turn formats', async () => {
  process.env['GEMINI_API_KEY'] = 'fixture-key'
  const options: TtsOptions = { geminiTtsModels: [LITE], geminiTtsMode: 'stream', ttsSpeakers: ['A=Kore', 'B=Puck'], ttsDialogueFormat: 'labeled', ttsTurnControls: { 'dialogue-turn-002': { gemini: { responseFormat: 'wav' } } }, hostedTtsChunkScheduler: scheduler() }
  const text = 'A: Default PCM.\nB: Explicit WAV.'
  const targets = collectTtsTargets(options)
  expect(buildPureCurrentTtsRenderPlan({ target: targets[0]!, sourceText: text, ttsOptions: options }).planned.strategy).toBe('segmented')
  const formats: Record<string, string> = {}
  installMockFetch(call => {
    const body = call.bodyJson as { input: Array<{ content: Array<{ text: string }> }>, response_format: { mime_type: string } }
    const mime = body.response_format.mime_type
    formats[body.input[0]!.content[0]!.text] = mime
    const bytes = mime === 'audio/wav' ? wav : wav.subarray(44)
    return new Response([
      { event_type: 'step.delta', delta: { type: 'audio', mime_type: mime, data: bytes.toString('base64') } },
      { event_type: 'interaction.completed', interaction: { status: 'completed' } }
    ].map(event => 'data: ' + JSON.stringify(event) + '\n\n').join(''), { headers: { 'content-type': 'text/event-stream' } })
  })
  const result = await runTtsForTargets(text, await makeTempDir('gemini-stream-reset-'), options, targets)
  expect(result.metadata[0]?.generationCheckpoint).toBeUndefined()
  expect(formats).toEqual({ 'Default PCM.': 'audio/l16', 'Explicit WAV.': 'audio/wav' })
  options.ttsTurnControls = { 'dialogue-turn-002': { gemini: { responseFormat: 'pcm' } } }
  expect(buildPureCurrentTtsRenderPlan({ target: targets[0]!, sourceText: text, ttsOptions: options }).planned.strategy).toBe('native-dialogue')
}, 20000)

test('chunk planning preserves complete inline pause notation in smart and legacy modes', async () => {
  const { splitGeminiTtsText } = await import('~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-chunks')
  const text = 'A'.repeat(14) + ' <short pause> next. ' + 'B'.repeat(14) + ' <long pause> done.'
  for (const replay of [undefined, 'legacy-v0'] as const) {
    const chunks = splitGeminiTtsText(LITE, { text, speaker: 'N', voice: 'Kore' }, { boundary: 'smart', replay, maxChars: 20 })
    expect(chunks.join(' ')).toBe(text)
    expect(chunks.every(chunk => chunk.length <= 20 && (chunk.includes('<') === chunk.includes('>')))).toBe(true)
  }
})

test('too-small Unicode chunk budgets fail before dispatch instead of stalling', async () => {
  const { splitGeminiTtsText } = await import('~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-chunks')
  expect(() => splitGeminiTtsText(LITE, { text: '😀😀', speaker: 'N', voice: 'Kore' }, { boundary: 'smart', replay: 'legacy-v0', maxChars: 1 })).toThrow('Unicode')
})

// Gemini's documented 8,192-token request limit includes style metadata. Large metadata
// must reduce each request budget without turning paragraph joins into sentence joins.
for (const model of [FLASH, LITE]) test(model + ' transport and artifact integrity: metadata-limited chunks retain paragraph joins', async () => {
  process.env['GEMINI_API_KEY'] = 'fixture-key'
  const calls = installMockFetch(() => jsonResponse(unary()))
  const paragraph = 'The telescope followed a distant star across the dark sky. '.repeat(12).trim()
  const text = Array(4).fill(paragraph).join('\n\n')
  const options: TtsOptions = { geminiTtsModels: [model], geminiTtsVoice: 'Kore', geminiTtsInstructions: 'Speak calmly. '.repeat(200), ...resolveTtsDeliveryOptions({}) }
  const target = collectTtsTargets(options)[0]!
  const output = await makeTempDir('gemini-resolved-chunks-')
  await runTtsForTargets(text, output, options, [target])
  expect(calls).toHaveLength(4)
  for (const call of calls) expect(call.bodyJson).toMatchObject({ model, input: [{ content: [{ type: 'text', text: paragraph, annotations: [{ type: 'speech_metadata', style: options.geminiTtsInstructions }] }] }] })
  const ledgerPath = [...new Bun.Glob('providers/**/audio-run/transform-ledger.json').scanSync(output)][0]!
  const ledger = await Bun.file(join(output, ledgerPath)).json() as { operations: Array<{ kind: string, finalRangeMs: { start: number, end: number } }> }
  expect(ledger.operations.filter(operation => operation.kind === 'pause').map(operation => operation.finalRangeMs.end - operation.finalRangeMs.start)).toEqual([])
}, 20_000)
