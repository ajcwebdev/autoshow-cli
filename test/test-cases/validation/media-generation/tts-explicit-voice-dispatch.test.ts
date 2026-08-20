import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import type { TtsOptions, TtsTarget, TtsTargetInvocation, TtsTargetInvocationControls, TtsVoiceMatrixEnvKey, VoiceMatrixCase } from '~/types'
import { createMockWavBase64, createMockWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

const MATRIX_ENV_KEYS = [
  'ELEVENLABS_API_KEY',
  'SPEECHIFY_API_KEY',
  'HUME_API_KEY',
  'CARTESIA_API_KEY',
  'MISTRAL_API_KEY',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'XAI_API_KEY',
  'MINIMAX_API_KEY',
  'DEEPGRAM_API_KEY',
  'GEMINI_API_KEY'
] as const satisfies readonly TtsVoiceMatrixEnvKey[]

const tempDirs = setupContractSuiteLifecycle({
  envKeys: MATRIX_ENV_KEYS,
  tempPrefix: 'autoshow-tts-explicit-voice-'
})

const audioBytes = createMockWavBytes()
const audioBase64 = createMockWavBase64()

const byteResponse = (): Response => new Response(audioBytes, {
  status: 200,
  headers: { 'content-type': 'audio/wav' }
})

const jsonAudioResponse = (): Response => Response.json({ audio_data: audioBase64 })

const cases: readonly VoiceMatrixCase[] = [
  {
    provider: 'openai',
    envKey: 'OPENAI_API_KEY',
    flags: {
      'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
      'openai-voice': 'ash',
      'openai-tts-speed': '0.8'
    },
    capturedVoice: 'ash',
    invocationVoices: ['alloy', 'onyx', 'alloy'],
    invocationControls: [{ speed: 0.8 }, { speed: 1.2 }, { speed: 0.8 }],
    respond: byteResponse,
    readSerializedVoice: call => String(call.bodyJson?.['voice'] ?? ''),
    readSerializedControl: call => call.bodyJson?.['speed']
  },
  {
    provider: 'elevenlabs',
    envKey: 'ELEVENLABS_API_KEY',
    flags: {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-voice': 'voice-captured',
      'elevenlabs-tts-speed': '0.8'
    },
    capturedVoice: 'voice-captured',
    invocationVoices: ['voice-alice', 'voice-bob', 'voice-alice'],
    invocationControls: [{ speed: 0.8 }, { speed: 1.1 }, { speed: 0.8 }],
    respond: byteResponse,
    readSerializedVoice: call => {
      const match = /\/text-to-speech\/([^/?]+)/.exec(call.url)
      return match?.[1] ? decodeURIComponent(match[1]) : undefined
    },
    readSerializedControl: call => {
      const settings = call.bodyJson?.['voice_settings'] as Record<string, unknown> | undefined
      return settings?.['speed']
    }
  },
  {
    provider: 'minimax',
    envKey: 'MINIMAX_API_KEY',
    flags: {
      'minimax-tts': 'speech-2.8-hd',
      'minimax-tts-voice': 'voice-captured',
      'minimax-tts-speed': '0.8'
    },
    capturedVoice: 'voice-captured',
    invocationVoices: ['voice-alice', 'voice-bob', 'voice-alice'],
    invocationControls: [{ speed: 0.8 }, { speed: 1.2 }, { speed: 0.8 }],
    respond: call => {
      if (call.url.endsWith('/v1/t2a_async_v2')) {
        return Response.json({
          task_id: 'task-id',
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url.includes('/v1/query/t2a_async_query_v2')) {
        return Response.json({
          status: 2,
          file_id: 'speech-file-id',
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url.includes('/v1/files/retrieve_content')) return byteResponse()
      throw new Error(`Unexpected MiniMax request: ${call.method} ${call.url}`)
    },
    isSynthesisRequest: call => call.url.endsWith('/v1/t2a_async_v2'),
    readSerializedVoice: call => {
      const voiceSetting = call.bodyJson?.['voice_setting'] as Record<string, unknown> | undefined
      return String(voiceSetting?.['voice_id'] ?? '')
    },
    readSerializedControl: call => {
      const voiceSetting = call.bodyJson?.['voice_setting'] as Record<string, unknown> | undefined
      return voiceSetting?.['speed']
    }
  },
  {
    provider: 'groq',
    envKey: 'GROQ_API_KEY',
    flags: {
      'groq-tts': 'canopylabs/orpheus-v1-english',
      'groq-voice': 'troy'
    },
    capturedVoice: 'troy',
    invocationVoices: ['autumn', 'diana', 'autumn'],
    invocationControls: [{ speed: 0.8 }, { speed: 1.2 }, { speed: 0.8 }],
    respond: byteResponse,
    readSerializedVoice: call => String(call.bodyJson?.['voice'] ?? ''),
    readSerializedControl: call => call.bodyJson?.['speed']
  },
  {
    provider: 'grok',
    envKey: 'XAI_API_KEY',
    flags: {
      'grok-tts': 'grok-tts',
      'grok-tts-voice': 'deadbeef'
    },
    capturedVoice: 'deadbeef',
    invocationVoices: ['ab12cd34', 'ef56ab78', 'ab12cd34'],
    invocationControls: [{ textNormalization: false }, { textNormalization: true }, { textNormalization: false }],
    respond: byteResponse,
    readSerializedVoice: call => String(call.bodyJson?.['voice_id'] ?? ''),
    readSerializedControl: call => call.bodyJson?.['text_normalization']
  },
  {
    provider: 'mistral',
    envKey: 'MISTRAL_API_KEY',
    flags: {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-voice': 'voice-captured'
    },
    capturedVoice: 'voice-captured',
    invocationVoices: ['voice-alice', 'voice-bob', 'voice-alice'],
    invocationControls: [{ responseFormat: 'wav' }, { responseFormat: 'flac' }, { responseFormat: 'wav' }],
    respond: jsonAudioResponse,
    readSerializedVoice: call => String(call.bodyJson?.['voice_id'] ?? ''),
    readSerializedControl: call => call.bodyJson?.['response_format']
  },
  {
    provider: 'gemini',
    envKey: 'GEMINI_API_KEY',
    flags: {
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'gemini-voice': 'Zephyr'
    },
    capturedVoice: 'Zephyr',
    invocationVoices: ['Kore', 'Puck', 'Kore'],
    invocationControls: [{ languageCode: 'en-US' }, { languageCode: 'en-GB' }, { languageCode: 'en-US' }],
    respond: () => Response.json({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType: 'audio/wav', data: audioBase64 } }]
        }
      }]
    }),
    readSerializedVoice: call => {
      const generationConfig = call.bodyJson?.['generationConfig'] as Record<string, unknown> | undefined
      const speechConfig = generationConfig?.['speechConfig'] as Record<string, unknown> | undefined
      const voiceConfig = speechConfig?.['voiceConfig'] as Record<string, unknown> | undefined
      const prebuilt = voiceConfig?.['prebuiltVoiceConfig'] as Record<string, unknown> | undefined
      return String(prebuilt?.['voiceName'] ?? '')
    },
    readSerializedControl: call => {
      const generationConfig = call.bodyJson?.['generationConfig'] as Record<string, unknown> | undefined
      const speechConfig = generationConfig?.['speechConfig'] as Record<string, unknown> | undefined
      return speechConfig?.['languageCode']
    }
  },
  {
    provider: 'deepgram',
    envKey: 'DEEPGRAM_API_KEY',
    flags: {
      'deepgram-tts': 'aura-2-thalia-en',
      'deepgram-voice': 'aura-2-thalia-en',
      'deepgram-tts-speed': '0.8'
    },
    capturedVoice: 'aura-2-thalia-en',
    invocationVoices: ['aura-2-andromeda-en', 'aura-2-apollo-en', 'aura-2-andromeda-en'],
    invocationControls: [{ speed: 0.8 }, { speed: 1.2 }, { speed: 0.8 }],
    respond: byteResponse,
    readSerializedVoice: call => new URL(call.url).searchParams.get('model') ?? undefined,
    readSerializedControl: call => Number(new URL(call.url).searchParams.get('speed'))
  },
  {
    provider: 'speechify',
    envKey: 'SPEECHIFY_API_KEY',
    flags: {
      'speechify-tts': 'simba-3.2',
      'speechify-voice': 'voice-captured',
      'speechify-tts-language': 'en-US'
    },
    capturedVoice: 'voice-captured',
    invocationVoices: ['beatrice_32', 'dominic_32', 'beatrice_32'],
    invocationControls: [{ language: 'en-US' }, { language: 'en-GB' }, { language: 'en-US' }],
    respond: jsonAudioResponse,
    readSerializedVoice: call => String(call.bodyJson?.['voice_id'] ?? ''),
    readSerializedControl: call => call.bodyJson?.['language']
  },
  {
    provider: 'hume',
    envKey: 'HUME_API_KEY',
    flags: {
      'hume-tts': 'octave-2',
      'hume-tts-voice': 'Captured Voice'
    },
    capturedVoice: 'Captured Voice',
    invocationVoices: [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
      '123e4567-e89b-12d3-a456-426614174000'
    ],
    invocationControls: [{ speed: 0.9 }, { speed: 1.1 }, { speed: 0.9 }],
    respond: byteResponse,
    readSerializedVoice: call => {
      const utterances = call.bodyJson?.['utterances'] as Array<Record<string, unknown>> | undefined
      const voice = utterances?.[0]?.['voice'] as Record<string, unknown> | undefined
      return String(voice?.['id'] ?? voice?.['name'] ?? '')
    },
    readSerializedControl: call => {
      const utterances = call.bodyJson?.['utterances'] as Array<Record<string, unknown>> | undefined
      return utterances?.[0]?.['speed']
    }
  },
  {
    provider: 'cartesia',
    envKey: 'CARTESIA_API_KEY',
    flags: {
      'cartesia-tts': 'sonic-3.5-2026-05-04',
      'cartesia-tts-voice': 'voice-captured'
    },
    capturedVoice: 'voice-captured',
    invocationVoices: ['voice-alice', 'voice-bob', 'voice-alice'],
    invocationControls: [{ language: 'en' }, { language: 'fr' }, { language: 'en' }],
    respond: byteResponse,
    readSerializedVoice: call => {
      const voice = call.bodyJson?.['voice'] as Record<string, unknown> | undefined
      return String(voice?.['id'] ?? '')
    },
    readSerializedControl: call => call.bodyJson?.['language']
  }
]

const collectOneTarget = (
  matrixCase: VoiceMatrixCase
): { options: TtsOptions, target: TtsTarget } => {
  const options = buildOptsFromFlags(false, matrixCase.flags)
  const targets = collectTtsTargets(options)
  const target = requireDefined(
    targets.find(candidate => candidate.service === matrixCase.provider),
    `${matrixCase.provider} TTS target`
  )
  expect(target.voice).toBe(matrixCase.capturedVoice)
  return { options, target }
}

const runInvocationMatrix = async (
  target: TtsTarget,
  options: TtsOptions,
  root: string,
  voices: readonly [string, string, string],
  controls: readonly [TtsTargetInvocationControls, TtsTargetInvocationControls, TtsTargetInvocationControls]
): Promise<void> => {
  for (let index = 0; index < voices.length; index += 1) {
    const outputDir = join(root, `turn-${index}`)
    await mkdir(outputDir, { recursive: true })
    const voice = voices[index] as string
    const invocation: TtsTargetInvocation = Object.freeze({
      sourceId: `source-turn-${index}`,
      sourceIndex: index,
      speaker: index === 1 ? 'Bob' : 'Alice',
      voice: Object.freeze({ kind: 'id' as const, value: voice }),
      controls: Object.freeze({ ...controls[index] }),
      signal: new AbortController().signal
    })
    await target.run(`Turn ${index}.`, outputDir, options, invocation)
  }
}

describe('explicit TTS target voice dispatch', () => {
  for (const matrixCase of cases) {
    test(`${matrixCase.provider} serializes invocation A/X, B/Y, A/X instead of captured defaults`, async () => {
      const root = await tempDirs.make()
      process.env[matrixCase.envKey] = `${matrixCase.provider}-test-key`
      const calls = installMockFetch(matrixCase.respond)
      const { options, target } = collectOneTarget(matrixCase)

      await runInvocationMatrix(target, options, root, matrixCase.invocationVoices, matrixCase.invocationControls)

      const synthesisCalls = matrixCase.isSynthesisRequest
        ? calls.filter(matrixCase.isSynthesisRequest)
        : calls
      const serializedVoices = synthesisCalls.map(matrixCase.readSerializedVoice)
      const serializedControls = synthesisCalls.map(matrixCase.readSerializedControl)
      expect(serializedVoices).toEqual([...matrixCase.invocationVoices])
      expect(serializedVoices).not.toContain(matrixCase.capturedVoice)
      expect(serializedControls).toEqual(matrixCase.invocationControls.map(control => Object.values(control)[0]))
      expect(serializedControls).not.toEqual([
        serializedControls[0],
        serializedControls[0],
        serializedControls[0]
      ])
    }, 20_000)
  }

  test('hume resolves an explicit named turn voice against the Hume voice library', async () => {
    const root = await tempDirs.make()
    const outputDir = join(root, 'turn-0')
    await mkdir(outputDir, { recursive: true })
    process.env['HUME_API_KEY'] = 'hume-test-key'
    const calls = installMockFetch(byteResponse)
    const options = buildOptsFromFlags(false, {
      'hume-tts': 'octave-2',
      'hume-tts-voice': 'Captured Voice'
    })
    const target = requireDefined(
      collectTtsTargets(options).find(candidate => candidate.service === 'hume'),
      'Hume TTS target'
    )

    await target.run('A named custom voice.', outputDir, options, Object.freeze({
      sourceId: 'source-turn-0',
      sourceIndex: 0,
      speaker: 'Alice',
      voice: Object.freeze({ kind: 'id' as const, value: 'Alice Studio Voice' }),
      controls: Object.freeze({}),
      signal: new AbortController().signal
    }))

    const utterances = calls[0]?.bodyJson?.['utterances'] as Array<Record<string, unknown>> | undefined
    expect(utterances?.[0]?.['voice']).toEqual({
      name: 'Alice Studio Voice',
      provider: 'HUME_AI'
    })
  }, 10_000)
})
