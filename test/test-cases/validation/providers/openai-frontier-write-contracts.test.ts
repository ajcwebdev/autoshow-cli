import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import * as v from 'valibot'
import type { NormalizedReasoningEffort, ResolvedStructuredSchema } from '~/types'
import { getLlmCost, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { validateOpenAIOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import { collectLlmTargets, runLlmTargetsForStructuredPrompt } from '~/cli/commands/text/write/run-llm'
import { runOpenAIModel } from '~/cli/commands/text/write/write-services/write-openai/run-openai'
import { AppError } from '~/utils/error-handler'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, structuredOpts, withTempDir } from './openai-rest-contracts/shared'

installOpenAIRestContractHooks()

// Independent API expectations checked against official model documentation on 2026-11-10:
// https://developers.openai.com/api/docs/models/gpt-6-astra
// https://developers.openai.com/api/docs/models/gpt-6.1-terra
// https://developers.openai.com/api/docs/pricing
// The five named effort levels are common to both; only Terra supports native `none`.
const additions = [
  { model: 'gpt-6-astra', inputCents: 1000, cachedCents: 100, outputCents: 5000, allowsDisabled: false },
  { model: 'gpt-6.1-terra', inputCents: 100, cachedCents: 5, outputCents: 500, allowsDisabled: true }
] as const
const schema: ResolvedStructuredSchema = {
  schemaName: 'content', leafPromptNames: ['content'], presetNames: [],
  schema: v.object({ content: v.string() }),
  jsonSchema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'], additionalProperties: false }
}
const schemaHash = createHash('sha256').update(JSON.stringify(structuredOpts.schema)).digest('hex')
const usage = { input_tokens: 100, input_tokens_details: { cached_tokens: 30 }, output_tokens: 20, output_tokens_details: { reasoning_tokens: 12 }, total_tokens: 120 }

for (const { model, inputCents, cachedCents, outputCents, allowsDisabled } of additions) {
  describe(`${model} write-only Responses integration`, () => {
    const acceptedEfforts: readonly (NormalizedReasoningEffort | undefined)[] = [undefined, 'default', 'low', 'medium', 'high', 'xhigh', 'max', ...(allowsDisabled ? ['disabled'] as const : [])]
    for (const effort of acceptedEfforts) {
      test(`mocked dispatch uses native schema and ${effort ?? 'omitted'} reasoning`, async () => {
        process.env['OPENAI_API_KEY'] = 'frontier-local-key'
        const returnedModel = `${model}-2026-11-10`
        const calls = installFetch(() => jsonResponse({ status: 'completed', model: returnedModel, output_text: '{"summary":"Repaired bicycles."}', usage }))
        const requestedReasoningEffort = effort
        const result = await runOpenAIModel('Summarize the workshop.', model, { ...structuredOpts, requestedReasoningEffort })
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ url: 'https://api.openai.com/v1/responses', method: 'POST' })
        expect(calls[0]?.headers.get('authorization')).toBe('Bearer frontier-local-key')
        expect(calls[0]?.headers.get('content-type')).toBe('application/json')
        expect(calls[0]?.bodyJson).toEqual({
          model, input: 'Summarize the workshop.', stream: false,
          text: { format: { type: 'json_schema', name: 'summary', strict: true, schema: structuredOpts.schema } },
          ...(effort && effort !== 'default' ? { reasoning: { effort: effort === 'disabled' ? 'none' : effort } } : {})
        })
        for (const control of ['temperature', 'top_p', 'top_k', 'reasoning_effort']) expect(calls[0]?.bodyJson).not.toHaveProperty(control)
        expect(result.result).toBe('{"summary":"Repaired bicycles."}')
        expect(result.metadata).toMatchObject({
          llmService: 'openai', llmModel: model, providerReturnedModel: returnedModel,
          inputTokenCount: 100, outputTokenCount: 20, tokenCountSource: 'provider_usage', rawProviderUsage: usage,
          effectiveReasoningEffort: effort ?? 'default',
          requestSettings: { model, stream: false, text: { format: { type: 'json_schema', name: 'summary', strict: true, schemaSha256: schemaHash } } }
        })
        expect(result.metadata.requestedReasoningEffort).toBe(effort)
        expect(result.metadata.requestSettings).not.toHaveProperty('input')
      })
    }

    test('omitted effort and explicit reset delegate to the provider after an override', async () => {
      process.env['OPENAI_API_KEY'] = 'frontier-local-key'
      const calls = installFetch(() => jsonResponse({ status: 'completed', model, output_text: 'Visible text' }))
      await runOpenAIModel('Write.', model)
      await runOpenAIModel('Write.', model, { ...structuredOpts, requestedReasoningEffort: 'max' })
      await runOpenAIModel('Write.', model, { ...structuredOpts, requestedReasoningEffort: 'default' })
      expect(calls.map(call => call.bodyJson?.['reasoning'])).toEqual([undefined, { effort: 'max' }, undefined])
    })

    test('unsupported efforts reject before credential lookup or network access', async () => {
      delete process.env['OPENAI_API_KEY']
      const calls = installFetch(() => { throw new Error('Unexpected HTTP dispatch') })
      for (const requestedReasoningEffort of (allowsDisabled ? ['minimal'] : ['minimal', 'disabled']) as NormalizedReasoningEffort[]) {
        await expect(runOpenAIModel('Write.', model, { ...structuredOpts, requestedReasoningEffort })).rejects.toThrow('does not support')
      }
      expect(calls).toHaveLength(0)
    })

    test('limits remain provider metadata and additions remain absent from extraction and STT catalogs', () => {
      const registry = getModelRegistry()
      expect(registry.llm['openai']?.models[model]?.limits).toMatchObject({ contextTokens: 1_050_000, maxOutputTokens: 128_000 })
      expect(registry.llm['openai']?.models[model]?.limits?.notes).toMatch(/922[,_]?000/)
      expect(() => validateOpenAIOcrModel(model)).toThrow('Invalid model')
      for (const config of Object.values(registry.extract)) expect(config.models[model]).toBeUndefined()
      for (const config of Object.values(registry.stt)) expect(config.models[model]).toBeUndefined()
    })

    test('full-request pricing switches exactly between 272000 and 272001 input tokens', () => {
      const pricing = getLlmCost('openai', model)
      expect(pricing).toBeDefined()
      expect(pricing).toMatchObject({ inputCostPer1MCents: inputCents, outputCostPer1MCents: outputCents })
      expect(computeTokenCost(pricing!, 272_000, 1000)).toMatchObject({ inputCostPer1MCents: inputCents, outputCostPer1MCents: outputCents })
      const long = computeTokenCost(pricing!, 272_001, 1000)
      expect(long).toMatchObject({ inputCostPer1MCents: inputCents * 2, outputCostPer1MCents: outputCents * 1.5 })
      expect(long.totalCost).toBeCloseTo((272_001 * inputCents * 2 + 1000 * outputCents * 1.5) / 1_000_000, 8)
      const entry = getModelRegistry().llm['openai']?.models[model]
      expect(entry?.cachedInputCostPer1MCents).toBe(cachedCents)
      expect(entry?.tokenPricingBands).toEqual([
        { label: 'standard-short-context', maxInputTokens: 272_000, inputCostPer1MCents: inputCents, cachedInputCostPer1MCents: cachedCents, outputCostPer1MCents: outputCents },
        { label: 'standard-long-context', minInputTokens: 272_001, inputCostPer1MCents: inputCents * 2, cachedInputCostPer1MCents: cachedCents * 2, outputCostPer1MCents: outputCents * 1.5 }
      ])
    })

    for (const artifact of ['valid', 'malformed-json', 'schema-invalid'] as const) {
      test(`structured execution persists ${artifact} output and its raw evidence`, async () => {
        process.env['OPENAI_API_KEY'] = 'frontier-local-key'
        const raw = artifact === 'valid' ? '{"content":"A repaired bicycle."}' : artifact === 'malformed-json' ? '{"content":' : '{"wrongField":"Wrong schema"}'
        const calls = installFetch(() => jsonResponse({ status: 'completed', model, output_text: raw, usage }))
        await withTempDir(async outputDir => {
          const { result } = await captureLogEvents(() => runLlmTargetsForStructuredPrompt({
            prompt: 'Summarize.', outputDir, targets: collectLlmTargets({ outputDir, openaiModels: [model] }), structuredSchema: schema,
            structuredValidationContext: { leafPromptNames: ['content'], presetNames: [] }, reasoningEffort: 'high'
          }))
          expect(result[0]?.metadata).toMatchObject({ llmService: 'openai', llmModel: model, validationFailed: artifact !== 'valid', requestedReasoningEffort: 'high', effectiveReasoningEffort: 'high', inputTokenCount: 100, outputTokenCount: 20 })
          expect(await Bun.file(join(outputDir, 'text.json')).json()).toEqual(artifact === 'valid' ? { content: 'A repaired bicycle.' } : { _raw: raw, _validationError: expect.any(String) })
          expect(await Bun.file(join(outputDir, `raw-response-${model}-attempt-1.json`)).json()).toMatchObject({ result: raw, metadata: { llmModel: model, rawProviderUsage: usage } })
          expect(calls).toHaveLength(1)
        })
      })
    }

    for (const artifact of ['refusal', 'truncated', 'failed', 'empty', 'whitespace', 'thinking-only'] as const) {
      test(`HTTP success with ${artifact} preserves failure evidence without redispatch`, async () => {
        process.env['OPENAI_API_KEY'] = 'frontier-local-key'
        const payload = {
          status: artifact === 'truncated' ? 'incomplete' : artifact === 'failed' ? 'failed' : 'completed', model: `${model}-snapshot`, usage,
          ...(artifact === 'refusal' ? { output_text: 'Ignored partial answer', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Declined' }] }] }
            : artifact === 'truncated' ? { output_text: '{"summary":"partial', incomplete_details: { reason: 'max_output_tokens' } }
              : artifact === 'failed' ? { error: { message: 'Provider failure' } }
                : artifact === 'thinking-only' ? { output: [{ type: 'reasoning', summary: [{ type: 'summary_text', text: 'Hidden reasoning' }] }] }
                  : { output_text: artifact === 'whitespace' ? ' \n ' : '' })
        }
        const calls = installFetch(() => jsonResponse(payload))
        let failure: unknown
        try { await runOpenAIModel('Write.', model, { ...structuredOpts, requestedReasoningEffort: 'high' }) } catch (error) { failure = error }
        expect(failure).toBeInstanceOf(AppError)
        const error = failure as AppError
        expect(error.retryable).toBe(false)
        expect(error.metadata).toMatchObject({ rawResponse: payload, rawProviderUsage: usage, returnedModel: `${model}-snapshot`, requestSettings: { model, reasoning: { effort: 'high' }, text: { format: { schemaSha256: schemaHash } } } })
        expect(calls).toHaveLength(1)
      })
    }

    for (const payload of [null, [], 'Malformed envelope', 42, true]) {
      test(`malformed HTTP-success envelope ${JSON.stringify(payload)} retains raw evidence without redispatch`, async () => {
        process.env['OPENAI_API_KEY'] = 'frontier-local-key'
        const calls = installFetch(() => jsonResponse(payload))
        let failure: unknown
        try { await runOpenAIModel('Write.', model, { ...structuredOpts, requestedReasoningEffort: 'high' }) } catch (error) { failure = error }
        expect(failure).toBeInstanceOf(AppError)
        const error = failure as AppError
        expect(error).toMatchObject({ kind: 'validation', retryable: false, stage: 'write:openai' })
        expect(error.metadata).toMatchObject({ rawResponse: payload, requestedModel: model, requestSettings: { model, reasoning: { effort: 'high' }, text: { format: { schemaSha256: schemaHash } } } })
        expect(calls).toHaveLength(1)
      })
    }

    for (const output of [null, {}, 'Malformed output', [null], [{ type: 'message', content: {} }], [{ type: 'message', content: [null] }], [{ type: 'message', content: [{ type: 'output_text', text: 42 }] }]]) {
      test(`malformed HTTP-success output ${JSON.stringify(output)} retains usage and identities`, async () => {
        process.env['OPENAI_API_KEY'] = 'frontier-local-key'
        const payload = { status: 'completed', model: `${model}-snapshot`, usage, output }
        const calls = installFetch(() => jsonResponse(payload))
        let failure: unknown
        try { await runOpenAIModel('Write.', model, { ...structuredOpts, requestedReasoningEffort: 'high' }) } catch (error) { failure = error }
        expect(failure).toBeInstanceOf(AppError)
        const error = failure as AppError
        expect(error).toMatchObject({ kind: 'validation', retryable: false, stage: 'write:openai' })
        expect(error.metadata).toMatchObject({ rawResponse: payload, rawProviderUsage: usage, requestedModel: model, returnedModel: `${model}-snapshot`, requestSettings: { model, reasoning: { effort: 'high' }, text: { format: { schemaSha256: schemaHash } } } })
        expect(calls).toHaveLength(1)
      })
    }
  })
}
