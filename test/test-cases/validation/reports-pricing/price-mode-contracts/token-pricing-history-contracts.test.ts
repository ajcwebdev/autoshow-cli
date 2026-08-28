import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getExtractPricing,getLlmCost,getModelRegistry,getRetiredModelReplacement,resolveModelLifecycle } from '~/cli/commands/setup-and-utilities/models/model-loader'
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

  test('retired Gemini LLM benchmark results retain historical token pricing', () => {
      const metadata = buildStep3CostMetadata({
        llmService: 'gemini',
        llmModel: 'gemini-3.1-flash-lite-preview',
        inputTokenCount: 1_000_000,
        outputTokenCount: 1_000_000
      })

      expect(computeActualCosts({ step3: metadata }).steps[0]).toMatchObject({
        step: 'llm',
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite-preview',
        cost: 175,
        costSource: 'provider_usage'
      })
    })

  test('retired Gemini selector stays outside active registries while historical pricing and replacement guidance remain available', () => {
      const registry = getModelRegistry()
      expect(resolveModelLifecycle(registry.llm['gemini']?.models['gemini-3.5-flash-lite'])).toMatchObject({
        status: 'active',
        defaultEligible: true,
        allExpansionEligible: true
      })
      expect(getLlmCost('gemini', 'gemini-3.1-flash-lite')).toMatchObject({
        inputCostPer1MCents: 25,
        outputCostPer1MCents: 150
      })
      expect(getExtractPricing('gemini', 'gemini-3.1-flash-lite')).toMatchObject({
        inputCostPer1MCents: 25,
        outputCostPer1MCents: 150
      })
      expect(getRetiredModelReplacement('llm', 'gemini', 'gemini-3.1-flash-lite')).toBe('gemini-3.5-flash-lite')
      expect(getRetiredModelReplacement('extract', 'gemini', 'gemini-3.1-flash-lite')).toBe('gemini-3.5-flash-lite')
      expect(resolveCheapestModelForFlag('gemini')).toBe('gemini-3.5-flash-lite')
      expect(resolveCheapestModelForFlag('anthropic')).toBe('claude-haiku-4-5')
      expect(resolveCheapestModelForFlag('kimi')).toBe('kimi-k2.6')
      expect(resolveCheapestModelForFlag('gemini-ocr')).toBe('gemini-3.5-flash-lite')
      expect(resolveCheapestModelForFlag('anthropic-ocr')).toBe('claude-haiku-4-5')
      expect(resolveCheapestModelForFlag('kimi-ocr')).toBe('kimi-k2.6')
    })
})
