import { describe, expect, test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { buildSttMetadata, findPricingNoteKeys } from './shared'
import { buildHostedStep1 } from './stt-pricing-fixtures'



describe('price mode contracts', () => {

  test('Supadata STT credit estimates are exact under default multipliers', () => {
      const audioDurationSeconds = 3600
      const expectedCredits = 120
      const estimated = computeEstimatedCosts({
        sourceUrl: 'https://example.com/audio.mp3',
        audioDurationSeconds,
        sttTargets: [
          { service: 'supadata', model: 'auto' }
        ]
      })

      expect(estimated.steps[0]).toMatchObject({
        step: 'stt',
        provider: 'supadata',
        model: 'auto',
        cost: expectedCredits,
        costMultiplier: 1,
        durationSeconds: audioDurationSeconds
      })
      expect(estimated.totalCost).toBe(expectedCredits)
    })

  test('Supadata STT estimates force generation pricing for direct media URLs', () => {
      const audioDurationSeconds = 2423.04
      const expectedCredits = (audioDurationSeconds / 60) * 2
      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        sourceUrl: 'https://ajc.pics/autoshow/benchmarks/stt/2022-09-30-widgets-fsjam-40-minutes.mp3',
        audioDurationSeconds,
        sttTargets: [
          { service: 'supadata', model: 'auto' }
        ]
      })

      expect(estimated.steps.map((step) => ({
        provider: step.provider,
        model: step.model,
        cost: Number(step.cost.toFixed(5))
      }))).toEqual([
        { provider: 'supadata', model: 'auto', cost: Number(expectedCredits.toFixed(5)) }
      ])
      expect(findPricingNoteKeys(estimated)).toEqual([])

      const platformAuto = computeEstimatedCosts({
        applyCostMultipliers: false,
        sourceUrl: 'https://www.youtube.com/watch?v=MORMZXEaONk',
        audioDurationSeconds,
        sttTargets: [{ service: 'supadata', model: 'auto' }]
      })
      expect(platformAuto.steps[0]?.cost).toBe(expectedCredits)
    })

  test('Supadata actual fallback forces generation pricing for direct media URLs', () => {
      const audioDurationSeconds = 2423.04
      const expectedCredits = (audioDurationSeconds / 60) * 2
      const actual = computeActualCosts({
        step1: buildHostedStep1(),
        step2: buildSttMetadata({
          transcriptionService: 'supadata',
          transcriptionModel: 'auto'
        }),
        audioDurationSeconds
      })

      expect(actual.steps[0]).toMatchObject({
        step: 'stt',
        provider: 'supadata',
        model: 'auto',
        inputMetric: 'credits'
      })
      expect(actual.steps[0]?.cost).toBeCloseTo(expectedCredits)
      expect(actual.steps[0]?.inputValue).toBeCloseTo(expectedCredits)
    })

  test('ScrapeCreators STT estimates and actuals use a fixed one-credit request', () => {
      const audioDurationSeconds = 9999
      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        audioDurationSeconds,
        sttTargets: [
          { service: 'scrapecreators', model: 'youtube-transcript' }
        ]
      })

      expect(estimated.steps[0]).toMatchObject({
        step: 'stt',
        provider: 'scrapecreators',
        model: 'youtube-transcript',
        cost: 0.188,
        durationSeconds: 0
      })
      expect(estimated.totalCost).toBe(0.188)

      const actual = computeActualCosts({
        step1: buildHostedStep1(),
        step2: buildSttMetadata({
          transcriptionService: 'scrapecreators',
          transcriptionModel: 'youtube-transcript',
          billing: {
            creditsUsed: 1,
            creditRateCents: 0.188,
            totalCost: 0.188,
            source: 'registry_fallback',
            mode: 'url'
          }
        }),
        audioDurationSeconds
      })

      expect(actual.steps[0]).toMatchObject({
        step: 'stt',
        provider: 'scrapecreators',
        model: 'youtube-transcript',
        cost: 0.188,
        costSource: 'registry_fallback',
        inputMetric: 'credits',
        inputValue: 1
      })
      expect(actual.totalCost).toBe(0.188)
    })
})
