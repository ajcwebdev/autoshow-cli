import { describe, expect, test } from 'bun:test'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'

describe('config image and TTS default contracts', () => {
  test('buildConfigPatchFromFlags saves hosted image defaults', () => {
    expect(buildConfigPatchFromFlags({
      'bfl-image': ['flux-2-pro'],
      'reve-image': ['latest'],
      'recraft-image': ['recraftv4_1'],
      'replicate-image': ['wan-video/wan-2.7-image'],
      'image-size': '1024x1024',
      'image-format': 'webp'
    }, new Set(['bfl-image', 'reve-image', 'recraft-image', 'replicate-image', 'image-size', 'image-format']))).toEqual({
      defaults: {
        post: {
          image: {
            bflImage: ['flux-2-pro'],
            reveImage: ['latest'],
            recraftImage: ['recraftv4_1'],
            replicateImage: ['wan-video/wan-2.7-image'],
            imageSize: '1024x1024',
            imageFormat: 'webp'
          }
        }
      }
    })
  })

  test('buildConfigPatchFromFlags saves and merges Replicate video defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'replicate-video': ['wan-video/wan-2.7-t2v'],
      'replicate-video-seed': '123',
      'replicate-video-generate-audio': false,
      'replicate-video-reference-video': ['input/examples/video/reference.mp4'],
      'replicate-video-reference-audio': ['input/examples/audio/reference.mp3'],
      'replicate-video-negative-prompt': 'blur',
      'replicate-video-audio': 'input/examples/audio/narration.wav',
      'replicate-video-prompt-expansion': true,
      'video-duration': '-1'
    }, new Set([
      'replicate-video',
      'replicate-video-seed',
      'replicate-video-generate-audio',
      'replicate-video-reference-video',
      'replicate-video-reference-audio',
      'replicate-video-negative-prompt',
      'replicate-video-audio',
      'replicate-video-prompt-expansion',
      'video-duration'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          video: {
            replicateVideo: ['wan-video/wan-2.7-t2v'],
            replicateVideoSeed: 123,
            replicateVideoGenerateAudio: false,
            replicateVideoReferenceVideos: ['input/examples/video/reference.mp4'],
            replicateVideoReferenceAudios: ['input/examples/audio/reference.mp3'],
            replicateVideoNegativePrompt: 'blur',
            replicateVideoAudio: 'input/examples/audio/narration.wav',
            replicateVideoPromptExpansion: true,
            videoDuration: -1
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'replicate-video': ['wan-video/wan-2.7-t2v'],
      'replicate-video-seed': '123',
      'replicate-video-generate-audio': false,
      'replicate-video-reference-video': ['input/examples/video/reference.mp4'],
      'replicate-video-reference-audio': ['input/examples/audio/reference.mp3'],
      'replicate-video-negative-prompt': 'blur',
      'replicate-video-audio': 'input/examples/audio/narration.wav',
      'replicate-video-prompt-expansion': true,
      'video-duration': '-1'
    })
  })

  test('buildConfigPatchFromFlags saves and merges Speechify, Hume, and Cartesia TTS defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'speechify-tts': ['simba-english'],
      'speechify-voice': 'narrator_voice',
      'speechify-tts-audio-format': 'wav',
      'speechify-tts-language': 'en-US',
      'hume-tts': ['octave-2'],
      'hume-tts-voice': 'Studio Voice',
      'hume-tts-voice-provider': 'CUSTOM_VOICE',
      'cartesia-tts': ['sonic-3.5'],
      'cartesia-tts-voice': 'cartesia-voice-id',
      'cartesia-tts-language': 'en'
    }, new Set([
      'speechify-tts',
      'speechify-voice',
      'speechify-tts-audio-format',
      'speechify-tts-language',
      'hume-tts',
      'hume-tts-voice',
      'hume-tts-voice-provider',
      'cartesia-tts',
      'cartesia-tts-voice',
      'cartesia-tts-language'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            speechifyTts: ['simba-english'],
            speechifyVoice: 'narrator_voice',
            speechifyTtsAudioFormat: 'wav',
            speechifyTtsLanguage: 'en-US',
            humeTts: ['octave-2'],
            humeTtsVoice: 'Studio Voice',
            humeTtsVoiceProvider: 'CUSTOM_VOICE',
            cartesiaTts: ['sonic-3.5'],
            cartesiaTtsVoice: 'cartesia-voice-id',
            cartesiaTtsLanguage: 'en'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'speechify-tts': ['simba-english'],
      'speechify-voice': 'narrator_voice',
      'speechify-tts-audio-format': 'wav',
      'speechify-tts-language': 'en-US',
      'hume-tts': ['octave-2'],
      'hume-tts-voice': 'Studio Voice',
      'hume-tts-voice-provider': 'CUSTOM_VOICE',
      'cartesia-tts': ['sonic-3.5'],
      'cartesia-tts-voice': 'cartesia-voice-id',
      'cartesia-tts-language': 'en'
    })
  })

  test('buildConfigPatchFromFlags saves and merges Mistral TTS defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'mistral-tts': ['voxtral-mini-tts-2603'],
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'mistral-tts-voice-name': 'AutoShow Saved Voice'
    }, new Set(['mistral-tts', 'mistral-tts-voice', 'mistral-tts-ref-audio', 'mistral-tts-voice-name']))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            mistralTtsVoiceName: 'AutoShow Saved Voice'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'mistral-tts': ['voxtral-mini-tts-2603'],
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'mistral-tts-voice-name': 'AutoShow Saved Voice'
    })
  })

  test('buildConfigPatchFromFlags saves and merges MiniMax TTS voice defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'minimax-tts': ['speech-2.8-turbo'],
      'minimax-tts-voice': 'English_expressive_narrator'
    }, new Set([
      'minimax-tts',
      'minimax-tts-voice'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            minimaxTts: ['speech-2.8-turbo'],
            minimaxTtsVoice: 'English_expressive_narrator'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'minimax-tts': ['speech-2.8-turbo'],
      'minimax-tts-voice': 'English_expressive_narrator'
    })
  })

  test('buildConfigPatchFromFlags saves and merges TTS request-control defaults', () => {
    const patch = buildConfigPatchFromFlags({
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
    }, new Set([
      'grok-tts-language',
      'grok-tts-text-normalization',
      'openai-tts-instructions',
      'openai-tts-speed',
      'minimax-tts-language-boost',
      'minimax-tts-speed',
      'minimax-tts-volume',
      'minimax-tts-pitch',
      'minimax-tts-emotion',
      'minimax-tts-english-normalization',
      'minimax-tts-pronunciation',
      'deepgram-tts-encoding',
      'deepgram-tts-container',
      'deepgram-tts-bit-rate',
      'deepgram-tts-sample-rate',
      'deepgram-tts-speed',
      'elevenlabs-tts-output-format',
      'elevenlabs-tts-language-code',
      'elevenlabs-tts-stability',
      'elevenlabs-tts-similarity-boost',
      'elevenlabs-tts-style',
      'elevenlabs-tts-use-speaker-boost',
      'elevenlabs-tts-speed',
      'elevenlabs-tts-seed',
      'elevenlabs-tts-text-normalization',
      'elevenlabs-tts-pronunciation-dictionary-locator',
      'elevenlabs-tts-optimize-streaming-latency'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
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
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
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
    })
  })

  test('buildConfigPatchFromFlags saves and merges ElevenLabs TTS clone defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'elevenlabs-tts': ['eleven_v3'],
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony',
      'elevenlabs-tts-clone-remove-background-noise': true
    }, new Set([
      'elevenlabs-tts',
      'elevenlabs-tts-ref-audio',
      'elevenlabs-tts-voice-name',
      'elevenlabs-tts-clone-remove-background-noise'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            elevenlabsTts: ['eleven_v3'],
            elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            elevenlabsTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTtsCloneRemoveBackgroundNoise: true
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'elevenlabs-tts': ['eleven_v3'],
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony',
      'elevenlabs-tts-clone-remove-background-noise': true
    })
  })
})
