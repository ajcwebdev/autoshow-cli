import { describe, expect, test } from 'bun:test'
import { runTogetherModel } from '~/cli/commands/process-steps/step-3-write/write-services/write-together/run-together'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { validateTogetherModel } from '~/cli/commands/setup-and-utilities/models/llm-models'
import { getLlmCost, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'
import { structuredOpts } from './openai-rest-contracts/shared'

setupContractSuiteLifecycle({ envKeys: ['TOGETHER_API_KEY'], tempPrefix: 'autoshow-together-p1-', beforeEachExtra: () => { process.env['TOGETHER_API_KEY'] = 'synthetic-key' } })
const targets = [
  ['kimi-k3', 'moonshotai/Kimi-K3', 131072, 300, 30, 1500],
  ['glm-5.3', 'zai-org/GLM-5.3', 32768, 140, 26, 440],
  ['glm-5.3-flash', 'zai-org/GLM-5.3-Flash', 32768, 15, 3, 50]
] as const
const usage = { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140, prompt_tokens_details: { cached_tokens: 80 }, completion_tokens_details: { reasoning_tokens: 30 } }
const response = (withUsage = true) => Response.json({ model: 'host-returned-model', choices: [{ message: { content: '{"summary":"Synthetic summary"}', reasoning_content: 'Synthetic reasoning', reasoning: 'Synthetic reasoning alias' } }], ...(withUsage ? { usage } : {}) })

describe('Together P1 hosted writing contracts', () => {
  test('selectors expand without conflicts and preserve the bare default', () => {
    for (const [model, host] of targets) {
      expect(validateTogetherModel(model)).toBe(model)
      expect(buildOptsFromFlags({ together: model }).togetherModels).toEqual([model])
      expect(() => validateTogetherModel(host)).toThrow('Invalid model')
    }
    expect(buildOptsFromFlags({ together: true }).togetherModels).toEqual(['glm-5.1'])
    expect(buildOptsFromFlags({ 'all-llm': true }).togetherModels).toEqual(['kimi-k2.6', 'glm-5.1', 'kimi-k3', 'glm-5.3', 'glm-5.3-flash'])
    expect(() => validateTogetherModel('glm-5.2')).toThrow()
  })

  for (const [model, host, cap, input, cached, output] of targets) {
    for (const effort of [undefined, 'default', 'low', 'high', 'max'] as const) {
      test(`${model} maps ${effort ?? 'omitted'} reasoning and preserves structured usage`, async () => {
        const calls = installMockFetch(() => response())
        const result = await runTogetherModel('Return a JSON summary.', model, { ...structuredOpts, requestedReasoningEffort: effort })
        expect(calls).toHaveLength(1)
        expect(calls[0]?.url).toBe('https://api.together.xyz/v1/chat/completions')
        expect(calls[0]?.headers.get('authorization')).toBe('Bearer synthetic-key')
        expect(calls[0]?.bodyJson).toEqual({ model: host, messages: [{ role: 'user', content: 'Return a JSON summary.' }], stream: false, max_tokens: cap,
          response_format: { type: 'json_schema', json_schema: { name: structuredOpts.schemaName, schema: structuredOpts.schema, strict: structuredOpts.strict } },
          ...(effort !== undefined && effort !== 'default' ? { reasoning_effort: effort } : {}) })
        expect(result.result).toBe('{"summary":"Synthetic summary"}')
        expect(result.metadata).toMatchObject({ llmService: 'together', llmModel: model, providerReturnedModel: 'host-returned-model', tokenCountSource: 'provider_usage', inputTokenCount: 100, outputTokenCount: 40, effectiveReasoningEffort: effort ?? 'default', providerUsage: { inputTokenCount: 100, outputTokenCount: 40, totalTokenCount: 140, cachedInputTokenCount: 80 }, rawProviderUsage: usage })
      })
    }
    test(`${model} rejects unsupported effort before HTTP`, async () => {
      const calls = installMockFetch(() => { throw new Error('Unexpected network request') })
      for (const effort of ['minimal', 'medium', 'xhigh', ...(model === 'kimi-k3' ? [] : ['disabled'] as const)] as const) {
        await expect(runTogetherModel('Synthetic prompt', model, { ...structuredOpts, requestedReasoningEffort: effort })).rejects.toThrow('does not support')
      }
      expect(calls).toHaveLength(0)
    })
    test(`${model} retains text fallback and missing-usage local counts`, async () => {
      let requestCount = 0
      const calls = installMockFetch(() => requestCount++ === 0
        ? Response.json({ error: { message: 'response_format json_schema is not supported' } }, { status: 400 })
        : response(false))
      const result = await runTogetherModel('Synthetic JSON prompt', model, structuredOpts)
      expect(calls).toHaveLength(2)
      expect(calls[0]?.bodyJson).toHaveProperty('response_format')
      expect(calls[1]?.bodyJson).not.toHaveProperty('response_format')
      expect(calls[1]?.bodyJson).toMatchObject({ model: host, max_tokens: cap })
      expect(result.metadata.tokenCountSource).toBe('local_count')
      expect(result.metadata.providerUsage).toBeUndefined()
    })
    test(`${model} uses independent Together uncached pricing`, () => {
      const catalog = requireDefined(getModelRegistry().llm['together']?.models[model], 'Together model')
      expect(catalog).toMatchObject({ inputCostPer1MCents: input, cachedInputCostPer1MCents: cached, outputCostPer1MCents: output, pricingCheckedAt: '2026-09-08', pricingSourceUrl: 'https://docs.together.ai/docs/serverless/models' })
      const rates = requireDefined(getLlmCost('together', model), 'Together rates')
      for (const count of [272000, 272001, 1_000_000]) {
        expect(computeTokenCost(rates, count, 1_000_000).totalCost).toBeCloseTo(input * count / 1_000_000 + output)
      }
    })
  }

  test('Together normalizes the legacy cache counter without changing raw usage', async () => {
    for (const cached of [80, 0, -1, 101, null, '80']) {
      const raw = { prompt_tokens: 100, completion_tokens: 40, cached_tokens: cached }
      installMockFetch(() => Response.json({ choices: [{ message: { content: 'Synthetic summary' } }], usage: raw }))
      const result = await runTogetherModel('Synthetic prompt', 'kimi-k3')
      expect(result.metadata.providerUsage?.cachedInputTokenCount).toBe(cached === 80 || cached === 0 ? cached : undefined)
      expect(result.metadata.rawProviderUsage).toEqual(raw)
      expect(result.metadata.inputTokenCount).toBe(100)
      expect(result.metadata.outputTokenCount).toBe(40)
    }
    installMockFetch(() => Response.json({ choices: [{ message: { content: 'Synthetic summary' } }], usage: { ...usage, cached_tokens: 50 } }))
    expect((await runTogetherModel('Synthetic prompt', 'kimi-k3')).metadata.providerUsage?.cachedInputTokenCount).toBe(80)
  })

  test('K3 supports hosted disable while direct K3 still rejects it', async () => {
    const calls = installMockFetch(() => response())
    await runTogetherModel('Synthetic prompt', 'kimi-k3', { ...structuredOpts, requestedReasoningEffort: 'disabled' })
    expect(calls[0]?.bodyJson?.['reasoning']).toEqual({ enabled: false })
    expect(calls[0]?.bodyJson).not.toHaveProperty('reasoning_effort')
    expect(() => resolveReasoningPolicy({ step: 'llm', service: 'kimi', model: 'kimi-k3', requestedReasoningEffort: 'disabled' })).toThrow()
  })

  test('existing host mappings, cap and disabled toggle remain intact', async () => {
    for (const [model, host] of [['kimi-k2.6', 'moonshotai/Kimi-K2.6'], ['glm-5.1', 'zai-org/GLM-5.1']] as const) {
      const calls = installMockFetch(() => response())
      await runTogetherModel('Synthetic prompt', model)
      expect(calls[0]?.bodyJson).toEqual({ model: host, messages: [{ role: 'user', content: 'Synthetic prompt' }], stream: false, max_tokens: 32768 })
      await runTogetherModel('Synthetic prompt', model, { ...structuredOpts, requestedReasoningEffort: 'disabled' })
      expect(calls[1]?.bodyJson?.['reasoning']).toEqual({ enabled: false })
    }
  })
})
