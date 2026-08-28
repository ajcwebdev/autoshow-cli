import { describe, expect, test } from 'bun:test'
import { getVideoEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildSttMetadata } from './shared'

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
        musicTargets: [{ service: 'gemini', model: 'lyria-3-pro-preview' }]
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
})
