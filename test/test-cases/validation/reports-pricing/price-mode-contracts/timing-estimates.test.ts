import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getExtractEstimation, getMusicEstimation, getVideoEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { collectEstimatedExtractTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { buildAggregateTiming } from '~/utils/pricing/aggregate-pricing/timing'
import type { ExtractionMetadata, StepEstimate } from '~/types'
import { buildSttMetadata } from './shared'

const missingHostedOcrProfilePath = (): string =>
  join(tmpdir(), `autoshow-missing-ocr-profile-${process.pid}-${Date.now()}-${Math.random()}.json`)

describe('price mode contracts', () => {
  test('timing estimates include normalized rates and throughput fields', () => {
      const timing = computeEstimatedProcessingTimes({
        sttTargets: [{ service: 'deepgram', model: 'nova-3' }],
        audioDurationSeconds: 10,
        extractTargets: [{ provider: 'kimi', model: 'kimi-k2.6', pageCount: 2 }],
        llmTargets: [{ service: 'openai', model: 'gpt-5.4-nano', inputTokens: 600, outputTokens: 400 }],
        ttsTargets: [{ service: 'openai', model: 'gpt-4o-mini-tts-2025-12-15' }],
        ttsCharacterCount: 1000,
        imageTargets: [{ service: 'openai', model: 'gpt-image-2', count: 2 }],
        videoTargets: [{ service: 'gemini', model: 'veo-3.1-lite-generate-preview', durationSeconds: 4 }],
        musicTargets: [{ service: 'gemini', model: 'lyria-3-clip-preview' }]
      })

      const rows = new Map(timing.steps.map((step) => [step.step, step]))
      expect(rows.get('stt')).toMatchObject({
        rateBasis: 'durationSecond',
        throughputUnit: 'x',
        timingScope: 'estimated'
      })
      expect(rows.get('video')).toMatchObject({
        rateBasis: 'durationSecond',
        throughputUnit: 'x',
        msPerUnit: getVideoEstimation('gemini', 'veo-3.1-lite-generate-preview').msPerSecond
      })
      expect(rows.get('music')).toMatchObject({
        rateBasis: 'durationSecond',
        throughputUnit: 'x'
      })
      expect(rows.get('llm')).toMatchObject({
        rateBasis: '1KTokens',
        throughputUnit: 'tokensPerSecond'
      })
      expect(rows.get('tts')).toMatchObject({
        rateBasis: '1KCharacters',
        throughputUnit: 'charactersPerSecond'
      })
      expect(rows.get('extract')).toMatchObject({
        rateBasis: 'page',
        throughputUnit: 'pagesPerMinute'
      })
      expect(rows.get('image')).toMatchObject({
        rateBasis: 'image',
        throughputUnit: 'imagesPerMinute'
      })
    })

  test('actual STT timing preserves wall-clock scope and phase breakdowns', () => {
      const actual = computeActualProcessingTimes({
        audioDurationSeconds: 10,
        step2: buildSttMetadata({
          processingTime: 2500,
          timings: {
            uploadMs: 100,
            createMs: 200,
            pollMs: 300,
            pollSleepMs: 400,
            transcriptMs: 500,
            cleanupMs: 50,
            remoteProcessingMs: 950,
            requestCount: 3
          }
        })
      })

      expect(actual.steps[0]).toMatchObject({
        timingScope: 'wall',
        rateBasis: 'durationSecond',
        msPerUnit: 250,
        throughputValue: 4,
        timingBreakdown: {
          uploadMs: 100,
          createMs: 200,
          pollMs: 300,
          pollSleepMs: 400,
          transcriptMs: 500,
          cleanupMs: 50,
          remoteProcessingMs: 950
        }
      })
      expect(actual.steps[0]?.timingBreakdown).not.toHaveProperty('requestCount')
    })

  test('actual native EPUB timing uses section throughput', () => {
      const actual = computeActualProcessingTimes({
        step2: {
          extractionMethod: 'epub-text',
          totalPages: 9,
          ocrPages: 0,
          textPages: 9,
          processingTime: 60000,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 12000,
          outputFidelity: 'cleaned-epub-text'
        }
      })

      expect(actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'extract',
        model: 'epub-text',
        inputMetric: 'sections',
        inputValue: 9,
        rateBasis: 'section',
        throughputUnit: 'sectionsPerMinute',
        throughputValue: 9
      })
    })

  test('actual parallel hosted OCR timing uses provider-pool wall time and preserves summed provider time', () => {
      const actual = computeActualProcessingTimes({
        ocrProviderConcurrency: 4,
        step2: [{
          extractionMethod: 'pdf+deepinfra-ocr',
          totalPages: 228,
          ocrPages: 228,
          textPages: 0,
          processingTime: 280_242,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 10_000,
          ocrService: 'deepinfra',
          ocrModel: 'Qwen/Qwen3-VL-235B-A22B-Instruct'
        }, {
          extractionMethod: 'pdf+grok-ocr',
          totalPages: 228,
          ocrPages: 228,
          textPages: 0,
          processingTime: 50_372,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 10_000,
          ocrService: 'grok',
          ocrModel: 'grok-4.20-0309-non-reasoning'
        }, {
          extractionMethod: 'pdf+gemini-ocr',
          totalPages: 228,
          ocrPages: 228,
          textPages: 0,
          processingTime: 121_384,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 10_000,
          ocrService: 'gemini',
          ocrModel: 'gemini-3.5-flash'
        }, {
          extractionMethod: 'pdf+gemini-ocr',
          totalPages: 228,
          ocrPages: 228,
          textPages: 0,
          processingTime: 121_901,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 10_000,
          ocrService: 'gemini',
          ocrModel: 'gemini-3.1-pro-preview'
        }],
        hostedOcrScheduler: {
          version: 1,
          mode: 'auto',
          documentPages: 228,
          lanes: [{
            laneKey: 'gemini:env-api-key',
            service: 'gemini',
            scopeLabel: 'env-api-key',
            status: 'succeeded',
            mode: 'auto',
            initialCap: 10,
            currentCap: 16,
            maxCap: 16,
            activePeak: 16,
            retryPressureCount: 0,
            pauseTimeMs: 0,
            submittedPages: 456,
            completedPages: 456,
            failedPages: 0,
            pagesPerMinute: 300,
            observedDurationMs: 100_000,
            targets: []
          }]
        }
      })

      expect(actual.totalProcessingTimeMs).toBe(280_242)
      expect(actual.sumOfStepProcessingTimeMs).toBe(573_899)
      expect(actual.steps).toHaveLength(4)
    })

  test('OCR timing estimates use default page concurrency and explicit serial overrides', () => {
      const pageCount = 21
      const model = 'kimi-k2.6'
      const msPerPage = getExtractEstimation('kimi', model).msPerPage
      const defaultTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'kimi', model, pageCount }],
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })
      const serialTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'kimi', model, pageCount }],
        ocrConcurrency: 1,
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })

      expect(defaultTiming.steps[0]).toMatchObject({
        provider: 'kimi',
        model,
        inputValue: pageCount,
        processingTimeMs: Math.round(Math.ceil(pageCount / DEFAULT_OCR_CONCURRENCY) * msPerPage)
      })
      expect(serialTiming.steps[0]).toMatchObject({
        provider: 'kimi',
        model,
        inputValue: pageCount,
        processingTimeMs: Math.round(pageCount * msPerPage)
      })
      expect(defaultTiming.steps[0]?.throughputValue ?? 0).toBeGreaterThan(serialTiming.steps[0]?.throughputValue ?? 0)
    })

  test('OCR timing estimates adjust rasterized single-page PDF fallback pages', () => {
      const pageCount = 4
      const rasterizedPages = 2
      const model = 'kimi-k2.6'
      const msPerPage = getExtractEstimation('kimi', model).msPerPage
      const metadata: ExtractionMetadata = {
        extractionMethod: 'pdf+kimi-ocr',
        totalPages: pageCount,
        ocrPages: pageCount,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'kimi',
        ocrModel: model,
        pdfChunkPreparation: {
          strategy: 'raster-only',
          directPageAttempts: 2,
          directSuccesses: 0,
          directFailures: 2,
          rasterizedPages,
          directSplittingDisabled: true,
          tools: []
        }
      }
      const extractTargets = collectEstimatedExtractTargets(metadata)
      const normalTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'kimi', model, pageCount }],
        ocrConcurrency: 2
      })
      const rasterTiming = computeEstimatedProcessingTimes({
        extractTargets: extractTargets.map((target) => ({
          provider: target.provider,
          model: target.model,
          ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
          ...(typeof target.rasterizedPages === 'number' ? { rasterizedPages: target.rasterizedPages } : {})
        })),
        ocrConcurrency: 2
      })

      expect(extractTargets[0]?.rasterizedPages).toBe(rasterizedPages)
      expect(rasterTiming.steps[0]).toMatchObject({
        provider: 'kimi',
        model,
        inputValue: pageCount,
        processingTimeMs: Math.round(3 * msPerPage),
        timingAdjustment: {
          kind: 'rasterized-single-page-pdf-fallback',
          rasterizedPages,
          directPdfPages: 2,
          rasterizedPageMultiplier: 2,
          pageConcurrency: 2
        }
      })
      expect(rasterTiming.steps[0]?.timingNote).toContain('Rasterized single-page PDF fallback')
      expect(rasterTiming.steps[0]?.processingTimeMs ?? 0).toBeGreaterThan(normalTiming.steps[0]?.processingTimeMs ?? 0)
    })

  test('Gemini 3.5 Flash timing uses single-page PDF fallback calibration from chunk metadata', () => {
      const pageCount = 4
      const model = 'gemini-3.5-flash'
      const fallbackMsPerPage = getExtractEstimation('gemini', model).singlePagePdfFallbackMsPerPage
      const metadata: ExtractionMetadata = {
        extractionMethod: 'pdf+gemini-ocr',
        totalPages: pageCount,
        ocrPages: pageCount,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'gemini',
        ocrModel: model,
        pdfChunkPreparation: {
          strategy: 'direct',
          directPageAttempts: pageCount,
          directSuccesses: pageCount,
          directFailures: 0,
          rasterizedPages: 0,
          directSplittingDisabled: false,
          tools: [{ tool: 'mutool', attempts: pageCount, exitCodes: { '0': pageCount } }]
        }
      }
      const extractTargets = collectEstimatedExtractTargets(metadata)
      const normalTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'gemini', model, pageCount }],
        ocrConcurrency: 2
      })
      const fallbackTiming = computeEstimatedProcessingTimes({
        extractTargets: extractTargets.map((target) => ({
          provider: target.provider,
          model: target.model,
          ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
          ...(typeof target.singlePagePdfFallbackPages === 'number' ? { singlePagePdfFallbackPages: target.singlePagePdfFallbackPages } : {})
        })),
        ocrConcurrency: 2
      })

      expect(fallbackMsPerPage).toBe(16700)
      expect(extractTargets[0]?.singlePagePdfFallbackPages).toBe(pageCount)
      expect(fallbackTiming.steps[0]).toMatchObject({
        provider: 'gemini',
        model,
        inputValue: pageCount,
        processingTimeMs: 33400,
        timingAdjustment: {
          kind: 'single-page-pdf-fallback',
          singlePagePdfFallbackPages: pageCount,
          directPdfPages: 0,
          singlePagePdfFallbackMsPerPage: 16700,
          pageConcurrency: 2
        }
      })
      expect(fallbackTiming.steps[0]?.timingNote).toContain('single-page PDF OCR fallback')
      expect(fallbackTiming.steps[0]?.processingTimeMs ?? 0).toBeGreaterThan(normalTiming.steps[0]?.processingTimeMs ?? 0)
    })

  test('OCR timing estimates use hosted provider-pool concurrency for total time', () => {
      const extractTargets = [
        { provider: 'kimi' as const, model: 'kimi-k2.6', pageCount: 4 },
        { provider: 'openai' as const, model: 'gpt-5.4-nano', pageCount: 4 }
      ]
      const serialPool = computeEstimatedProcessingTimes({
        extractTargets,
        ocrConcurrency: 1,
        ocrProviderConcurrency: 1
      })
      const parallelPool = computeEstimatedProcessingTimes({
        extractTargets,
        ocrConcurrency: 1,
        ocrProviderConcurrency: 2
      })
      const serialStepTotal = serialPool.steps.reduce((sum, step) => sum + step.processingTimeMs, 0)
      const parallelStepMax = Math.max(...parallelPool.steps.map((step) => step.processingTimeMs))

      expect(serialPool.totalProcessingTimeMs).toBe(serialStepTotal)
      expect(parallelPool.totalProcessingTimeMs).toBe(parallelStepMax)
      expect(parallelPool.totalProcessingTimeMs).toBeLessThan(serialPool.totalProcessingTimeMs)
    })

  test('aggregate timing includes non-TTS step estimates when inputs are known', () => {
      const steps: StepEstimate[] = [
        { step: 'stt', provider: 'deepgram', model: 'nova-3', durationSeconds: 12, totalCost: 1 },
        {
          step: 'llm',
          provider: 'openai',
          model: 'gpt-5.4-nano',
          inputCostPer1MCents: 5,
          outputCostPer1MCents: 40,
          estimatedInputTokens: 600,
          estimatedOutputTokens: 400,
          totalCost: 1
        },
        { step: 'image', provider: 'openai', model: 'gpt-image-2', imageCount: 2, totalCost: 1 },
        { step: 'video', provider: 'gemini', model: 'veo-3.1-lite-generate-preview', durationSeconds: 4, totalCost: 1 },
        { step: 'music', provider: 'gemini', model: 'lyria-3-clip-preview', durationSeconds: 30, lyricsSource: 'generated', totalCost: 1 }
      ]

      const timing = buildAggregateTiming(steps, undefined)
      expect(timing?.steps.map((step) => step.step)).toEqual(['stt', 'llm', 'image', 'video', 'music'])
      expect(timing?.steps.every((step) => typeof step.msPerUnit === 'number')).toBe(true)
    })

  test('video timing estimates use normalized provider defaults when duration is omitted', () => {
      const timing = computeEstimatedProcessingTimes({
        videoTargets: [
          { service: 'gemini', model: 'veo-3.1-lite-generate-preview' },
          { service: 'ltx', model: 'ltx-2-3-fast' }
        ]
      })

      expect(timing.steps.map((step) => ({
        provider: step.provider,
        model: step.model,
        inputValue: step.inputValue,
        msPerUnit: step.msPerUnit
      }))).toEqual([
        {
          provider: 'gemini',
          model: 'veo-3.1-lite-generate-preview',
          inputValue: 4,
          msPerUnit: getVideoEstimation('gemini', 'veo-3.1-lite-generate-preview').msPerSecond
        },
        {
          provider: 'ltx',
          model: 'ltx-2-3-fast',
          inputValue: 8,
          msPerUnit: getVideoEstimation('ltx', 'ltx-2-3-fast').msPerSecond
        }
      ])
    })

  test('Gemini music timing estimates use Lyria defaults', () => {
      const timing = computeEstimatedProcessingTimes({
        musicTargets: [
          { service: 'gemini', model: 'lyria-3-clip-preview' },
          { service: 'gemini', model: 'lyria-3-pro-preview' }
        ]
      })

      const rows = timing.steps.map((step) => ({
        model: step.model,
        processingTimeMs: step.processingTimeMs,
        inputValue: step.inputValue
      }))
      expect(rows).toEqual([
        {
          model: 'lyria-3-clip-preview',
          processingTimeMs: Math.round((rows[0]?.inputValue ?? 0) * getMusicEstimation('gemini', 'lyria-3-clip-preview').msPerSecond),
          inputValue: rows[0]?.inputValue
        },
        {
          model: 'lyria-3-pro-preview',
          processingTimeMs: Math.round((rows[1]?.inputValue ?? 0) * getMusicEstimation('gemini', 'lyria-3-pro-preview').msPerSecond),
          inputValue: rows[1]?.inputValue
        }
      ])
    })

  test('MiniMax music timing estimates use the provider default duration', () => {
      const timing = computeEstimatedProcessingTimes({
        musicTargets: [
          { service: 'minimax', model: 'music-2.6' },
          { service: 'minimax', model: 'music-2.6', durationSeconds: 15 }
        ]
      })

      const rows = timing.steps.map((step) => ({
        provider: step.provider,
        model: step.model,
        processingTimeMs: step.processingTimeMs,
        inputValue: step.inputValue
      }))
      expect(rows).toEqual([
        {
          provider: 'minimax',
          model: 'music-2.6',
          processingTimeMs: Math.round((rows[0]?.inputValue ?? 0) * getMusicEstimation('minimax', 'music-2.6').msPerSecond),
          inputValue: rows[0]?.inputValue
        },
        {
          provider: 'minimax',
          model: 'music-2.6',
          processingTimeMs: Math.round((rows[1]?.inputValue ?? 0) * getMusicEstimation('minimax', 'music-2.6').msPerSecond),
          inputValue: rows[1]?.inputValue
        }
      ])
    })
})
