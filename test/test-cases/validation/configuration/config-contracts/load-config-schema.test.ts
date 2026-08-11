import { describe, expect, test } from 'bun:test'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { writeTempConfig } from './shared'

describe('config load schema contracts', () => {
  test('loadConfig accepts current array-shaped defaults', async () => {
    const fullConfig = {
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
            speechifyTts: ['simba-3.2'],
            speechifyVoice: 'narrator_voice',
            speechifyTtsAudioFormat: 'wav',
            speechifyTtsLanguage: 'en-US',
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            deepgramTtsEncoding: 'linear16',
            deepgramTtsContainer: 'wav',
            deepgramTtsBitRate: 128000,
            deepgramTtsSampleRate: 24000,
            deepgramTtsSpeed: 1.1,
            openaiTts: ['gpt-4o-mini-tts-2025-12-15'],
            openaiVoice: 'alloy',
            elevenlabsTts: ['eleven_v3'],
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
    }
    const configPath = await writeTempConfig(fullConfig)

    await expect(loadConfig(configPath)).resolves.toMatchObject(fullConfig)
  })

  test('loadConfig rejects synthesis-time voice creation and raw reference defaults with migration guidance', async () => {
    const mistralReference = await writeTempConfig({
      defaults: { post: { tts: { mistralTtsRefAudio: 'private-reference.wav' } } }
    })
    const elevenLabsClone = await writeTempConfig({
      defaults: { post: { tts: { elevenlabsTtsRefAudio: 'private-reference.wav' } } }
    })
    const speechifyConsent = await writeTempConfig({
      defaults: { post: { tts: { speechifyTtsConsentEmail: 'performer@example.com' } } }
    })

    await expect(loadConfig(mistralReference)).rejects.toThrow('Configured --mistral-tts-ref-audio paths cannot be used as synthesis defaults')
    await expect(loadConfig(elevenLabsClone)).rejects.toThrow('Configured synthesis default --elevenlabs-tts-ref-audio')
    await expect(loadConfig(speechifyConsent)).rejects.toThrow('Configured synthesis default --speechify-tts-consent-email')
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
