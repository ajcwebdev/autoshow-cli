import { describe, expect, test } from 'bun:test'
import {
  resolveCheapestModelForFlag,
  selectCheapestVideoSelection
} from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { resolveExtractionProviderModel } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import type { ExtractionMetadata, Step6VideoMetadata } from '~/types'

const buildVideoMetadata = (overrides: Partial<Step6VideoMetadata>): Step6VideoMetadata => ({
  videoGenService: 'gemini',
  videoGenModel: 'veo-3.1-fast-generate-preview',
  processingTime: 1234,
  videoFileName: 'generated-video.mp4',
  videoFileSize: 1234,
  videoDuration: 4,
  ...overrides
})

describe('price mode contracts', () => {
  test('URL article extraction methods resolve provider models consistently', () => {
      const base: Omit<ExtractionMetadata, 'extractionMethod'> = {
        totalPages: 1,
        ocrPages: 0,
        textPages: 1,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 100
      }

      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+defuddle' })).toEqual({
        provider: 'defuddle',
        model: 'defuddle'
      })
      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+glm-reader' })).toEqual({
        provider: 'glm-reader',
        model: 'glm-reader'
      })
      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+spider' })).toEqual({
        provider: 'spider',
        model: 'spider'
      })
      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+supadata' })).toEqual({
        provider: 'supadata',
        model: 'supadata'
      })
      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+zyte' })).toEqual({
        provider: 'zyte',
        model: 'zyte'
      })
      expect(computeActualCosts({ step2: { ...base, extractionMethod: 'html+defuddle' } }).steps[0]).toMatchObject({
        step: 'extract',
        provider: 'defuddle',
        model: 'defuddle',
        cost: 0
      })
      expect(computeActualCosts({ step2: { ...base, extractionMethod: 'html+spider' } }).steps[0]).toMatchObject({
        step: 'extract',
        provider: 'spider',
        model: 'spider',
        cost: 0.12
      })
      expect(computeActualProcessingTimes({ step2: { ...base, extractionMethod: 'html+zyte' } }).steps[0]).toMatchObject({
        provider: 'zyte',
        model: 'zyte',
        processingTimeMs: 1234
      })
    })

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
            videoGenService: 'minimax',
            videoGenModel: 'MiniMax-Hailuo-2.3-Fast',
            videoDuration: 10,
            videoResolution: '720p'
          }),
          32
        ],
        [
          buildVideoMetadata({
            videoGenService: 'minimax',
            videoGenModel: 'MiniMax-Hailuo-2.3-Fast',
            videoDuration: 6,
            videoResolution: '1080p'
          }),
          33
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
            videoSize: '2560x1440',
            requestMode: 'text'
          }),
          96
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

  test('cheapest-model helpers return stable model selections', () => {
      expect(resolveCheapestModelForFlag('openai')).toBe('gpt-5.4-nano')
      expect(resolveCheapestModelForFlag('grok')).toBe('grok-4.3')
      expect(resolveCheapestModelForFlag('glm')).toBe('glm-5.1')
      expect(resolveCheapestModelForFlag('kimi')).toBe('kimi-k2.6')
      expect(resolveCheapestModelForFlag('openai-image')).toBe('gpt-image-2')
      expect(resolveCheapestModelForFlag('gemini-image')).toBe('gemini-3.1-flash-lite-image')
      expect(resolveCheapestModelForFlag('bfl-image')).toBe('flux-2-klein-4b')
      expect(resolveCheapestModelForFlag('recraft-image')).toBe('recraftv4_1')
      expect(resolveCheapestModelForFlag('gemini-music')).toBe('lyria-3-clip-preview')
      expect(resolveCheapestModelForFlag('elevenlabs-music')).toBe('music_v1')
      expect(resolveCheapestModelForFlag('minimax-music')).toBe('music-3.0')
      expect(resolveCheapestModelForFlag('deepgram-stt')).toBe('nova-3')
      expect(resolveCheapestModelForFlag('grok-stt')).toBe('speech-to-text')
      expect(resolveCheapestModelForFlag('grok-tts')).toBe('grok-tts')
      expect(resolveCheapestModelForFlag('mistral-tts')).toBe('voxtral-mini-tts-2603')
      expect(resolveCheapestModelForFlag('speechify-tts')).toBe('simba-3.2')
      expect(resolveCheapestModelForFlag('gemini-stt')).toBe('gemini-3.6-flash')
      expect(resolveCheapestModelForFlag('gladia-stt')).toBe('solaria-1')
      expect(resolveCheapestModelForFlag('supadata-stt')).toBe('auto')
      expect(resolveCheapestModelForFlag('scrapecreators-stt')).toBe('youtube-transcript')
      expect(resolveCheapestModelForFlag('openai-ocr')).toBe('gpt-5.4-nano')
      expect(resolveCheapestModelForFlag('grok-ocr')).toBe('grok-4.3')
      expect(resolveCheapestModelForFlag('anthropic-ocr')).toBe('claude-haiku-4-5')
      expect(resolveCheapestModelForFlag('deepinfra-ocr')).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
      expect(resolveCheapestModelForFlag('kimi-ocr')).toBe('kimi-k2.6')
      expect(resolveCheapestModelForFlag('gemini-video')).toBe('veo-3.1-lite-generate-preview')
      expect(resolveCheapestModelForFlag('minimax-video')).toBe('T2V-01')
      expect(resolveCheapestModelForFlag('glm-video')).toBe('cogvideox-3')
      expect(resolveCheapestModelForFlag('ltx-video')).toBe('ltx-2-3-fast')
      expect(resolveCheapestModelForFlag('replicate-video')).toBe('pixverse/pixverse-v6')
      expect(selectCheapestVideoSelection('gemini')).toMatchObject({
        provider: 'gemini',
        model: 'veo-3.1-lite-generate-preview'
      })
      expect(selectCheapestVideoSelection('minimax')).toMatchObject({
        provider: 'minimax',
        model: 'T2V-01'
      })
      expect(selectCheapestVideoSelection('glm')).toMatchObject({
        provider: 'glm',
        model: 'cogvideox-3'
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

  test('OpenAI image estimates use model size and quality tables', () => {
      expect(estimateImageCosts({
        openaiImageModel: 'gpt-image-2',
        imageSize: '1024x1024',
        imageQuality: 'low'
      })[0]?.costPerImageCents).toBe(0.6)
      expect(estimateImageCosts({
        openaiImageModel: 'gpt-image-2',
        imageSize: '1536x1024',
        imageQuality: 'high'
      })[0]?.costPerImageCents).toBe(16.5)
      expect(estimateImageCosts({
        openaiImageModel: 'gpt-image-2',
        imageSize: 'auto',
        imageQuality: 'auto'
      })[0]?.costPerImageCents).toBe(5.3)
      expect(estimateImageCosts({
        openaiImageModel: 'gpt-image-2',
        imageSize: '2048x2048',
        imageQuality: 'high'
      })[0]?.note).toContain('OpenAI')
    })

  test('Recraft image estimates use published per-image generation rates', () => {
      expect(estimateImageCosts({
        recraftImageModel: 'recraftv4_1',
        imageCount: 3
      })[0]).toMatchObject({
        provider: 'recraft',
        model: 'recraftv4_1',
        imageCount: 3,
        costPerImageCents: 4,
        totalCost: 12
      })
    })

  test('OpenAI actual fallback cost preserves image options', () => {
      const cost = computeActualCosts({
        step5: {
          imageService: 'openai',
          imageModel: 'gpt-image-2',
          processingTime: 10_000,
          imageFileNames: ['generated-image.png'],
          imageCount: 1,
          imageFileSize: 1234,
          imageWidth: 1024,
          imageHeight: 1024,
          imageSize: '1024x1024',
          imageQuality: 'low',
          imageFormat: 'png',
          requestMode: 'generation'
        }
      })

      expect(cost.steps[0]).toMatchObject({
        step: 'image',
        provider: 'openai',
        model: 'gpt-image-2',
        cost: 0.6
      })

      const highPortraitCost = computeActualCosts({
        step5: {
          imageService: 'openai',
          imageModel: 'gpt-image-2',
          processingTime: 10_000,
          imageFileNames: ['generated-image.png'],
          imageCount: 1,
          imageFileSize: 1234,
          imageWidth: 1024,
          imageHeight: 1536,
          imageSize: '1024x1536',
          imageQuality: 'high',
          imageFormat: 'png',
          requestMode: 'generation'
        }
      })

      expect(highPortraitCost.steps[0]).toMatchObject({
        step: 'image',
        provider: 'openai',
        model: 'gpt-image-2',
        cost: 16.5
      })
    })

  test('Gemini music estimates use per-song Lyria 3 pricing', () => {
      const estimates = estimateMusicCosts({
        geminiMusicModels: ['lyria-3-clip-preview', 'lyria-3-pro-preview'],
        musicDuration: 90
      })

      expect(estimates.map((estimate) => ({
        provider: estimate.provider,
        model: estimate.model,
        totalCost: estimate.totalCost
      }))).toEqual([
        { provider: 'gemini', model: 'lyria-3-clip-preview', totalCost: 4 },
        { provider: 'gemini', model: 'lyria-3-pro-preview', totalCost: 8 }
      ])
    })
})
