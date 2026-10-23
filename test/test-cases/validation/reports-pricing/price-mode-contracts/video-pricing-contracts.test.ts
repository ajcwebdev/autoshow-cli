import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { estimateVideoCosts } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import {
resolveCheapestModelForFlag,
selectCheapestDefaultTextVideoSelection,
selectCheapestVideoSelection
} from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import type { Step6VideoMetadata } from '~/types'
import { formatEstimatedCost } from '~/utils/app-logger/formatters'
import { createMetadataFixtureBuilder } from '../../../../test-utils/metadata-fixtures'

const buildVideoMetadata = createMetadataFixtureBuilder<Step6VideoMetadata>({
  videoGenService: 'gemini',
  videoGenModel: 'veo-3.1-lite-generate-preview',
  processingTime: 1234,
  videoFileName: 'generated-video.mp4',
  videoFileSize: 1234,
  videoDuration: 4
})

describe('price mode contracts', () => {

  test('video actual-cost fallback reuses provider estimator options', () => {
      const cases = [
        [
          buildVideoMetadata({
            videoGenService: 'gemini',
            videoGenModel: 'veo-3.1-lite-generate-preview',
            videoDuration: 8,
            videoResolution: '1080p'
          }),
          64
        ],
        [
          buildVideoMetadata({
            videoGenService: 'grok',
            videoGenModel: 'grok-imagine-video-1.5',
            videoDuration: 5,
            videoResolution: '720p',
            inputImage: 'input.png'
          }),
          71
        ],
      ] as const

      for (const [metadata, expectedCost] of cases) {
        const actual = computeActualCosts({ step6: metadata })
        expect(actual.steps[0]).toMatchObject({
          step: 'video',
          provider: metadata.videoGenService,
          model: metadata.videoGenModel,
          costSource: 'registry_fallback'
        })
        expect(actual.totalCost).toBeCloseTo(expectedCost)
      }
    })

  test('video --price estimates use published duration, resolution, and input rates', () => {
      const cost = (opts: Parameters<typeof estimateVideoCosts>[0]): string =>
        formatEstimatedCost(estimateVideoCosts(opts)[0]!.totalCost)

      expect(cost({ grokVideoModels: ['grok-imagine-video-1.5'], videoDuration: 5 })).toBe('40.00¢')

      expect(cost({ grokVideoModels: ['grok-imagine-video-1.5'], videoDuration: 5, videoResolution: '480p' })).toBe('40.00¢')
      expect(cost({ grokVideoModels: ['grok-imagine-video-1.5'], videoDuration: 5, videoResolution: '720p' })).toBe('70.00¢')
      expect(cost({ grokVideoModels: ['grok-imagine-video-1.5'], videoDuration: 5, videoResolution: '480p', grokInputImageCount: 1 })).toBe('41.00¢')
      expect(cost({ grokVideoModels: ['grok-imagine-video-1.5'], videoDuration: 5, videoResolution: '1080p', grokInputImageCount: 1 })).toBe('$1.26')

      expect(cost({ geminiVideoModels: ['gemini-omni-1.1-flash'], videoDuration: 4, videoResolution: '720p' })).toBe('40.00¢')
      expect(cost({ geminiVideoModels: ['gemini-omni-1.1-flash'], videoDuration: 4, videoResolution: '1080p' })).toBe('40.00¢')
      expect(cost({ geminiVideoModels: ['gemini-omni-1.1-flash'], videoResolution: '720p' })).toBe('$1.00')
    })

  test('cheapest default text-to-video selection is fal.ai H3 Max Turbo text-to-video', () => {
      expect(selectCheapestDefaultTextVideoSelection()).toMatchObject({
        provider: 'fal',
        model: 'minimax/h3-max-turbo/text-to-video'
      })
    })

  test('cheapest-model helpers return stable model selections', () => {
      expect(resolveCheapestModelForFlag('openai')).toBe('gpt-6-luna')
      expect(resolveCheapestModelForFlag('grok')).toBe('grok-4.7')
      expect(resolveCheapestModelForFlag('glm')).toBeUndefined()
      expect(resolveCheapestModelForFlag('kimi')).toBeUndefined()
      expect(resolveCheapestModelForFlag('openai-image')).toBe('gpt-image-2.5-flare')
      expect(resolveCheapestModelForFlag('gemini-image')).toBe('gemini-3.1-flash-lite-image')
      expect(resolveCheapestModelForFlag('bfl-image')).toBeUndefined()
      expect(resolveCheapestModelForFlag('recraft-image')).toBeUndefined()
      expect(resolveCheapestModelForFlag('rev-stt')).toBeUndefined()
      expect(resolveCheapestModelForFlag('fal-ocr')).toBeUndefined()
      expect(resolveCheapestModelForFlag('gemini-music')).toBe('lyria-3.5')
      expect(resolveCheapestModelForFlag('elevenlabs-music')).toBe('music_v2')
      expect(resolveCheapestModelForFlag('minimax-music')).toBe('music-3.0')
      expect(resolveCheapestModelForFlag('deepgram-stt')).toBe('nova-3')
      expect(resolveCheapestModelForFlag('grok-stt')).toBe('grok-voice-transcribe-2.0')
      expect(resolveCheapestModelForFlag('grok-tts')).toBe('grok-tts')
      expect(resolveCheapestModelForFlag('mistral-tts')).toBeUndefined()
      expect(resolveCheapestModelForFlag('gemini-stt')).toBe('gemini-3.5-transcribe')
      expect(resolveCheapestModelForFlag('gladia-stt')).toBe('solaria-3')
      expect(resolveCheapestModelForFlag('scrapecreators-stt')).toBe('youtube-transcript')
      expect(resolveCheapestModelForFlag('scrapecreators-stt')).toBe('youtube-transcript')
      expect(resolveCheapestModelForFlag('openai-ocr')).toBe('gpt-6-luna')
      expect(resolveCheapestModelForFlag('grok-ocr')).toBe('grok-4.5')
      expect(resolveCheapestModelForFlag('anthropic-ocr')).toBe('claude-haiku-5-5')
      expect(resolveCheapestModelForFlag('deepinfra-ocr')).toBe('google/gemma-4-31B-it')
      expect(resolveCheapestModelForFlag('kimi-ocr')).toBeUndefined()
      expect(resolveCheapestModelForFlag('gemini-video')).toBe('gemini-omni-1.1-flash')
      expect(resolveCheapestModelForFlag('glm-video')).toBeUndefined()
      expect(selectCheapestVideoSelection('gemini')).toMatchObject({
        provider: 'gemini',
        model: 'gemini-omni-1.1-flash'
      })
    })
})
