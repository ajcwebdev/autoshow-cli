import { describe, expect, test } from 'bun:test'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'

const expectConfigPatchRoundTrip = (
  flags: Record<string, unknown>,
  domain: 'image' | 'video' | 'tts',
  expectedValues: Record<string, unknown>,
  options: { merge?: boolean } = {}
): void => {
  const patch = buildConfigPatchFromFlags(flags, new Set(Object.keys(flags)))
  expect(patch).toEqual({ defaults: { [domain]: expectedValues } })

  if (options.merge !== false) {
    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject(flags)
  }
}

describe('config image and TTS default contracts', () => {
  test('explicit all-provider shortcuts suppress saved provider selections while retaining shared controls', () => {
    const config = { defaults: {
      tts: { elevenlabsTts: ['eleven_v3'], speed: '1.2' },
      image: { openaiImage: ['gpt-image-2.5-flare'], count: 2 },
      video: { grokVideo: ['grok-imagine-video-1.5'], duration: 8 },
      music: { geminiMusic: ['lyria-3.5'], duration: 20 }
    } } as Parameters<typeof mergeConfigIntoRawFlags>[1]
    for (const [scope, savedSelector, sharedControl, value] of [
      ['tts', 'elevenlabs-tts', 'tts-speed', '1.2'],
      ['image', 'openai-image', 'count', '2'],
      ['video', 'grok-video', 'duration', '8'],
      ['music', 'gemini-music', 'duration', '20']
    ] as const) {
      const allFlag = `all-${scope}`
      const flags = mergeConfigIntoRawFlags({ [allFlag]: true }, config, new Set([allFlag]), scope)
      expect(flags[savedSelector]).toBeUndefined()
      expect(flags[sharedControl]).toBe(value)
    }
  })

  test('generic video defaults persist under the existing config keys', () => {
    expectConfigPatchRoundTrip({ seed: '0', 'negative-prompt': 'blur' }, 'video', {
      replicateVideoSeed: 0, replicateVideoNegativePrompt: 'blur'
    })
  })

  test('buildConfigPatchFromFlags saves hosted image defaults', () => {
    expectConfigPatchRoundTrip({
      'replicate-image': ['alibaba/qwen-image-3'],
    }, 'image', {
      replicateImage: ['alibaba/qwen-image-3'],
    }, { merge: false })
  })

  test('buildConfigPatchFromFlags saves and merges Replicate video defaults', () => {
    expectConfigPatchRoundTrip({
      'replicate-video': ['bytedance/seedance-2.5'],
      'replicate-video-seed': '123',
      'replicate-video-negative-prompt': 'blur',
    }, 'video', {
      replicateVideo: ['bytedance/seedance-2.5'],
      replicateVideoSeed: 123,
      replicateVideoNegativePrompt: 'blur',
    })
  })

  test('buildConfigPatchFromFlags saves and merges Soniox TTS defaults', () => {
    expectConfigPatchRoundTrip({
      'soniox-tts': ['tts-rt-v2'],
      'tts-voice': ['soniox=narrator_voice'],
      'tts-language': ['soniox=en']
    }, 'tts', {
      sonioxTts: ['tts-rt-v2'],
      voice: ['soniox=narrator_voice'],
      language: ['soniox=en']
    })
  })


  test('buildConfigPatchFromFlags saves and merges TTS request-control defaults', () => {
    const requestControlFlags = {
      'tts-language': 'en',
      'tts-text-normalization': 'on',
      'tts-instructions': 'Speak with calm narration.',
      'tts-speed': '1.25',
      'tts-stability': 'elevenlabs=0.4',
      'tts-similarity': 'elevenlabs=0.8',
      'tts-style': 'elevenlabs=0.2',
      'tts-speaker-boost': 'elevenlabs=true',
      'tts-seed': 'elevenlabs=12345',
      'tts-pronunciation-dictionary': ['elevenlabs=dict_1:version_2', 'elevenlabs=dict_3']
    }
    expectConfigPatchRoundTrip(requestControlFlags, 'tts', {
      language: 'en',
      textNormalization: 'on',
      instructions: 'Speak with calm narration.',
      speed: '1.25',
      stability: 'elevenlabs=0.4',
      similarity: 'elevenlabs=0.8',
      style: 'elevenlabs=0.2',
      speakerBoost: 'elevenlabs=true',
      seed: 'elevenlabs=12345',
      pronunciationDictionary: ['elevenlabs=dict_1:version_2', 'elevenlabs=dict_3']
    })
  })

  test('buildConfigPatchFromFlags saves generic --tts-voice as defaults.tts.voice', () => {
    expectConfigPatchRoundTrip({
      'tts-voice': 'alloy'
    }, 'tts', {
      voice: 'alloy'
    })
  })
})
