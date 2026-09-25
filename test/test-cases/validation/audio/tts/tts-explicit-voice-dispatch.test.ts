import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/command-shared/hosted-concurrency-coordinator'
import { createHostedTtsChunkScheduler } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-chunk-scheduler'
import type { TtsOptions, TtsTarget, TtsTargetInvocation, TtsTargetInvocationControls, TtsVoiceMatrixEnvKey, VoiceMatrixCase } from '~/types'
import { createMockWavBase64, createMockWavBytes } from '../../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../../test-utils/value-assertions'

const MATRIX_ENV_KEYS = [
  'ELEVENLABS_API_KEY',
  'MISTRAL_API_KEY',
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'INWORLD_API_KEY'
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
      'tts-voice': 'ash',
      'tts-speed': '0.8'
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
      'tts-voice': 'voice-captured',
      'tts-stability': 'elevenlabs=0.5'
    },
    capturedVoice: 'voice-captured',
    invocationVoices: ['voice-alice', 'voice-bob', 'voice-alice'],
    invocationControls: [{ stability: 0.5 }, { stability: 0 }, { stability: 0.5 }],
    respond: byteResponse,
    readSerializedVoice: call => {
      const match = /\/text-to-speech\/([^/?]+)/.exec(call.url)
      return match?.[1] ? decodeURIComponent(match[1]) : undefined
    },
    readSerializedControl: call => {
      const settings = call.bodyJson?.['voice_settings'] as Record<string, unknown> | undefined
      return settings?.['stability']
    }
  },
  {
    provider: 'grok',
    envKey: 'XAI_API_KEY',
    flags: {
      'grok-tts': 'grok-tts',
      'tts-voice': 'deadbeef'
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
      'tts-voice': 'voice-captured'
    },
    capturedVoice: 'voice-captured',
    invocationVoices: ['voice-alice', 'voice-bob', 'voice-alice'],
    invocationControls: [{ responseFormat: 'wav' }, { responseFormat: 'flac' }, { responseFormat: 'wav' }],
    respond: jsonAudioResponse,
    readSerializedVoice: call => String(call.bodyJson?.['voice_id'] ?? ''),
    readSerializedControl: call => call.bodyJson?.['response_format']
  },

]

const collectOneTarget = (
  matrixCase: VoiceMatrixCase
): { options: TtsOptions, target: TtsTarget } => {
  const options: TtsOptions = buildOptsFromFlags(matrixCase.flags)
  options.hostedTtsChunkScheduler = createHostedTtsChunkScheduler({
    maxConcurrency: 2,
    concurrencyMode: 'immediate',
    hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: 'immediate' })
  })
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

})
