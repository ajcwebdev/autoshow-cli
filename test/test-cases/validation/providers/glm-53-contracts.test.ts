import { describe, expect, test } from 'bun:test'
import { runGlmModel } from '~/cli/commands/process-steps/step-3-write/write-services/write-glm/run-glm'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { validateGlmModel } from '~/cli/commands/setup-and-utilities/models/llm-models'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getLlmCost, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'
import { structuredOpts } from './openai-rest-contracts/shared'

setupContractSuiteLifecycle({ envKeys: ['GLM_API_KEY'], tempPrefix: 'autoshow-glm-53-', beforeEachExtra: () => { process.env['GLM_API_KEY'] = 'synthetic-key' } })
const response = (usage?: unknown) => Response.json({
  model: 'returned-glm-model',
  choices: [{ message: { content: '{"summary":"Synthetic summary"}', reasoning_content: 'Private synthetic reasoning' } }],
  ...(usage !== undefined ? { usage } : {})
})

describe('Direct GLM 5.3 writing contracts', () => {
  test('selectors preserve the bare default and expand both new siblings', () => {
    for (const model of ['glm-5.1', 'glm-5.3', 'glm-5.3-flash'] as const) {
      expect(validateGlmModel(model)).toBe(model)
      expect(buildOptsFromFlags({ glm: model }).glmModels).toEqual([model])
    }
    expect(resolveCheapestModelForFlag('glm')).toBe('glm-5.1')
    expect(buildOptsFromFlags({ glm: true }).glmModels).toEqual(['glm-5.1'])
    expect(buildOptsFromFlags({ 'all-llm': true }).glmModels).toEqual(['glm-5.1', 'glm-5.3', 'glm-5.3-flash'])
    expect(() => validateGlmModel('glm-5.2')).toThrow()
  })

  for (const model of ['glm-5.3', 'glm-5.3-flash']) {
    for (const effort of [undefined, 'default', 'low', 'high', 'max'] as const) {
      test(`${model} sends supported ${effort ?? 'omitted'} effort with JSON output`, async () => {
        const usage = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, prompt_tokens_details: { cached_tokens: 80 } }
        const calls = installMockFetch(() => response(usage))
        const result = await runGlmModel('Return a JSON summary.', model, { ...structuredOpts, requestedReasoningEffort: effort })
        expect(calls).toHaveLength(1)
        expect(calls[0]?.url).toBe('https://api.z.ai/api/paas/v4/chat/completions')
        expect(calls[0]?.bodyJson).toEqual({
          model, messages: [{ role: 'user', content: 'Return a JSON summary.' }], stream: false, max_tokens: 16000,
          thinking: { type: 'enabled' }, response_format: { type: 'json_object' },
          ...(effort !== undefined && effort !== 'default' ? { reasoning_effort: effort } : {})
        })
        expect(result.result).toBe('{"summary":"Synthetic summary"}')
        expect(result.metadata).toMatchObject({ llmService: 'glm', llmModel: model, providerReturnedModel: 'returned-glm-model', tokenCountSource: 'provider_usage', inputTokenCount: 100, outputTokenCount: 20, effectiveReasoningEffort: effort ?? 'default', providerUsage: { inputTokenCount: 100, outputTokenCount: 20, totalTokenCount: 120, cachedInputTokenCount: 80 }, rawProviderUsage: usage })
      })
    }

    test(`${model} rejects unsupported reasoning before HTTP`, async () => {
      const calls = installMockFetch(() => { throw new Error('Unexpected network request') })
      for (const requestedReasoningEffort of ['disabled', 'minimal', 'medium', 'xhigh'] as const) {
        await expect(runGlmModel('Synthetic prompt', model, { ...structuredOpts, requestedReasoningEffort })).rejects.toThrow('does not support')
      }
      expect(calls).toHaveLength(0)
    })

    test(`${model} accepts absent usage and optional or invalid cache counts`, async () => {
      for (const cached of [undefined, null, -1, 101, 0]) {
        installMockFetch(() => response({ prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: cached } }))
        const result = await runGlmModel('Synthetic prompt', model)
        expect(result.metadata.providerUsage?.cachedInputTokenCount).toBe(cached === 0 ? 0 : undefined)
      }
      const calls = installMockFetch(() => response())
      const result = await runGlmModel('Synthetic prompt', model)
      expect(result.metadata.tokenCountSource).toBe('local_count')
      expect(result.metadata.providerUsage).toBeUndefined()
      expect(calls[0]?.bodyJson).not.toHaveProperty('response_format')
    })
  }

  test('GLM 5.1 retains disabled reasoning by default', async () => {
    const calls = installMockFetch(() => response())
    await runGlmModel('Synthetic prompt', 'glm-5.1')
    expect(calls[0]?.bodyJson?.['thinking']).toEqual({ type: 'disabled' })
    expect(calls[0]?.bodyJson).not.toHaveProperty('reasoning_effort')
  })

  test('independent standard uncached tariffs cannot retain the temporary Flash discount', () => {
    for (const [model, input, cached, output] of [['glm-5.3', 140, 26, 440], ['glm-5.3-flash', 15, 3, 50]] as const) {
      const catalog = requireDefined(getModelRegistry().llm['glm']?.models[model], 'GLM catalog model')
      expect(catalog.cachedInputCostPer1MCents).toBe(cached)
      const rates = requireDefined(getLlmCost('glm', model), 'GLM rates')
      expect(computeTokenCost(rates, 1_000_000, 1_000_000).totalCost).toBe(input + output)
      expect(catalog.pricingCheckedAt).toBe('2026-09-08')
    }
    const flash = getModelRegistry().llm['glm']?.models['glm-5.3-flash']
    expect(flash?.pricingNotes).toContain('$0.075 input, $0.015 cached input and $0.25 output')
    expect(flash?.pricingNotes).toContain('2026-09-09T16:00:00Z')
    expect(flash?.pricingNotes).toContain('Conservative standard rates apply before and after expiry')
    expect(getLlmCost('glm', 'glm-5.1')).toMatchObject({ inputCostPer1MCents: 140, outputCostPer1MCents: 440 })
  })
})
