import { describe, expect, test } from 'bun:test'
import { buildStep3Metadata, runWithLLMInstrumentation } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import { getLlmEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { CommandPricingOptions } from '~/types'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'

describe('price mode contracts', () => {
  test('text write estimated costs stay price-aligned while observed LLM counts stay uncalibrated', async () => {
      const opts = {
        textInput: true,
        prompts: ['shortSummary'],
        openaiModels: ['gpt-5.5'],
        useTesseract: false,
        urlBackend: 'defuddle',
        urlBackendExplicit: false
      } as CommandPricingOptions
      const priceEstimate = await buildAggregatedPriceEstimate('write', 'input/examples/tts/1-tts.md', opts)
      const estimated = preflightToEstimated(priceEstimate)
      const observedEstimate = computeEstimatedCosts({
        applyCostMultipliers: false,
        llmTargets: [{
          service: 'openai',
          model: 'gpt-5.5',
          inputTokens: 100_000,
          outputTokens: 100_000
        }],
        skipLLM: false
      })
      const multiplier = getLlmEstimation('openai', 'gpt-5.5').costMultiplier

      expect(multiplier).not.toBe(1)
      expect(estimated.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.5',
        costMultiplier: multiplier
      })
      expect(observedEstimate.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.5',
        estimatedInputTokens: 100_000,
        estimatedOutputTokens: 100_000,
        costMultiplier: 1
      })
      expect(observedEstimate.totalCost).not.toBe(estimated.totalCost)
    })

  test('post-run exact LLM estimates can bypass calibration multipliers', () => {
      const cost = computeEstimatedCosts({
        applyCostMultipliers: false,
        llmTargets: [{
          service: 'openai',
          model: 'gpt-5.5',
          inputTokens: 100_000,
          outputTokens: 100_000
        }]
      })

      expect(cost.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.5',
        costMultiplier: 1,
        cost: 350,
        pricingBand: 'standard-short-context'
      })
      expect(cost.totalCost).toBe(350)
    })

  test('LLM provider usage wins over local token counting and records source', async () => {
      const instrumentation = await runWithLLMInstrumentation(
        'short prompt',
        async () => ({
          text: 'short response',
          usage: {
            prompt_tokens: 123,
            completion_tokens: 45,
            total_tokens: 168
          },
          returnedModel: 'gpt-returned'
        })
      )
      const metadata = buildStep3Metadata('openai', 'gpt-5.4-nano', instrumentation)
      const actual = computeActualCosts({ step3: metadata })

      expect(metadata).toMatchObject({
        inputTokenCount: 123,
        outputTokenCount: 45,
        tokenCountSource: 'provider_usage',
        providerReturnedModel: 'gpt-returned',
        providerUsage: {
          inputTokenCount: 123,
          outputTokenCount: 45,
          totalTokenCount: 168
        }
      })
      expect(actual.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.4-nano',
        inputValue: 168,
        promptTokens: 123,
        completionTokens: 45,
        costSource: 'provider_usage'
      })
    })

  test('LLM missing provider usage falls back to local token counts and records source', async () => {
      const instrumentation = await runWithLLMInstrumentation(
        'short prompt',
        async () => 'short response'
      )
      const metadata = buildStep3Metadata('openai', 'gpt-5.4-nano', instrumentation)
      const actual = computeActualCosts({ step3: metadata })

      expect(metadata.tokenCountSource).toBe('local_count')
      expect(metadata.inputTokenCount).toBeGreaterThan(0)
      expect(metadata.outputTokenCount).toBeGreaterThan(0)
      expect(actual.steps[0]?.costSource).toBe('computed_usage')
    })
})
