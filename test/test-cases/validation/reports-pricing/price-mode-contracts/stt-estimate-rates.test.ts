import { describe, expect, test } from 'bun:test'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeSttCost } from '~/cli/commands/pricing-orchestration/cost-helpers'



describe('price mode contracts', () => {

  test('Deepgram Nova-3 estimates include diarization at the current public rate', () => {
      const audioDurationSeconds = 3600
      const estimated = computeEstimatedCosts({
        audioDurationSeconds,
        sttTargets: [
          { service: 'deepgram', model: 'nova-3' }
        ]
      })

      expect(computeSttCost('deepgram', 'nova-3', audioDurationSeconds)).toBe(25.8)
      expect(estimated.steps[0]).toMatchObject({
        step: 'stt',
        provider: 'deepgram',
        model: 'nova-3',
        cost: 25.8,
        costMultiplier: 1,
        durationSeconds: audioDurationSeconds
      })
      expect(estimated.totalCost).toBe(25.8)
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

  test('Gemini and Gladia estimates use current Solaria-3 rates and retired Solaria-1 rates', () => {
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

  test('Speechmatics estimates use retired Enhanced rates and current Melia 1 rates', () => {
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
})
