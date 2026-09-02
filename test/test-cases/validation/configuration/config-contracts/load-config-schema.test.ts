import { describe, expect, test } from 'bun:test'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { writeTempConfig } from './shared'

describe('config load schema contracts', () => {
  test('loadConfig accepts current array-shaped defaults', async () => {
    const fullConfig = {
      defaults: {
        concurrency: {
          mode: 'immediate'
        },
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
            ocrConcurrency: 4,
            openaiOcr: ['gpt-5.5'],
            grokOcr: ['grok-4.3'],
            deepinfraOcr: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
            kimiOcr: ['kimi-k2.6']
          }
        },
        tts: {
          speechifyTts: ['simba-3.2'],
          mistralTts: ['voxtral-mini-tts-2603'],
          openaiTts: ['gpt-4o-mini-tts-2025-12-15'],
          elevenlabsTts: ['eleven_v3'],
          voice: ['speechify=narrator_voice', 'mistral=voice_abc123', 'openai=alloy'],
          speed: 1.1,
          language: 'en',
          textNormalization: 'on',
          elevenlabsTtsStability: 0.4,
          elevenlabsTtsSimilarityBoost: 0.8,
          elevenlabsTtsStyle: 0.2,
          elevenlabsTtsUseSpeakerBoost: true,
          elevenlabsTtsSeed: 12345,
          elevenlabsTtsPronunciationDictionaryLocators: ['dict_1:version_2'],
          chunkConcurrency: 3
        },
        image: {
          bflImage: ['flux-2-pro'],
          replicateImage: ['wan-video/wan-2.7-image'],
          format: 'jpeg'
        },
        video: {
          replicateVideo: ['bytedance/seedance-2.0-fast'],
          replicateVideoSeed: 123,
          generateAudio: false,
          referenceVideos: ['input/examples/video/reference.mp4'],
          referenceAudios: ['input/examples/audio/reference.mp3'],
          replicateVideoNegativePrompt: 'blur',
          duration: -1
        }
      }
    }
    const configPath = await writeTempConfig(fullConfig)

    await expect(loadConfig(configPath)).resolves.toMatchObject(fullConfig)
  })

  test('loadConfig rejects raw reference defaults with migration guidance', async () => {
    const mistralReference = await writeTempConfig({
      defaults: { tts: { mistralTtsRefAudio: 'private-reference.wav' } }
    })
    const elevenLabsClone = await writeTempConfig({
      defaults: { tts: { elevenlabsTtsRefAudio: 'private-reference.wav' } }
    })
    const speechifyConsent = await writeTempConfig({
      defaults: { tts: { speechifyTtsConsentEmail: 'performer@example.com' } }
    })

    await expect(loadConfig(mistralReference)).rejects.toThrow('Configured --tts-ref-audio paths cannot be used as synthesis defaults')
    await expect(loadConfig(elevenLabsClone)).rejects.toThrow('autoshow config')
    await expect(loadConfig(speechifyConsent)).rejects.toThrow('autoshow config')
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

  test('obsolete TTS provider keys fail with migration guidance', async () => {
    for (const key of ['groqTts', 'geminiTts', 'deepgramTts', 'replicateTts', 'falTts']) {
      const configPath = await writeTempConfig({ defaults: { tts: { [key]: ['historical-model'] } } })
      await expect(loadConfig(configPath)).rejects.toThrow(`TTS provider configuration ${key} is no longer supported.`)
    }
  })
})
