import { describe, expect, test } from 'bun:test'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { writeTempConfig } from './shared'

describe('config load schema contracts', () => {
  test('loadConfig accepts current array-shaped defaults', async () => {
    const configPath = await writeTempConfig({
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini'],
          grok: ['grok-4.3'],
          glm: ['glm-5.1'],
          kimi: ['kimi-k2.6'],
          together: ['kimi-k2.6', 'glm-5.1'],
          cerebras: ['gpt-oss-120b', 'zai-glm-4.7'],
          providerConcurrency: 3,
          localConcurrency: 1
        },
        extract: {
          stt: {
            deepgramStt: ['nova-3']
          },
          url: {
            provider: 'firecrawl'
          },
          ocr: {
            providerConcurrency: 3,
            localConcurrency: 1,
            pageConcurrency: 4,
            openaiOcr: ['gpt-5.5'],
            grokOcr: ['grok-4.3'],
            deepinfraOcr: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
            kimiOcr: ['kimi-k2.6']
          }
        },
        post: {
          tts: {
            speechifyTts: ['simba-english'],
            speechifyVoice: 'narrator_voice',
            speechifyTtsAudioFormat: 'wav',
            speechifyTtsLanguage: 'en-US',
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            mistralTtsVoiceName: 'AutoShow Saved Voice',
            deepgramTtsEncoding: 'linear16',
            deepgramTtsContainer: 'wav',
            deepgramTtsBitRate: 128000,
            deepgramTtsSampleRate: 24000,
            deepgramTtsSpeed: 1.1,
            openaiTts: ['gpt-4o-mini-tts'],
            openaiVoice: 'alloy',
            elevenlabsTts: ['eleven_v3'],
            elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            elevenlabsTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTtsCloneRemoveBackgroundNoise: true,
            elevenlabsTtsOutputFormat: 'mp3_22050_32',
            elevenlabsTtsLanguageCode: 'en',
            elevenlabsTtsStability: 0.4,
            elevenlabsTtsSimilarityBoost: 0.8,
            elevenlabsTtsStyle: 0.2,
            elevenlabsTtsUseSpeakerBoost: true,
            elevenlabsTtsSpeed: 1.1,
            elevenlabsTtsSeed: 12345,
            elevenlabsTtsTextNormalization: 'on',
            elevenlabsTtsPronunciationDictionaryLocators: ['dict_1:version_2'],
            elevenlabsTtsOptimizeStreamingLatency: 2,
            minimaxTts: ['speech-2.8-turbo'],
            minimaxTtsVoice: 'AutoShowTestVoice',
            chunkConcurrency: 3
          },
          image: {
            bflImage: ['flux-2-pro'],
            recraftImage: ['recraftv4_1'],
            replicateImage: ['wan-video/wan-2.7-image'],
            imageFormat: 'jpeg'
          },
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

    await expect(loadConfig(configPath)).resolves.toMatchObject({
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini'],
          grok: ['grok-4.3'],
          glm: ['glm-5.1'],
          kimi: ['kimi-k2.6'],
          together: ['kimi-k2.6', 'glm-5.1'],
          cerebras: ['gpt-oss-120b', 'zai-glm-4.7'],
          providerConcurrency: 3,
          localConcurrency: 1
        },
        extract: {
          stt: {
            deepgramStt: ['nova-3']
          },
          url: {
            provider: 'firecrawl'
          },
          ocr: {
            providerConcurrency: 3,
            localConcurrency: 1,
            pageConcurrency: 4,
            openaiOcr: ['gpt-5.5'],
            grokOcr: ['grok-4.3'],
            deepinfraOcr: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
            kimiOcr: ['kimi-k2.6']
          }
        },
        post: {
          tts: {
            speechifyTts: ['simba-english'],
            speechifyVoice: 'narrator_voice',
            speechifyTtsAudioFormat: 'wav',
            speechifyTtsLanguage: 'en-US',
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            mistralTtsVoiceName: 'AutoShow Saved Voice',
            deepgramTtsEncoding: 'linear16',
            deepgramTtsContainer: 'wav',
            deepgramTtsBitRate: 128000,
            deepgramTtsSampleRate: 24000,
            deepgramTtsSpeed: 1.1,
            openaiTts: ['gpt-4o-mini-tts'],
            openaiVoice: 'alloy',
            elevenlabsTts: ['eleven_v3'],
            elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            elevenlabsTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTtsCloneRemoveBackgroundNoise: true,
            elevenlabsTtsOutputFormat: 'mp3_22050_32',
            elevenlabsTtsLanguageCode: 'en',
            elevenlabsTtsStability: 0.4,
            elevenlabsTtsSimilarityBoost: 0.8,
            elevenlabsTtsStyle: 0.2,
            elevenlabsTtsUseSpeakerBoost: true,
            elevenlabsTtsSpeed: 1.1,
            elevenlabsTtsSeed: 12345,
            elevenlabsTtsTextNormalization: 'on',
            elevenlabsTtsPronunciationDictionaryLocators: ['dict_1:version_2'],
            elevenlabsTtsOptimizeStreamingLatency: 2,
            minimaxTts: ['speech-2.8-turbo'],
            minimaxTtsVoice: 'AutoShowTestVoice',
            chunkConcurrency: 3
          },
          image: {
            bflImage: ['flux-2-pro'],
            recraftImage: ['recraftv4_1'],
            replicateImage: ['wan-video/wan-2.7-image'],
            imageFormat: 'jpeg'
          },
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
  })

  test('removed schema shapes are rejected', async () => {
    const versionConfig = await writeTempConfig({
      version: 2
    })
    const scalarConfig = await writeTempConfig({
      defaults: {
        llm: {
          openai: 'gpt-5.4-mini'
        }
      }
    })
    const pricingConfig = await writeTempConfig({
      pricing: {
        maxUsd: 1
      }
    })

    await expect(loadConfig(versionConfig)).rejects.toThrow('autoshow config')
    await expect(loadConfig(scalarConfig)).rejects.toThrow('autoshow config')
    await expect(loadConfig(pricingConfig)).rejects.toThrow('autoshow config')
  })
})
