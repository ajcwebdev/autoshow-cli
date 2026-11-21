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
        // Finished 1.1 runs keep the retired flat rate; 1.2 uses its published per-resolution rate.
        [
          buildVideoMetadata({
            videoGenService: 'gemini',
            videoGenModel: 'gemini-omni-1.1-flash',
            videoDuration: 5,
            videoResolution: '360p'
          }),
          50
        ],
        [
          buildVideoMetadata({
            videoGenService: 'gemini',
            videoGenModel: 'gemini-omni-1.2-flash',
            videoDuration: 5,
            videoResolution: '1080p'
          }),
          52.128
        ],
        // Provider-selected Omni lengths reprice at the documented 10-second budget used while each model was
        // active, so retiring 1.1 keeps its recorded $1.00 per benchmark clip instead of halving it.
        [
          buildVideoMetadata({
            videoGenService: 'gemini',
            videoGenModel: 'gemini-omni-1.1-flash',
            videoDuration: undefined,
            videoResolution: '720p'
          }),
          100
        ],
        [
          buildVideoMetadata({
            videoGenService: 'gemini',
            videoGenModel: 'gemini-omni-1.2-flash',
            videoDuration: undefined,
            videoResolution: '720p'
          }),
          69.504
        ],
        // Older retired providers keep their legacy 5-second budget when no duration was recorded.
        [
          buildVideoMetadata({
            videoGenService: 'grok',
            videoGenModel: 'grok-imagine-video',
            videoDuration: undefined,
            videoResolution: '720p'
          }),
          35
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

      // Omni 1.2: $12.00 per 1M video tokens at 1,931, 5,792, 8,688 and 17,376 tokens per second.
      expect(cost({ geminiVideoModels: ['gemini-omni-1.2-flash'], videoDuration: 3, videoResolution: '360p' })).toBe('6.95¢')
      expect(cost({ geminiVideoModels: ['gemini-omni-1.2-flash'], videoDuration: 4, videoResolution: '720p' })).toBe('27.80¢')
      expect(cost({ geminiVideoModels: ['gemini-omni-1.2-flash'], videoDuration: 4, videoResolution: '1080p' })).toBe('41.70¢')
      expect(cost({ geminiVideoModels: ['gemini-omni-1.2-flash'], videoDuration: 5, videoResolution: '4k' })).toBe('$1.04')
      expect(cost({ geminiVideoModels: ['gemini-omni-1.2-flash'], videoResolution: '720p' })).toBe('69.50¢')
    })

  test('video estimates reject the retired Omni 1.1 before pricing and name its successor', () => {
      expect(() => estimateVideoCosts({ geminiVideoModels: ['gemini-omni-1.1-flash'], videoDuration: 3 }))
        .toThrow('Model "gemini-omni-1.1-flash" is retired for --provider/--video gemini[=model]. Use "gemini-omni-1.2-flash" instead.')
    })

  test('cheapest default text-to-video selection is Grok Imagine Video 1.5 Lite', () => {
      // Lite: 2 cents/second at its 8-second default; full: 64 cents; Omni 1.2: 69.5 cents at 10 seconds, 720p.
      expect(selectCheapestDefaultTextVideoSelection()).toMatchObject({
        provider: 'grok',
        model: 'grok-imagine-video-1.5-lite',
        duration: 8,
        totalCost: 16
      })
    })

  test('cheapest-model helpers return stable model selections', () => {
      expect(resolveCheapestModelForFlag('openai')).toBe('gpt-6-luna')
      expect(resolveCheapestModelForFlag('grok')).toBe('grok-4.7')
      expect(resolveCheapestModelForFlag('glm')).toBeUndefined()
      expect(resolveCheapestModelForFlag('kimi')).toBeUndefined()
      expect(resolveCheapestModelForFlag('openai-image')).toBe('gpt-image-2.6-flare')
      expect(resolveCheapestModelForFlag('gemini-image')).toBe('gemini-nano-banana-2.1')
      expect(resolveCheapestModelForFlag('bfl-image')).toBeUndefined()
      expect(resolveCheapestModelForFlag('recraft-image')).toBeUndefined()
      expect(resolveCheapestModelForFlag('rev-stt')).toBeUndefined()
      expect(resolveCheapestModelForFlag('fal-ocr')).toBeUndefined()
      expect(resolveCheapestModelForFlag('fal-image')).toBeUndefined()
      expect(resolveCheapestModelForFlag('fal-video')).toBeUndefined()
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
      expect(resolveCheapestModelForFlag('grok-ocr')).toBe('grok-4.7')
      expect(resolveCheapestModelForFlag('anthropic-ocr')).toBe('claude-haiku-5-5')
      expect(resolveCheapestModelForFlag('deepinfra-ocr')).toBeUndefined()
      expect(resolveCheapestModelForFlag('kimi-ocr')).toBeUndefined()
      expect(resolveCheapestModelForFlag('gemini-video')).toBe('gemini-omni-1.2-flash')
      expect(resolveCheapestModelForFlag('glm-video')).toBeUndefined()
      // Bare gemini moved from 1.1 (3 seconds at 360p, 30 cents) to 1.2 at its 360p rate.
      const geminiDefault = selectCheapestVideoSelection('gemini')
      expect(geminiDefault).toMatchObject({
        provider: 'gemini',
        model: 'gemini-omni-1.2-flash',
        duration: 3,
        resolution: '360p'
      })
      expect(geminiDefault.totalCost).toBeCloseTo(6.9516)
    })
})
