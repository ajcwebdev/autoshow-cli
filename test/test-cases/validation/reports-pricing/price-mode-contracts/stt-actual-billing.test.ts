import { describe, expect, test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeSttCost } from '~/cli/commands/pricing-orchestration/cost-helpers'
import { computeBilledSttCost } from '~/cli/commands/pricing-orchestration/stt-billing'
import { computeGeminiSttBillingFromUsage } from '~/cli/commands/stt/diarization-off-by-default/gemini-stt/run-gemini-stt'
import { buildSttMetadata } from './shared'
import { buildHostedStep1 } from './stt-pricing-fixtures'



describe('price mode contracts', () => {
  test('STT actual fallback costs use explicit audio duration when step1 duration is unknown', () => {
      const audioDurationSeconds = 59.585306
      const actual = computeActualCosts({
        step1: buildHostedStep1(),
        step2: buildSttMetadata(),
        audioDurationSeconds
      })
      const sttStep = actual.steps[0]

      expect(sttStep).toMatchObject({
        step: 'stt',
        provider: 'deepgram',
        model: 'nova-3',
        inputMetric: 'durationSeconds',
        inputValue: audioDurationSeconds
      })
      expect(sttStep?.cost).toBe(computeSttCost('deepgram', 'nova-3', audioDurationSeconds))
      expect(actual.totalCost).toBeGreaterThan(0)
    })

  test('STT billing metadata applies provider minimums and rounding', () => {
      const oneSecond = computeBilledSttCost('rev', 'machine', 1)
      expect(oneSecond.requestedDurationSeconds).toBe(1)
      expect(oneSecond.billedDurationSeconds).toBe(15)
      expect(oneSecond.cost).toBeCloseTo((15 / 3600) * 20)

      const fractional = computeBilledSttCost('rev', 'machine', 15.2)
      expect(fractional.requestedDurationSeconds).toBe(15.2)
      expect(fractional.billedDurationSeconds).toBe(16)
    })

  test('Happy Scribe zero provider quotes fall back to configured duration cost', () => {
      const audioDurationSeconds = 600
      const actual = computeActualCosts({
        step1: buildHostedStep1({ durationSeconds: audioDurationSeconds }),
        step2: buildSttMetadata({
          transcriptionService: 'happyscribe',
          transcriptionModel: 'auto',
          billing: {
            totalCost: 0,
            source: 'provider_quote',
            mode: 'order',
            creditsUsed: 0
          }
        }),
        audioDurationSeconds
      })
      const sttStep = actual.steps[0]
      const expectedCost = computeSttCost('happyscribe', 'auto', audioDurationSeconds)

      expect(expectedCost).toBe(10)
      expect(sttStep).toMatchObject({
        step: 'stt',
        provider: 'happyscribe',
        model: 'auto',
        cost: expectedCost,
        inputMetric: 'durationSeconds',
        inputValue: audioDurationSeconds
      })
      expect(actual.totalCost).toBe(expectedCost)
    })

  test('STT provider billing metadata wins over duration fallback', () => {
      const audioDurationSeconds = 3600
      const providerCostCents = 1.23
      const actual = computeActualCosts({
        step1: buildHostedStep1(),
        step2: buildSttMetadata({
          transcriptionService: 'deepgram',
          transcriptionModel: 'nova-3',
          billing: {
            totalCost: providerCostCents,
            source: 'provider_quote',
            mode: 'duration'
          }
        }),
        audioDurationSeconds
      })
      const sttStep = actual.steps[0]

      expect(computeSttCost('deepgram', 'nova-3', audioDurationSeconds)).toBeGreaterThan(providerCostCents)
      expect(sttStep).toMatchObject({
        step: 'stt',
        provider: 'deepgram',
        model: 'nova-3',
        cost: providerCostCents,
        inputMetric: 'durationSeconds',
        inputValue: audioDurationSeconds
      })
      expect(actual.totalCost).toBe(providerCostCents)
    })

  test('Gemini STT actual costs use usage metadata token billing', () => {
      const billing = computeGeminiSttBillingFromUsage('gemini-3.6-flash', {
        promptTokenCount: 1200,
        promptTokensDetails: [
          { modality: 'AUDIO', tokenCount: 1000 },
          { modality: 'TEXT', tokenCount: 200 }
        ],
        candidatesTokenCount: 80,
        thoughtsTokenCount: 20,
        totalTokenCount: 1300
      })

      expect(billing).toMatchObject({
        inputTokens: 1200,
        outputTokens: 100,
        totalTokens: 1300,
        audioInputTokens: 1000,
        textInputTokens: 200,
        source: 'provider_usage',
        mode: 'token'
      })
      expect(billing?.totalCost).toBeCloseTo(0.255)

      const actual = computeActualCosts({
        step1: buildHostedStep1(),
        step2: buildSttMetadata({
          transcriptionService: 'gemini-stt',
          transcriptionModel: 'gemini-3.6-flash',
          ...(billing ? { billing } : {})
        }),
        audioDurationSeconds: 3600
      })

      expect(actual.steps[0]).toMatchObject({
        step: 'stt',
        provider: 'gemini-stt',
        model: 'gemini-3.6-flash',
        costSource: 'provider_usage',
        inputMetric: 'tokens',
        inputValue: 1300,
        promptTokens: 1200,
        completionTokens: 100
      })
      expect(actual.steps[0]?.cost).toBeCloseTo(0.255)
      expect(actual.totalCost).toBeCloseTo(0.255)
    })
})
