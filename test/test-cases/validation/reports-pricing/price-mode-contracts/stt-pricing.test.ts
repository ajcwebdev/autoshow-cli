import { describe, expect, test } from 'bun:test'
import { computeGeminiSttBillingFromUsage } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gemini-stt/run-gemini-stt'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeSttCost } from '~/utils/pricing/cost-helpers'
import { computeBilledSttCost } from '~/utils/pricing/stt-billing'
import type { Step1Metadata } from '~/types'
import { buildSttMetadata, findPricingNoteKeys } from './shared'

const buildHostedStep1 = (overrides: Partial<Step1Metadata> = {}): Step1Metadata => ({
  title: 'Hosted audio',
  duration: 'Unknown',
  channel: 'Unknown',
  description: '',
  url: 'https://example.com/audio.mp3',
  slug: 'hosted-audio',
  audioFileName: 'audio.mp3',
  audioFileSize: 1234,
  ...overrides
})

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

  test('Deepgram Nova-3 estimates include diarization at the current public rate', () => {
      const audioDurationSeconds = 3600
      const estimated = computeEstimatedCosts({
        audioDurationSeconds,
        sttTargets: [
          { service: 'deepgram', model: 'nova-3' }
        ]
      })

      expect(computeSttCost('deepgram', 'nova-3', audioDurationSeconds)).toBe(58.2)
      expect(estimated.steps[0]).toMatchObject({
        step: 'stt',
        provider: 'deepgram',
        model: 'nova-3',
        cost: 58.2,
        costMultiplier: 1,
        durationSeconds: audioDurationSeconds
      })
      expect(estimated.totalCost).toBe(58.2)
    })

  test('AssemblyAI estimates use diarization-inclusive rates without a multiplier', () => {
    const audioDurationSeconds = 3600
    const estimated = computeEstimatedCosts({
      audioDurationSeconds,
      sttTargets: [
        { service: 'assemblyai', model: 'universal-3-5-pro' },
        { service: 'assemblyai', model: 'universal-2' }
      ]
    })

    expect(estimated.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      cost: step.cost,
      costMultiplier: step.costMultiplier
    }))).toEqual([
      { provider: 'assemblyai', model: 'universal-3-5-pro', cost: 23, costMultiplier: 1 },
      { provider: 'assemblyai', model: 'universal-2', cost: 17, costMultiplier: 1 }
    ])
    expect(estimated.totalCost).toBe(40)
  })

  test('Gemini and Gladia estimates use current selected-model rates', () => {
    const audioDurationSeconds = 3600
    const estimated = computeEstimatedCosts({
      audioDurationSeconds,
      sttTargets: [
        { service: 'gemini-stt', model: 'gemini-3.6-flash' },
        { service: 'gladia', model: 'solaria-1' },
        { service: 'gladia', model: 'solaria-3' }
      ]
    })

    expect(estimated.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      cost: step.cost,
      costMultiplier: step.costMultiplier
    }))).toEqual([
      { provider: 'gemini-stt', model: 'gemini-3.6-flash', cost: 17.28, costMultiplier: 1 },
      { provider: 'gladia', model: 'solaria-1', cost: 61, costMultiplier: 1 },
      { provider: 'gladia', model: 'solaria-3', cost: 61, costMultiplier: 1 }
    ])
    expect(estimated.totalCost).toBe(139.28)
  })

  test('Soniox v5 estimates use the public async rate without a multiplier', () => {
    const audioDurationSeconds = 3600
    const estimated = computeEstimatedCosts({
      audioDurationSeconds,
      sttTargets: [{ service: 'soniox', model: 'stt-async-v5' }]
    })

    expect(estimated.steps[0]).toMatchObject({
      provider: 'soniox',
      model: 'stt-async-v5',
      cost: 10,
      costMultiplier: 1,
      durationSeconds: audioDurationSeconds
    })
    expect(estimated.totalCost).toBe(10)
  })

  test('Speechmatics estimates use current Enhanced and Melia 1 rates', () => {
    const audioDurationSeconds = 3600
    const estimated = computeEstimatedCosts({
      audioDurationSeconds,
      sttTargets: [
        { service: 'speechmatics', model: 'enhanced' },
        { service: 'speechmatics', model: 'melia-1' }
      ]
    })

    expect(estimated.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      cost: step.cost,
      costMultiplier: step.costMultiplier
    }))).toEqual([
      { provider: 'speechmatics', model: 'enhanced', cost: 40, costMultiplier: 1 },
      { provider: 'speechmatics', model: 'melia-1', cost: 12.9, costMultiplier: 1 }
    ])
    expect(estimated.totalCost).toBe(52.9)
  })

  test('Together batch models use the current per-audio-minute rate', () => {
    const audioDurationSeconds = 3600
    const estimated = computeEstimatedCosts({
      audioDurationSeconds,
      sttTargets: [
        { service: 'together', model: 'openai/whisper-large-v3' },
        { service: 'together', model: 'nvidia/parakeet-tdt-0.6b-v3' }
      ]
    })

    expect(estimated.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      cost: step.cost,
      costMultiplier: step.costMultiplier
    }))).toEqual([
      { provider: 'together', model: 'openai/whisper-large-v3', cost: 9, costMultiplier: 1 },
      { provider: 'together', model: 'nvidia/parakeet-tdt-0.6b-v3', cost: 9, costMultiplier: 1 }
    ])
    expect(estimated.totalCost).toBe(18)
  })

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
