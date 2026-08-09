import { describe, expect, test } from 'bun:test'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'

const expectConfigPatchRoundTrip = (
  flags: Record<string, unknown>,
  domain: 'image' | 'video' | 'tts',
  expectedValues: Record<string, unknown>,
  options: { merge?: boolean } = {}
): void => {
  const patch = buildConfigPatchFromFlags(flags, new Set(Object.keys(flags)))
  expect(patch).toEqual({ defaults: { post: { [domain]: expectedValues } } })

  if (options.merge !== false) {
    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject(flags)
  }
}

describe('config image and TTS default contracts', () => {
  test('buildConfigPatchFromFlags saves hosted image defaults', () => {
    expectConfigPatchRoundTrip({
      'bfl-image': ['flux-2-pro'],
      'recraft-image': ['recraftv4_1'],
      'replicate-image': ['wan-video/wan-2.7-image'],
      'image-size': '1024x1024',
      'image-format': 'webp'
    }, 'image', {
      bflImage: ['flux-2-pro'],
      recraftImage: ['recraftv4_1'],
      replicateImage: ['wan-video/wan-2.7-image'],
      imageSize: '1024x1024',
      imageFormat: 'webp'
    }, { merge: false })
  })

  test('buildConfigPatchFromFlags saves and merges Replicate video defaults', () => {
    expectConfigPatchRoundTrip({
      'replicate-video': ['wan-video/wan-2.7-t2v'],
      'replicate-video-seed': '123',
      'replicate-video-generate-audio': false,
      'replicate-video-reference-video': ['input/examples/video/reference.mp4'],
      'replicate-video-reference-audio': ['input/examples/audio/reference.mp3'],
      'replicate-video-negative-prompt': 'blur',
      'replicate-video-audio': 'input/examples/audio/narration.wav',
      'replicate-video-prompt-expansion': true,
      'video-duration': '-1'
    }, 'video', {
      replicateVideo: ['wan-video/wan-2.7-t2v'],
      replicateVideoSeed: 123,
      replicateVideoGenerateAudio: false,
      replicateVideoReferenceVideos: ['input/examples/video/reference.mp4'],
      replicateVideoReferenceAudios: ['input/examples/audio/reference.mp3'],
      replicateVideoNegativePrompt: 'blur',
      replicateVideoAudio: 'input/examples/audio/narration.wav',
      replicateVideoPromptExpansion: true,
      videoDuration: -1
    })
  })

  test('buildConfigPatchFromFlags saves and merges Speechify, Hume, and Cartesia TTS defaults', () => {
    expectConfigPatchRoundTrip({
      'speechify-tts': ['simba-3.2'],
      'speechify-voice': 'narrator_voice',
      'speechify-tts-audio-format': 'wav',
      'speechify-tts-language': 'en-US',
      'hume-tts': ['octave-2'],
      'hume-tts-voice': 'Studio Voice',
      'hume-tts-voice-provider': 'CUSTOM_VOICE',
      'cartesia-tts': ['sonic-3.5-2026-05-04'],
      'cartesia-tts-voice': 'cartesia-voice-id',
      'cartesia-tts-language': 'en'
    }, 'tts', {
      speechifyTts: ['simba-3.2'],
      speechifyVoice: 'narrator_voice',
      speechifyTtsAudioFormat: 'wav',
      speechifyTtsLanguage: 'en-US',
      humeTts: ['octave-2'],
      humeTtsVoice: 'Studio Voice',
      humeTtsVoiceProvider: 'CUSTOM_VOICE',
      cartesiaTts: ['sonic-3.5-2026-05-04'],
      cartesiaTtsVoice: 'cartesia-voice-id',
      cartesiaTtsLanguage: 'en'
    })
  })

  test('buildConfigPatchFromFlags saves and merges Mistral TTS defaults', () => {
    expectConfigPatchRoundTrip({
      'mistral-tts': ['voxtral-mini-tts-2603'],
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'mistral-tts-voice-name': 'AutoShow Saved Voice'
    }, 'tts', {
      mistralTts: ['voxtral-mini-tts-2603'],
      mistralTtsVoice: 'voice_abc123',
      mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
      mistralTtsVoiceName: 'AutoShow Saved Voice'
    })
  })

  test('buildConfigPatchFromFlags saves and merges MiniMax TTS voice defaults', () => {
    expectConfigPatchRoundTrip({
      'minimax-tts': ['speech-2.8-turbo'],
      'minimax-tts-voice': 'English_expressive_narrator'
    }, 'tts', {
      minimaxTts: ['speech-2.8-turbo'],
      minimaxTtsVoice: 'English_expressive_narrator'
    })
  })

  test('buildConfigPatchFromFlags saves and merges TTS request-control defaults', () => {
    const requestControlFlags = {
      'grok-tts-language': 'ar-SA',
      'grok-tts-text-normalization': true,
      'openai-tts-instructions': 'Speak with calm narration.',
      'openai-tts-speed': '1.25',
      'minimax-tts-language-boost': 'English',
      'minimax-tts-speed': '1.2',
      'minimax-tts-volume': '2.5',
      'minimax-tts-pitch': '-2',
      'minimax-tts-emotion': 'calm',
      'minimax-tts-english-normalization': true,
      'minimax-tts-pronunciation': ['AutoShow/auto show', 'TTS/tee tee ess'],
      'deepgram-tts-encoding': 'linear16',
      'deepgram-tts-container': 'wav',
      'deepgram-tts-bit-rate': '128000',
      'deepgram-tts-sample-rate': '24000',
      'deepgram-tts-speed': '1.1',
      'elevenlabs-tts-output-format': 'mp3_22050_32',
      'elevenlabs-tts-language-code': 'en',
      'elevenlabs-tts-stability': '0.4',
      'elevenlabs-tts-similarity-boost': '0.8',
      'elevenlabs-tts-style': '0.2',
      'elevenlabs-tts-use-speaker-boost': true,
      'elevenlabs-tts-speed': '1.1',
      'elevenlabs-tts-seed': '12345',
      'elevenlabs-tts-text-normalization': 'on',
      'elevenlabs-tts-pronunciation-dictionary-locator': ['dict_1:version_2', 'dict_3'],
      'elevenlabs-tts-optimize-streaming-latency': '2'
    }
    expectConfigPatchRoundTrip(requestControlFlags, 'tts', {
      grokTtsLanguage: 'ar-SA',
      grokTtsTextNormalization: true,
      openaiTtsInstructions: 'Speak with calm narration.',
      openaiTtsSpeed: 1.25,
      minimaxTtsLanguageBoost: 'English',
      minimaxTtsSpeed: 1.2,
      minimaxTtsVolume: 2.5,
      minimaxTtsPitch: -2,
      minimaxTtsEmotion: 'calm',
      minimaxTtsEnglishNormalization: true,
      minimaxTtsPronunciations: ['AutoShow/auto show', 'TTS/tee tee ess'],
      deepgramTtsEncoding: 'linear16',
      deepgramTtsContainer: 'wav',
      deepgramTtsBitRate: 128000,
      deepgramTtsSampleRate: 24000,
      deepgramTtsSpeed: 1.1,
      elevenlabsTtsOutputFormat: 'mp3_22050_32',
      elevenlabsTtsLanguageCode: 'en',
      elevenlabsTtsStability: 0.4,
      elevenlabsTtsSimilarityBoost: 0.8,
      elevenlabsTtsStyle: 0.2,
      elevenlabsTtsUseSpeakerBoost: true,
      elevenlabsTtsSpeed: 1.1,
      elevenlabsTtsSeed: 12345,
      elevenlabsTtsTextNormalization: 'on',
      elevenlabsTtsPronunciationDictionaryLocators: ['dict_1:version_2', 'dict_3'],
      elevenlabsTtsOptimizeStreamingLatency: 2
    })
  })

  test('buildConfigPatchFromFlags saves and merges ElevenLabs TTS clone defaults', () => {
    expectConfigPatchRoundTrip({
      'elevenlabs-tts': ['eleven_v3'],
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony',
      'elevenlabs-tts-clone-remove-background-noise': true
    }, 'tts', {
      elevenlabsTts: ['eleven_v3'],
      elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
      elevenlabsTtsVoiceName: 'AutoShow Anthony',
      elevenlabsTtsCloneRemoveBackgroundNoise: true
    })
  })
})
