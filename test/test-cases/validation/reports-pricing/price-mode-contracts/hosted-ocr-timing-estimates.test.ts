import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveHostedOcrEstimateCap } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler'
import { computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'

const missingProfilePath = (): string =>
  join(tmpdir(), `autoshow-missing-ocr-profile-${process.pid}-${Date.now()}-${Math.random()}.json`)

describe('hosted OCR timing estimate contracts', () => {
  test('hosted OCR estimates use adaptive auto caps and explicit fixed caps', () => {
      const pageCount = 1024
      const model = 'gemini-3.5-flash'
      const autoTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'gemini', model, pageCount }],
        hostedOcrProfilePath: missingProfilePath()
      })
      const fixedTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'gemini', model, pageCount }],
        ocrConcurrency: 4,
        ocrConcurrencyMode: 'fixed',
        hostedOcrProfilePath: missingProfilePath()
      })

      expect(autoTiming.steps[0]).toMatchObject({
        provider: 'gemini',
        model,
        timingAdjustment: {
          kind: 'hosted-ocr-page-concurrency',
          pageConcurrency: resolveHostedOcrEstimateCap(pageCount, 'auto'),
          ocrConcurrencyMode: 'auto',
          estimateConfidence: 'registry'
        }
      })
      expect(fixedTiming.steps[0]).toMatchObject({
        provider: 'gemini',
        model,
        timingAdjustment: {
          kind: 'hosted-ocr-page-concurrency',
          pageConcurrency: 4,
          ocrConcurrencyMode: 'fixed',
          estimateConfidence: 'registry'
        }
      })
      expect(fixedTiming.steps[0]?.processingTimeMs ?? 0).toBeGreaterThan(autoTiming.steps[0]?.processingTimeMs ?? 0)
    })

  test('same-provider hosted OCR targets share provider lane capacity in total estimates', () => {
      const sameProviderTiming = computeEstimatedProcessingTimes({
        extractTargets: [
          { provider: 'gemini', model: 'gemini-3.5-flash', pageCount: 20 },
          { provider: 'gemini', model: 'gemini-3.5-flash-lite', pageCount: 20 }
        ],
        ocrConcurrency: 1,
        ocrConcurrencyMode: 'fixed',
        ocrProviderConcurrency: 2,
        hostedOcrProfilePath: missingProfilePath()
      })
      const differentProviderTiming = computeEstimatedProcessingTimes({
        extractTargets: [
          { provider: 'gemini', model: 'gemini-3.5-flash', pageCount: 20 },
          { provider: 'openai', model: 'gpt-5.4-nano', pageCount: 20 }
        ],
        ocrConcurrency: 1,
        ocrConcurrencyMode: 'fixed',
        ocrProviderConcurrency: 2,
        hostedOcrProfilePath: missingProfilePath()
      })
      const sameProviderStepMax = Math.max(...sameProviderTiming.steps.map((step) => step.processingTimeMs))
      const differentProviderStepMax = Math.max(...differentProviderTiming.steps.map((step) => step.processingTimeMs))

      expect(sameProviderTiming.totalProcessingTimeMs).toBe(sameProviderStepMax)
      expect(differentProviderTiming.totalProcessingTimeMs).toBe(differentProviderStepMax)
      expect(sameProviderTiming.steps.every((step) =>
        step.timingAdjustment?.['sharedProviderLaneTargetCount'] === 2
      )).toBe(true)
      expect(sameProviderTiming.likelyGatingTargets?.[0]).toMatchObject({
        step: 'extract',
        provider: 'gemini'
      })
    })

  test('shared-lane throughput profiles use profiled lane target counts for timing estimates', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-shared-lane-profile-'))
      const profilePath = join(tempDir, 'profiles.json')
      const pageCount = 312

      try {
        await writeFile(profilePath, JSON.stringify({
          version: 2,
          profiles: [
            {
              provider: 'gemini',
              model: 'gemini-3.5-flash',
              scopeClass: 'env-api-key',
              pageCountBand: '201-1000',
              ocrConcurrencyMode: 'auto',
              laneTargetCount: 2,
              throughputPagesPerMinute: 60,
              activePeak: 18,
              retryPressureCount: 0,
              pauseTimeMs: 0,
              completionStatus: 'full',
              firstSeenAt: '2026-07-12T19:21:00.000Z',
              lastSeenAt: '2026-07-12T19:21:00.000Z',
              sampleCount: 1,
              cleanSampleCount: 1,
              raisedMaxCap: 20,
              capSource: 'exact-clean-sample',
              sourceConfidence: 'healthy'
            },
            {
              provider: 'gemini',
              model: 'gemini-3.1-pro-preview',
              scopeClass: 'env-api-key',
              pageCountBand: '201-1000',
              ocrConcurrencyMode: 'auto',
              throughputPagesPerMinute: 60,
              activePeak: 18,
              retryPressureCount: 0,
              pauseTimeMs: 0,
              completionStatus: 'full',
              firstSeenAt: '2026-07-11T19:21:00.000Z',
              lastSeenAt: '2026-07-11T19:21:00.000Z',
              sampleCount: 1,
              cleanSampleCount: 1,
              raisedMaxCap: 20,
              capSource: 'exact-clean-sample',
              sourceConfidence: 'healthy'
            }
          ]
        }, null, 2))

        const timing = computeEstimatedProcessingTimes({
          extractTargets: [
            { provider: 'gemini', model: 'gemini-3.5-flash', pageCount },
            { provider: 'gemini', model: 'gemini-3.1-pro-preview', pageCount }
          ],
          hostedOcrProfilePath: profilePath
        })
        const flash = timing.steps.find((step) => step.model === 'gemini-3.5-flash')
        const pro = timing.steps.find((step) => step.model === 'gemini-3.1-pro-preview')

        expect(flash).toMatchObject({
          processingTimeMs: 312_000,
          timingAdjustment: {
            estimateConfidence: 'profile',
            sharedProviderLaneTargetCount: 2,
            profileLaneTargetCount: 2
          }
        })
        expect(flash?.timingAdjustment?.['sharedProviderLaneScale']).toBeUndefined()
        expect(pro).toMatchObject({
          processingTimeMs: 624_000,
          timingAdjustment: {
            estimateConfidence: 'profile',
            sharedProviderLaneTargetCount: 2,
            sharedProviderLaneScale: 2
          }
        })
        expect(timing.totalProcessingTimeMs).toBe(624_000)
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('hosted OCR timing uses healthy profiles and blends sparse profiles', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-timing-'))
      const profilePath = join(tempDir, 'profiles.json')
      const pageCount = 20

      try {
        await writeFile(profilePath, JSON.stringify({
          version: 2,
          profiles: [
            {
              provider: 'gemini',
              model: 'gemini-3.5-flash',
              scopeClass: 'env-api-key',
              pageCountBand: '11-50',
              ocrConcurrencyMode: 'auto',
              throughputPagesPerMinute: 600,
              activePeak: 12,
              retryPressureCount: 0,
              pauseTimeMs: 0,
              completionStatus: 'full',
              firstSeenAt: '2026-07-11T12:00:00.000Z',
              lastSeenAt: '2026-07-11T12:02:00.000Z',
              sampleCount: 3
            },
            {
              provider: 'gemini',
              model: 'gemini-3.5-flash-lite',
              scopeClass: 'env-api-key',
              pageCountBand: '11-50',
              ocrConcurrencyMode: 'auto',
              throughputPagesPerMinute: 600,
              activePeak: 12,
              retryPressureCount: 1,
              pauseTimeMs: 250,
              completionStatus: 'incomplete',
              firstSeenAt: '2026-07-11T12:00:00.000Z',
              lastSeenAt: '2026-07-11T12:02:00.000Z',
              sampleCount: 1
            }
          ]
        }, null, 2))

        const healthyTiming = computeEstimatedProcessingTimes({
          extractTargets: [{ provider: 'gemini', model: 'gemini-3.5-flash', pageCount }],
          hostedOcrProfilePath: profilePath
        })
        const sparseTiming = computeEstimatedProcessingTimes({
          extractTargets: [{ provider: 'gemini', model: 'gemini-3.5-flash-lite', pageCount }],
          hostedOcrProfilePath: profilePath
        })
        const registryMs = Math.round(Math.ceil(pageCount / resolveHostedOcrEstimateCap(pageCount, 'auto')) * getExtractEstimation('gemini', 'gemini-3.5-flash-lite').msPerPage)

        expect(healthyTiming.estimateConfidence).toBe('profile')
        expect(healthyTiming.steps[0]).toMatchObject({
          processingTimeMs: 2000,
          timingAdjustment: {
            estimateConfidence: 'profile',
            profileSampleCount: 3,
            profileThroughputPagesPerMinute: 600
          }
        })
        expect(healthyTiming.likelyGatingTargets?.[0]).toMatchObject({
          step: 'extract',
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          processingTimeMs: 2000
        })
        expect(sparseTiming.estimateConfidence).toBe('blended')
        expect(sparseTiming.steps[0]).toMatchObject({
          timingAdjustment: {
            estimateConfidence: 'blended',
            profileSampleCount: 1,
            profileThroughputPagesPerMinute: 600
          }
        })
        expect(sparseTiming.steps[0]?.processingTimeMs ?? 0).toBeGreaterThan(2000)
        expect(sparseTiming.steps[0]?.processingTimeMs ?? 0).toBeLessThan(registryMs)
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
})
