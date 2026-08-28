import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { estimateVideoCosts } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
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
  videoGenModel: 'veo-3.1-fast-generate-preview',
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
            videoGenModel: 'veo-3.1-fast-generate-preview',
            videoDuration: 8,
            videoResolution: '1080p'
          }),
          96
        ],
        [
          buildVideoMetadata({
            videoGenService: 'grok',
            videoGenModel: 'grok-imagine-video',
            videoDuration: 5,
            videoResolution: '720p',
            inputImage: 'input.png'
          }),
          35.2
        ],
        [
          buildVideoMetadata({
            videoGenService: 'grok',
            videoGenModel: 'grok-imagine-video',
            videoDuration: 5,
            videoResolution: '720p',
            inputVideo: 'input.mp4',
            inputVideoDurationSeconds: 3
          }),
          38
        ],
        [
          buildVideoMetadata({
            videoGenService: 'ltx',
            videoGenModel: 'ltx-2-3-fast',
            videoDuration: 8,
            videoResolution: '1080p',
            videoAspectRatio: '16:9',
            requestMode: 'text'
          }),
          48
        ],
        [
          buildVideoMetadata({
            videoGenService: 'ltx',
            videoGenModel: 'ltx-2-3-pro',
            videoDuration: 5,
            requestMode: 'extend'
          }),
          50
        ],
        [
          buildVideoMetadata({
            videoGenService: 'replicate',
            videoGenModel: 'alibaba/happyhorse-1.0',
            videoDuration: 5,
            videoResolution: '720p'
          }),
          70
        ],
        [
          buildVideoMetadata({
            videoGenService: 'replicate',
            videoGenModel: 'bytedance/seedance-2.0-fast',
            videoDuration: 5,
            videoResolution: '720p',
            inputVideo: 'input.mp4'
          }),
          85
        ],
        [
          buildVideoMetadata({
            videoGenService: 'replicate',
            videoGenModel: 'wan-video/wan-2.7-t2v',
            videoDuration: 5,
            videoResolution: '1080p'
          }),
          50
        ]
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

      expect(cost({ grokVideoModels: ['grok-imagine-video'], videoDuration: 5 })).toBe('25.00¢')
      expect(cost({ grokVideoModels: ['grok-imagine-video-1.5'], videoDuration: 5 })).toBe('40.00¢')
      expect(cost({ ltxVideoModels: ['ltx-2-3-fast'], videoDuration: 5 })).toBe('36.00¢')
      expect(cost({ lumalabsVideoModels: ['ray-3.2'], videoDuration: 5 })).toBe('30.00¢')

      expect(cost({ replicateVideoModels: ['alibaba/happyhorse-1.1'], videoDuration: 5, videoResolution: '720p' })).toBe('70.00¢')
      expect(cost({ replicateVideoModels: ['alibaba/happyhorse-1.1'], videoDuration: 5, videoResolution: '1080p' })).toBe('90.00¢')
      expect(cost({ replicateVideoModels: ['kwaivgi/kling-v3-video'], videoDuration: 5, videoResolution: '720p' })).toBe('84.00¢')
      expect(cost({ replicateVideoModels: ['kwaivgi/kling-v3-video'], videoDuration: 5, videoResolution: '1080p', videoGenerateAudio: true })).toBe('$1.68')
      expect(cost({ replicateVideoModels: ['kwaivgi/kling-v3-omni-video'], videoDuration: 5, videoResolution: '1080p', videoGenerateAudio: true })).toBe('$1.40')
      expect(cost({ replicateVideoModels: ['pixverse/pixverse-v6'], videoDuration: 5, videoResolution: '360p' })).toBe('25.00¢')
      expect(cost({ replicateVideoModels: ['pixverse/pixverse-v6'], videoDuration: 5, videoResolution: '1080p', videoGenerateAudio: true })).toBe('$1.15')
      expect(cost({ replicateVideoModels: ['bytedance/seedance-2.0'], videoDuration: 5, videoResolution: '480p' })).toBe('40.00¢')
      expect(cost({ replicateVideoModels: ['bytedance/seedance-2.0'], videoDuration: 5, videoResolution: '720p', replicateVideoReferenceVideoCount: 1 })).toBe('$1.10')
      expect(cost({ replicateVideoModels: ['bytedance/seedance-2.0-fast'], videoDuration: -1, videoResolution: '720p' })).toBe('75.00¢')
      expect(cost({ replicateVideoModels: ['bytedance/seedance-2.0-fast'], videoDuration: 5, videoResolution: '720p', replicateVideoReferenceVideoCount: 1 })).toBe('85.00¢')

      expect(cost({ ltxVideoModels: ['ltx-2-3-fast'], videoDuration: 8 })).toBe('48.00¢')
      expect(cost({ ltxVideoModels: ['ltx-2-3-fast'], videoDuration: 8, videoResolution: '4k' })).toBe('$1.92')
      expect(cost({ ltxVideoModels: ['ltx-2-3-fast'], videoDuration: 12, videoResolution: '4k', videoAspectRatio: '9:16' })).toBe('$2.40')
      expect(cost({ ltxVideoModels: ['ltx-2-3-pro'], videoMode: 'extend', videoDuration: 5 })).toBe('50.00¢')

      expect(cost({ grokVideoModels: ['grok-imagine-video'], videoDuration: 5, videoResolution: '480p' })).toBe('25.00¢')
      expect(cost({ grokVideoModels: ['grok-imagine-video'], videoDuration: 5, videoResolution: '720p' })).toBe('35.00¢')
      expect(cost({ grokVideoModels: ['grok-imagine-video'], videoDuration: 5, videoResolution: '480p', grokInputImageCount: 1 })).toBe('25.20¢')
      expect(cost({ grokVideoModels: ['grok-imagine-video-1.5'], videoDuration: 5, videoResolution: '1080p', grokInputImageCount: 1 })).toBe('$1.26')

      expect(cost({ geminiVideoModels: ['veo-3.1-lite-generate-preview'], videoDuration: 4, videoResolution: '720p' })).toBe('20.00¢')
      expect(cost({ geminiVideoModels: ['veo-3.1-lite-generate-preview'], videoDuration: 4, videoResolution: '1080p' })).toBe('64.00¢')
      expect(cost({ geminiVideoModels: ['veo-3.1-fast-generate-preview'], videoDuration: 4, videoResolution: '720p' })).toBe('40.00¢')
      expect(cost({ geminiVideoModels: ['veo-3.1-fast-generate-preview'], videoDuration: 4, videoResolution: '1080p' })).toBe('96.00¢')
      expect(cost({ geminiVideoModels: ['veo-3.1-fast-generate-preview'], videoDuration: 4, videoResolution: '4k' })).toBe('$2.40')
      expect(cost({ geminiVideoModels: ['veo-3.1-generate-preview'], videoDuration: 4, videoResolution: '720p' })).toBe('$1.60')
      expect(cost({ geminiVideoModels: ['veo-3.1-generate-preview'], videoDuration: 4, videoResolution: '1080p' })).toBe('$3.20')
      expect(cost({ geminiVideoModels: ['veo-3.1-generate-preview'], videoDuration: 4, videoResolution: '4k' })).toBe('$4.80')
    })

  test('cheapest default text-to-video selection is fal pixverse', () => {
      expect(selectCheapestDefaultTextVideoSelection()).toMatchObject({
        provider: 'fal',
        model: 'fal-ai/pixverse/c1'
      })
    })

  test('cheapest-model helpers return stable model selections', () => {
      expect(resolveCheapestModelForFlag('openai')).toBe('gpt-5.6-luna')
      expect(resolveCheapestModelForFlag('grok')).toBe('grok-4.3')
      expect(resolveCheapestModelForFlag('glm')).toBe('glm-5.1')
      expect(resolveCheapestModelForFlag('kimi')).toBe('kimi-k2.6')
      expect(resolveCheapestModelForFlag('openai-image')).toBe('gpt-image-2')
      expect(resolveCheapestModelForFlag('gemini-image')).toBe('gemini-3.1-flash-lite-image')
      expect(resolveCheapestModelForFlag('bfl-image')).toBe('flux-2-klein-4b')
      expect(resolveCheapestModelForFlag('recraft-image')).toBeUndefined()
      expect(resolveCheapestModelForFlag('rev-stt')).toBeUndefined()
      expect(resolveCheapestModelForFlag('replicate-ocr')).toBeUndefined()
      expect(resolveCheapestModelForFlag('fal-ocr')).toBeUndefined()
      expect(resolveCheapestModelForFlag('gemini-music')).toBe('lyria-3-pro-preview')
      expect(resolveCheapestModelForFlag('elevenlabs-music')).toBe('music_v2')
      expect(resolveCheapestModelForFlag('minimax-music')).toBe('music-3.0')
      expect(resolveCheapestModelForFlag('deepgram-stt')).toBe('nova-3')
      expect(resolveCheapestModelForFlag('grok-stt')).toBe('speech-to-text')
      expect(resolveCheapestModelForFlag('grok-tts')).toBe('grok-tts')
      expect(resolveCheapestModelForFlag('mistral-tts')).toBe('voxtral-mini-tts-2603')
      expect(resolveCheapestModelForFlag('speechify-tts')).toBe('simba-3.2')
      expect(resolveCheapestModelForFlag('gemini-stt')).toBe('gemini-3.6-flash')
      expect(resolveCheapestModelForFlag('gladia-stt')).toBe('solaria-3')
      expect(resolveCheapestModelForFlag('supadata-stt')).toBe('auto')
      expect(resolveCheapestModelForFlag('scrapecreators-stt')).toBe('youtube-transcript')
      expect(resolveCheapestModelForFlag('openai-ocr')).toBe('gpt-5.6-luna')
      expect(resolveCheapestModelForFlag('grok-ocr')).toBe('grok-4.3')
      expect(resolveCheapestModelForFlag('anthropic-ocr')).toBe('claude-haiku-4-5')
      expect(resolveCheapestModelForFlag('deepinfra-ocr')).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
      expect(resolveCheapestModelForFlag('kimi-ocr')).toBe('kimi-k2.6')
      expect(resolveCheapestModelForFlag('gemini-video')).toBe('veo-3.1-lite-generate-preview')
      expect(resolveCheapestModelForFlag('glm-video')).toBeUndefined()
      expect(resolveCheapestModelForFlag('ltx-video')).toBe('ltx-2-3-fast')
      expect(resolveCheapestModelForFlag('replicate-video')).toBe('pixverse/pixverse-v6')
      expect(selectCheapestVideoSelection('gemini')).toMatchObject({
        provider: 'gemini',
        model: 'veo-3.1-lite-generate-preview'
      })
      expect(selectCheapestVideoSelection('ltx')).toMatchObject({
        provider: 'ltx',
        model: 'ltx-2-3-fast'
      })
      expect(selectCheapestVideoSelection('replicate')).toMatchObject({
        provider: 'replicate',
        model: 'pixverse/pixverse-v6'
      })
    })
})
