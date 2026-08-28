import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import type { Step3Metadata } from '~/types'

const buildStep3CostMetadata = (overrides: Partial<Step3Metadata> = {}): Step3Metadata => ({
  llmService: 'openai',
  llmModel: 'gpt-5.5',
  processingTime: 1234,
  inputTokenCount: 300_000,
  outputTokenCount: 10_000,
  tokenCountSource: 'provider_usage',
  outputFileName: 'output.json',
  outputFormat: 'json',
  structuredMode: 'native',
  structuredPresetNames: [],
  ...overrides
})

describe('price mode contracts', () => {

  test('LLM preflight and actual costs use the same context-tier helper', () => {
      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        llmTargets: [{
          service: 'openai',
          model: 'gpt-5.5',
          inputTokens: 300_000,
          outputTokens: 10_000
        }]
      })
      const actual = computeActualCosts({
        step3: buildStep3CostMetadata()
      })

      expect(estimated.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.5',
        cost: 345,
        pricingBand: 'standard-long-context'
      })
      expect(actual.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.5',
        cost: 345,
        costSource: 'provider_usage',
        pricingBand: 'standard-long-context'
      })
      expect(actual.totalCost).toBe(estimated.totalCost)
    })
})
