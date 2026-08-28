import { describe, expect, test } from 'bun:test'
import { runTts } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { parseSpeakerVoiceMappings } from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'
import {
  resolveGeminiDialogueStrategy
} from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-gemini/gemini-tts-config'
import { runGeminiTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-gemini/run-gemini-tts'
import type { MockFetchCall } from '~/types'
import { createMockWavBase64 } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['GEMINI_API_KEY'],
  tempPrefix: 'autoshow-gemini-dialogue-planning-'
})

const wavBase64 = createMockWavBase64()

const installGeminiAudioFetch = (): MockFetchCall[] => installMockFetch(() => Response.json({
  candidates: [{
    content: {
      parts: [{ inlineData: { mimeType: 'audio/wav', data: wavBase64 } }]
    }
  }]
}))

const readRequestText = (call: MockFetchCall): string => {
  const contents = call.bodyJson?.['contents'] as Array<Record<string, unknown>> | undefined
  const parts = contents?.[0]?.['parts'] as Array<Record<string, unknown>> | undefined
  return String(parts?.[0]?.['text'] ?? '')
}

const readSpeechConfig = (call: MockFetchCall): Record<string, unknown> => {
  const generationConfig = call.bodyJson?.['generationConfig'] as Record<string, unknown> | undefined
  return generationConfig?.['speechConfig'] as Record<string, unknown> ?? {}
}

const readSingleVoice = (call: MockFetchCall): string => {
  const voiceConfig = readSpeechConfig(call)['voiceConfig'] as Record<string, unknown> | undefined
  const prebuilt = voiceConfig?.['prebuiltVoiceConfig'] as Record<string, unknown> | undefined
  return String(prebuilt?.['voiceName'] ?? '')
}

describe('Gemini dialogue strategy planning', () => {
  test('strict native accepts exactly two registered speakers and auto falls back otherwise', () => {
    expect(resolveGeminiDialogueStrategy(1, 'auto')).toBe('segment-and-concat')
    expect(resolveGeminiDialogueStrategy(2, 'auto')).toBe('native')
    expect(resolveGeminiDialogueStrategy(3, 'auto')).toBe('segment-and-concat')
    expect(resolveGeminiDialogueStrategy(3, 'segmented')).toBe('segment-and-concat')
    expect(() => resolveGeminiDialogueStrategy(0, 'native')).toThrow('exactly two registered speakers')
    expect(() => resolveGeminiDialogueStrategy(1, 'native')).toThrow('exactly two registered speakers')
    expect(() => resolveGeminiDialogueStrategy(3, 'native')).toThrow('exactly two registered speakers')
  })

  test('direct strict-native execution rejects one or three speakers before a provider call', async () => {
    const calls = installGeminiAudioFetch()
    const oneSpeakerDir = await tempDirs.make()
    const threeSpeakerDir = await tempDirs.make()

    await expect(runGeminiTts('Host: Hello.', oneSpeakerDir, {
      model: 'gemini-3.1-flash-tts-preview',
      speakerVoiceRegistry: parseSpeakerVoiceMappings(['Host=Kore'])
    })).rejects.toThrow('exactly two registered speakers')
    await expect(runGeminiTts('A: One.\nB: Two.\nC: Three.', threeSpeakerDir, {
      model: 'gemini-3.1-flash-tts-preview',
      speakerVoiceRegistry: parseSpeakerVoiceMappings(['A=Kore', 'B=Puck', 'C=Charon'])
    })).rejects.toThrow('exactly two registered speakers')

    expect(calls).toHaveLength(0)
  })

  test('direct strict-native execution rejects an oversized turn before a provider call', async () => {
    const calls = installGeminiAudioFetch()
    const dir = await tempDirs.make()
    const registry = parseSpeakerVoiceMappings(['Host=Kore', 'Guest=Puck'])

    await expect(runGeminiTts(
      `Host: ${'A'.repeat(2001)}\nGuest: Short reply.`,
      dir,
      {
        model: 'gemini-3.1-flash-tts-preview',
        speakerVoiceRegistry: registry
      }
    )).rejects.toThrow('exceeding the 2000-character request limit')

    expect(calls).toHaveLength(0)
  })

  test('generic dialogue with no valid turns fails before target setup or provider calls', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installGeminiAudioFetch()
    const dir = await tempDirs.make()
    const options = buildOptsFromFlags({
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'tts-dialogue-format': 'screenplay',
      'tts-speaker': ['Host=Kore', 'Guest=Puck']
    })

    await expect(runTts('INT. EMPTY ROOM - NIGHT\nA lamp glows.', dir, options))
      .rejects.toThrow('found no dialogue turns')
    expect(calls).toHaveLength(0)
  })

  test('auto routes one registered speaker through explicit single-turn serialization', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installGeminiAudioFetch()
    const dir = await tempDirs.make()
    const options = buildOptsFromFlags({
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Host=Kore']
    })
    const target = collectTtsTargets(options)[0]
    expect(target?.multiSpeakerStrategy).toBe('segment-and-concat')

    await runTts('Host: Hello from one speaker.', dir, options)

    expect(calls).toHaveLength(1)
    expect(readRequestText(calls[0] as MockFetchCall)).toBe('Hello from one speaker.')
    expect(readSingleVoice(calls[0] as MockFetchCall)).toBe('Kore')
    expect(readSpeechConfig(calls[0] as MockFetchCall)).not.toHaveProperty('multiSpeakerVoiceConfig')
  }, 10_000)

  test('auto routes three registered speakers through explicit per-turn voices', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installGeminiAudioFetch()
    const dir = await tempDirs.make()
    const options = buildOptsFromFlags({
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Alice=Kore', 'Bob=Puck', 'Cara=Charon']
    })
    const target = collectTtsTargets(options)[0]
    expect(target?.multiSpeakerStrategy).toBe('segment-and-concat')

    await runTts('Alice: First.\nBob: Second.\nCara: Third.', dir, options)

    expect(new Map(calls.map(call => [readRequestText(call), readSingleVoice(call)]))).toEqual(new Map([
      ['First.', 'Kore'],
      ['Second.', 'Puck'],
      ['Third.', 'Charon']
    ]))
    expect(calls.every(call => !('multiSpeakerVoiceConfig' in readSpeechConfig(call)))).toBe(true)
  }, 10_000)

  test('exactly two registered speakers use native dialogue with normalized labels', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installGeminiAudioFetch()
    const dir = await tempDirs.make()
    const options = buildOptsFromFlags({
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'tts-dialogue-format': 'screenplay',
      'tts-speaker': ['Host=Kore', 'Guest=Puck']
    })
    const target = collectTtsTargets(options)[0]
    expect(target?.multiSpeakerStrategy).toBe('native')

    await runTts('HOST\nHello.\n\nGUEST\nHi there.', dir, options)

    expect(calls).toHaveLength(1)
    expect(readRequestText(calls[0] as MockFetchCall)).toBe('Host: Hello.\nGuest: Hi there.')
    const multiSpeaker = readSpeechConfig(calls[0] as MockFetchCall)['multiSpeakerVoiceConfig'] as Record<string, unknown>
    expect(multiSpeaker['speakerVoiceConfigs']).toEqual([
      { speaker: 'Host', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      { speaker: 'Guest', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
    ])
  }, 10_000)

  test('auto preflight routes an oversized native turn through segmented single-voice requests', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installGeminiAudioFetch()
    const dir = await tempDirs.make()
    const options = buildOptsFromFlags({
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Host=Kore', 'Guest=Puck']
    })

    await runTts(`Host: ${'A'.repeat(2001)}\nGuest: Short reply.`, dir, options)

    expect(calls).toHaveLength(3)
    expect(calls.every(call => !('multiSpeakerVoiceConfig' in readSpeechConfig(call)))).toBe(true)
    const hostCalls = calls.filter(call => readSingleVoice(call) === 'Kore')
    expect(hostCalls).toHaveLength(2)
    expect(hostCalls.map(readRequestText).map(text => text.length).sort((a, b) => a - b)).toEqual([1, 2000])
    expect(hostCalls.every(call => /^A+$/.test(readRequestText(call)))).toBe(true)
    const guestCalls = calls.filter(call => readSingleVoice(call) === 'Puck')
    expect(guestCalls.map(readRequestText)).toEqual(['Short reply.'])
  }, 10_000)

  test('native request partitioning keeps every normalized turn whole', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installGeminiAudioFetch()
    const dir = await tempDirs.make()
    const options = buildOptsFromFlags({
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Host=Kore', 'Guest=Puck']
    })
    const turns = [
      `Host: ${'A'.repeat(1100)}`,
      `Guest: ${'B'.repeat(1100)}`,
      `Host: ${'C'.repeat(1100)}`
    ]

    await runTts(turns.join('\n'), dir, options)

    const requestTexts = calls.map(readRequestText)
    expect(requestTexts).toEqual(turns)
    expect(requestTexts.every(text => /^(?:Host|Guest): /.test(text))).toBe(true)
    expect(requestTexts.every(text => text.length <= 2000)).toBe(true)
  }, 10_000)

  test('ordinary single-voice Gemini synthesis remains unchanged', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installGeminiAudioFetch()
    const dir = await tempDirs.make()
    const options = buildOptsFromFlags({
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'tts-voice': 'Kore'
    })

    await runTts('Ordinary single-speaker narration.', dir, options)

    expect(calls).toHaveLength(1)
    expect(readRequestText(calls[0] as MockFetchCall)).toBe('Ordinary single-speaker narration.')
    expect(readSingleVoice(calls[0] as MockFetchCall)).toBe('Kore')
    expect(readSpeechConfig(calls[0] as MockFetchCall)).not.toHaveProperty('multiSpeakerVoiceConfig')
  }, 10_000)
})
