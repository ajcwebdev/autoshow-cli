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
  test('buildConfigPatchFromFlags saves hosted image defaults', () => {
    expectConfigPatchRoundTrip({
      'bfl-image': ['flux-2-pro'],
      'replicate-image': ['wan-video/wan-2.7-image'],
      'image-size': '1024x1024',
      'image-format': 'webp'
    }, 'image', {
      bflImage: ['flux-2-pro'],
      replicateImage: ['wan-video/wan-2.7-image'],
      imageSize: '1024x1024',
      imageFormat: 'webp'
    }, { merge: false })
  })

  test('buildConfigPatchFromFlags saves and merges Replicate video defaults', () => {
    expectConfigPatchRoundTrip({
      'replicate-video': ['bytedance/seedance-2.0-fast'],
      'replicate-video-seed': '123',
      'video-generate-audio': false,
      'video-reference-video': ['input/examples/video/reference.mp4'],
      'video-reference-audio': ['input/examples/audio/reference.mp3'],
      'replicate-video-negative-prompt': 'blur',
      'video-duration': '-1'
    }, 'video', {
      replicateVideo: ['bytedance/seedance-2.0-fast'],
      replicateVideoSeed: 123,
      videoGenerateAudio: false,
      videoReferenceVideos: ['input/examples/video/reference.mp4'],
      videoReferenceAudios: ['input/examples/audio/reference.mp3'],
      replicateVideoNegativePrompt: 'blur',
      videoDuration: -1
    })
  })

  test('buildConfigPatchFromFlags saves and merges Speechify, Hume, and Cartesia TTS defaults', () => {
    expectConfigPatchRoundTrip({
      'speechify-tts': ['simba-3.2'],
      'hume-tts': ['octave-2'],
      'cartesia-tts': ['sonic-3.5-2026-05-04'],
      'tts-voice': ['speechify=narrator_voice', 'hume=Studio Voice', 'cartesia=cartesia-voice-id'],
      'tts-language': ['speechify=en-US', 'cartesia=en']
    }, 'tts', {
      speechifyTts: ['simba-3.2'],
      humeTts: ['octave-2'],
      cartesiaTts: ['sonic-3.5-2026-05-04'],
      voice: ['speechify=narrator_voice', 'hume=Studio Voice', 'cartesia=cartesia-voice-id'],
      language: ['speechify=en-US', 'cartesia=en']
    })
  })

  test('buildConfigPatchFromFlags persists safe Mistral defaults but excludes request references', () => {
    expectConfigPatchRoundTrip({
      'mistral-tts': ['voxtral-mini-tts-2603'],
      'tts-voice': 'voice_abc123',
      'tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    }, 'tts', {
      mistralTts: ['voxtral-mini-tts-2603'],
      voice: 'voice_abc123'
    }, { merge: false })
  })

  test('buildConfigPatchFromFlags saves and merges TTS request-control defaults', () => {
    const requestControlFlags = {
      'tts-language': 'en',
      'tts-text-normalization': 'on',
      'tts-instructions': 'Speak with calm narration.',
      'tts-speed': '1.25',
      'elevenlabs-tts-stability': '0.4',
      'elevenlabs-tts-similarity-boost': '0.8',
      'elevenlabs-tts-style': '0.2',
      'elevenlabs-tts-use-speaker-boost': true,
      'elevenlabs-tts-seed': '12345',
      'elevenlabs-tts-pronunciation-dictionary-locator': ['dict_1:version_2', 'dict_3']
    }
    expectConfigPatchRoundTrip(requestControlFlags, 'tts', {
      language: 'en',
      textNormalization: 'on',
      instructions: 'Speak with calm narration.',
      speed: 1.25,
      elevenlabsTtsStability: 0.4,
      elevenlabsTtsSimilarityBoost: 0.8,
      elevenlabsTtsStyle: 0.2,
      elevenlabsTtsUseSpeakerBoost: true,
      elevenlabsTtsSeed: 12345,
      elevenlabsTtsPronunciationDictionaryLocators: ['dict_1:version_2', 'dict_3']
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
