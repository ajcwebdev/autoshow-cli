import { describe, expect, test } from 'bun:test'
import {
  resolveCheapestModelForFlag,
  selectCheapestDefaultTextVideoSelection,
  selectCheapestVideoSelection
} from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { estimateVideoCosts } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { formatEstimatedCost } from '~/utils/app-logger/formatters'
import { resolveExtractionProviderModel } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import type { ExtractionMetadata, FinalImageOutputInventory, FinalImagePageInventory, FinalImagePanelInventory, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata } from '~/types'
import { estimatePageMode, estimatePanelMode, estimateQaWork, normalizeFinalImageEstimateRequest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/final-image-price-estimate'
import { resolveFinalImageOutputPathParts } from '~/cli/commands/process-steps/step-8-comic/comic-utils/final-image-price-inventory'
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
  test('comic final-image price defaults normalize into discriminated page, panel, and grid requests', () => {
      const base = { scriptPath: 'scene.md', sceneSlug: 'scene' }

      expect(normalizeFinalImageEstimateRequest(base)).toMatchObject({
        mode: 'panel',
        models: ['gpt-image-2'],
        size: '1536x1024',
        quality: 'high',
        force: false,
        selection: 'all',
        selectionSpecified: false,
        variations: ['canonical'],
        variationsSpecified: false,
        qa: { enabled: true, judgeModel: 'gpt-5.6-sol', maxRepairs: 2 }
      })
      expect(normalizeFinalImageEstimateRequest({ ...base, panelsPerImage: 3 })).toMatchObject({
        mode: 'page',
        panelsPerImage: 3
      })
      expect(normalizeFinalImageEstimateRequest({
        ...base,
        panelsPerImage: 1,
        grid: { columns: 2, rows: 3 }
      })).toMatchObject({
        mode: 'grid',
        grid: { columns: 2, rows: 3 }
      })

      const single = normalizeFinalImageEstimateRequest(base)
      expect(resolveFinalImageOutputPathParts(single, 'gpt-image-2', 'canonical')).toEqual({})
      const multipleModels = normalizeFinalImageEstimateRequest({
        ...base,
        imageModels: ['gpt-image-2', 'gemini-3.1-flash-lite-image']
      })
      expect(resolveFinalImageOutputPathParts(multipleModels, 'gpt-image-2', 'canonical')).toEqual({
        model: 'gpt-image-2'
      })
      const explicitVariation = normalizeFinalImageEstimateRequest({
        ...base,
        variations: ['canonical']
      })
      expect(resolveFinalImageOutputPathParts(explicitVariation, 'gpt-image-2', 'canonical')).toEqual({
        model: 'gpt-image-2',
        variation: 'canonical'
      })
    })

  test('comic page price estimation preserves per-model skips and reusable QA reports', () => {
      const request = normalizeFinalImageEstimateRequest({
        scriptPath: 'scene.md',
        sceneSlug: 'scene',
        panelsPerImage: 2,
        imageModels: ['gpt-image-2', 'gemini-3.1-flash-lite-image'],
        variations: ['canonical', 'cinematic-depth'],
        maxRepairs: 2
      })
      if (request.mode !== 'page') throw new Error('Expected page request')

      const output = (
        model: FinalImageOutputInventory['model'],
        variation: FinalImageOutputInventory['variation'],
        exists: boolean,
        qaReportReusable = false
      ): FinalImageOutputInventory => ({
        model,
        variation,
        outputPath: `${model}/${variation}.png`,
        exists,
        qaReportReusable
      })
      const inventory: FinalImagePageInventory = {
        mode: 'page',
        panelPromptsDir: 'panel-prompts',
        pages: [
          {
            pageNumber: 1,
            panelNumbers: [1, 2],
            referenceCount: 3,
            outputs: [
              output('gpt-image-2', 'canonical', true, true),
              output('gpt-image-2', 'cinematic-depth', false),
              output('gemini-3.1-flash-lite-image', 'canonical', false),
              output('gemini-3.1-flash-lite-image', 'cinematic-depth', false)
            ]
          },
          {
            pageNumber: 2,
            panelNumbers: [3, 4],
            referenceCount: 2,
            outputs: [
              output('gpt-image-2', 'canonical', false),
              output('gpt-image-2', 'cinematic-depth', false),
              output('gemini-3.1-flash-lite-image', 'canonical', false),
              output('gemini-3.1-flash-lite-image', 'cinematic-depth', false)
            ]
          }
        ]
      }

      const estimate = estimatePageMode(request, inventory)
      expect(estimate).toEqual({
        mode: 'page',
        totalOutputs: 7,
        skipped: 1,
        outputsByModel: [
          { model: 'gpt-image-2', outputs: 3 },
          { model: 'gemini-3.1-flash-lite-image', outputs: 4 }
        ]
      })
      expect(estimateQaWork(request, estimate, inventory)).toMatchObject({
        mode: 'page',
        initialJudgeCalls: 7,
        reusedReports: 1,
        maximumAdditionalImageEdits: 14,
        maximumAdditionalJudgeCalls: 14,
        estimatedInputTokens: 35_000,
        estimatedOutputTokens: 8_400
      })

      const forcedRequest = { ...request, force: true }
      const forcedEstimate = estimatePageMode(forcedRequest, inventory)
      expect(forcedEstimate).toMatchObject({ totalOutputs: 8, skipped: 0 })
      expect(estimateQaWork(forcedRequest, forcedEstimate, inventory)).toMatchObject({
        initialJudgeCalls: 8,
        reusedReports: 0
      })
    })

  test('comic panel and grid price estimation preserves grouped skips and local composite counts', () => {
      const request = normalizeFinalImageEstimateRequest({
        scriptPath: 'scene.md',
        sceneSlug: 'scene',
        panelsPerImage: 1,
        grid: { columns: 2, rows: 3 },
        imageModels: ['gpt-image-2', 'gemini-3.1-flash-lite-image'],
        variations: ['canonical', 'animation-polish'],
        maxRepairs: 2
      })
      if (request.mode !== 'grid') throw new Error('Expected grid request')

      const inventory: FinalImagePanelInventory = {
        mode: 'grid',
        panelPromptsDir: 'panel-prompts',
        panels: [
          {
            directoryName: 'panel-01',
            panelNumber: 1,
            referenceCount: 2,
            variations: [
              { variation: 'canonical', allModelsExist: true },
              { variation: 'animation-polish', allModelsExist: false }
            ]
          },
          {
            directoryName: 'panel-02',
            panelNumber: 2,
            referenceCount: 2,
            variations: [
              { variation: 'canonical', allModelsExist: false },
              { variation: 'animation-polish', allModelsExist: true }
            ]
          }
        ],
        gridPages: [{
          pageNumber: 1,
          panelNumbers: [1, 2],
          outputs: [
            { model: 'gpt-image-2', variation: 'canonical', outputPath: 'a', exists: true, qaReportReusable: false },
            { model: 'gpt-image-2', variation: 'animation-polish', outputPath: 'b', exists: false, qaReportReusable: false },
            { model: 'gemini-3.1-flash-lite-image', variation: 'canonical', outputPath: 'c', exists: true, qaReportReusable: false },
            { model: 'gemini-3.1-flash-lite-image', variation: 'animation-polish', outputPath: 'd', exists: false, qaReportReusable: false }
          ]
        }]
      }

      const estimate = estimatePanelMode(request, inventory)
      expect(estimate).toEqual({
        mode: 'grid',
        totalOutputs: 2,
        skipped: 2,
        grid: {
          totalOutputs: 2,
          skipped: 2,
          columns: 2,
          rows: 3,
          capacity: 6
        }
      })
      expect(estimateQaWork(request, estimate, inventory)).toMatchObject({
        mode: 'panel',
        initialJudgeCalls: 2,
        maximumAdditionalImageEdits: 4,
        maximumAdditionalJudgeCalls: 4,
        maximumTotalJudgeCalls: 6,
        estimatedInputTokens: 30_000,
        estimatedOutputTokens: 7_200
      })

      const forcedEstimate = estimatePanelMode({ ...request, force: true }, inventory)
      expect(forcedEstimate).toMatchObject({
        totalOutputs: 4,
        skipped: 0,
        grid: { totalOutputs: 4, skipped: 0 }
      })
    })

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

      expect(cost({ grokVideoModel: 'grok-imagine-video', videoDuration: 5 })).toBe('25.00¢')
      expect(cost({ grokVideoModel: 'grok-imagine-video-1.5', videoDuration: 5 })).toBe('40.00¢')
      expect(cost({ ltxVideoModel: 'ltx-2-3-fast', videoDuration: 5 })).toBe('36.00¢')
      expect(cost({ lumalabsVideoModel: 'ray-3.2', videoDuration: 5 })).toBe('30.00¢')

      expect(cost({ replicateVideoModel: 'alibaba/happyhorse-1.1', videoDuration: 5, videoResolution: '720p' })).toBe('70.00¢')
      expect(cost({ replicateVideoModel: 'alibaba/happyhorse-1.1', videoDuration: 5, videoResolution: '1080p' })).toBe('90.00¢')
      expect(cost({ replicateVideoModel: 'kwaivgi/kling-v3-video', videoDuration: 5, videoResolution: '720p' })).toBe('84.00¢')
      expect(cost({ replicateVideoModel: 'kwaivgi/kling-v3-video', videoDuration: 5, videoResolution: '1080p', videoGenerateAudio: true })).toBe('$1.68')
      expect(cost({ replicateVideoModel: 'kwaivgi/kling-v3-omni-video', videoDuration: 5, videoResolution: '1080p', videoGenerateAudio: true })).toBe('$1.40')
      expect(cost({ replicateVideoModel: 'pixverse/pixverse-v6', videoDuration: 5, videoResolution: '360p' })).toBe('25.00¢')
      expect(cost({ replicateVideoModel: 'pixverse/pixverse-v6', videoDuration: 5, videoResolution: '1080p', videoGenerateAudio: true })).toBe('$1.15')
      expect(cost({ replicateVideoModel: 'bytedance/seedance-2.0', videoDuration: 5, videoResolution: '480p' })).toBe('40.00¢')
      expect(cost({ replicateVideoModel: 'bytedance/seedance-2.0', videoDuration: 5, videoResolution: '720p', replicateVideoReferenceVideoCount: 1 })).toBe('$1.10')
      expect(cost({ replicateVideoModel: 'bytedance/seedance-2.0-fast', videoDuration: -1, videoResolution: '720p' })).toBe('75.00¢')
      expect(cost({ replicateVideoModel: 'bytedance/seedance-2.0-fast', videoDuration: 5, videoResolution: '720p', replicateVideoReferenceVideoCount: 1 })).toBe('85.00¢')

      expect(cost({ ltxVideoModel: 'ltx-2-3-fast', videoDuration: 8 })).toBe('48.00¢')
      expect(cost({ ltxVideoModel: 'ltx-2-3-fast', videoDuration: 8, videoResolution: '4k' })).toBe('$1.92')
      expect(cost({ ltxVideoModel: 'ltx-2-3-fast', videoDuration: 12, videoResolution: '4k', videoAspectRatio: '9:16' })).toBe('$2.40')
      expect(cost({ ltxVideoModel: 'ltx-2-3-pro', videoMode: 'extend', videoDuration: 5 })).toBe('50.00¢')

      expect(cost({ grokVideoModel: 'grok-imagine-video', videoDuration: 5, videoResolution: '480p' })).toBe('25.00¢')
      expect(cost({ grokVideoModel: 'grok-imagine-video', videoDuration: 5, videoResolution: '720p' })).toBe('35.00¢')
      expect(cost({ grokVideoModel: 'grok-imagine-video', videoDuration: 5, videoResolution: '480p', grokInputImageCount: 1 })).toBe('25.20¢')
      expect(cost({ grokVideoModel: 'grok-imagine-video-1.5', videoDuration: 5, videoResolution: '1080p', grokInputImageCount: 1 })).toBe('$1.26')

      expect(cost({ geminiVideoModel: 'veo-3.1-lite-generate-preview', videoDuration: 4, videoResolution: '720p' })).toBe('20.00¢')
      expect(cost({ geminiVideoModel: 'veo-3.1-lite-generate-preview', videoDuration: 4, videoResolution: '1080p' })).toBe('64.00¢')
      expect(cost({ geminiVideoModel: 'veo-3.1-fast-generate-preview', videoDuration: 4, videoResolution: '720p' })).toBe('40.00¢')
      expect(cost({ geminiVideoModel: 'veo-3.1-fast-generate-preview', videoDuration: 4, videoResolution: '1080p' })).toBe('96.00¢')
      expect(cost({ geminiVideoModel: 'veo-3.1-fast-generate-preview', videoDuration: 4, videoResolution: '4k' })).toBe('$2.40')
      expect(cost({ geminiVideoModel: 'veo-3.1-generate-preview', videoDuration: 4, videoResolution: '720p' })).toBe('$1.60')
      expect(cost({ geminiVideoModel: 'veo-3.1-generate-preview', videoDuration: 4, videoResolution: '1080p' })).toBe('$3.20')
      expect(cost({ geminiVideoModel: 'veo-3.1-generate-preview', videoDuration: 4, videoResolution: '4k' })).toBe('$4.80')
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
      expect(resolveCheapestModelForFlag('gemini-music')).toBe('lyria-3-pro-preview')
      expect(resolveCheapestModelForFlag('elevenlabs-music')).toBe('music_v2')
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
        geminiMusicModels: ['lyria-3-pro-preview'],
        musicDuration: 90
      })

      expect(estimates.map((estimate) => ({
        provider: estimate.provider,
        model: estimate.model,
        totalCost: estimate.totalCost
      }))).toEqual([
        { provider: 'gemini', model: 'lyria-3-pro-preview', totalCost: 8 }
      ])
    })

  test('retired MiniMax music-2.6 still reprices from historical rates', () => {
      const archived: Step7MusicMetadata = {
        musicService: 'minimax',
        musicModel: 'music-2.6',
        processingTime: 240_000,
        musicFileName: 'music.mp3',
        musicFileSize: 1234,
        musicDurationMs: 176_875,
        lyricsSource: 'generated'
      }

      expect(computeActualCosts({ step7: archived }).steps[0]).toMatchObject({
        step: 'music',
        provider: 'minimax',
        model: 'music-2.6',
        cost: 16,
        costSource: 'registry_fallback'
      })

      expect(computeActualCosts({
        step7: { ...archived, lyricsSource: 'provided' }
      }).steps[0]).toMatchObject({ cost: 15 })

      expect(computeActualCosts({
        step7: { ...archived, providerCostCents: 21 }
      }).steps[0]).toMatchObject({ cost: 21 })
    })

  test('retired Gemini image benchmark results retain historical output pricing', () => {
      expect(computeActualCosts({
        step5: {
          imageService: 'gemini',
          imageModel: 'gemini-3.1-flash-image-preview',
          processingTime: 16_107,
          imageFileNames: ['generated-image.png'],
          imageCount: 1,
          imageFileSize: 1234
        } as unknown as Step5Metadata
      }).steps[0]).toMatchObject({
        step: 'image',
        provider: 'gemini',
        model: 'gemini-3.1-flash-image-preview',
        cost: 6.7,
        costSource: 'registry_fallback'
      })
    })
})
