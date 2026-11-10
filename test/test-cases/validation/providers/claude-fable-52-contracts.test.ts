import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import * as v from 'valibot'
import type { ResolvedStructuredSchema, StructuredRequestOptions } from '~/types'
import { runAnthropicModel } from '~/cli/commands/text/write/write-services/write-anthropic/run-anthropic'
import { runLlmTargetsForStructuredPrompt } from '~/cli/commands/text/write/run-llm'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { getLlmCost } from '~/cli/commands/setup-and-utilities/models/model-loader/llm-accessors'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { extractErrorMetadata } from '~/utils/error-handler'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

// Independent first-party expectations checked 2026-11-10:
// https://platform.claude.com/docs/en/models/fable-5-2/overview
// https://platform.claude.com/docs/en/models/fable-5-2/migration-guide
// This suite establishes mocked integration and artifact integrity, not live availability or writing quality.
const lifecycle = setupContractSuiteLifecycle({ envKeys: ['ANTHROPIC_API_KEY'], tempPrefix: 'autoshow-fable-52-' })
const model = 'claude-fable-5-2'
const structuredSchema: ResolvedStructuredSchema = {
  schemaName: 'content', leafPromptNames: ['content'], presetNames: [],
  schema: v.object({ content: v.pipe(v.string(), v.minLength(1)) }),
  jsonSchema: { type: 'object', additionalProperties: false, required: ['content'], properties: { content: { type: 'string', minLength: 1 } } }
}
const nativeSchema = {
  type: 'object', additionalProperties: false, required: ['content'],
  properties: { content: { type: 'string', description: 'Constraints checked locally: minLength=1.' } }
}
const opts: StructuredRequestOptions = { schemaName: 'content', schema: structuredSchema.jsonSchema, strict: true, strategy: 'native' }
const usage = { input_tokens: 40, output_tokens: 20, cache_read_input_tokens: 5 }
const success = () => ({
  model: 'claude-fable-5-2-20261109', stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: 'provider reasoning' }, { type: 'text', text: '{"content":"valid"}' }], usage
})

describe('Claude Fable 5.2 native Messages contracts', () => {
  test('dispatches every documented effort and explicit reset with native schema and the application output budget', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'mock-fable-key'
    const calls = installMockFetch(() => Response.json(success()))
    for (const effort of [undefined, 'low', 'medium', 'high', 'xhigh', 'max', 'default'] as const) {
      const result = await runAnthropicModel('Summarize the supplied text.', model, { ...opts, requestedReasoningEffort: effort })
      const call = calls.at(-1)
      expect(call?.url).toBe('https://api.anthropic.com/v1/messages')
      expect(call?.method).toBe('POST')
      expect(call?.headers.get('x-api-key')).toBe('mock-fable-key')
      expect(call?.headers.get('anthropic-version')).toBe('2023-06-01')
      expect(call?.headers.get('content-type')).toBe('application/json')
      expect(call?.bodyJson).toEqual({
        model, max_tokens: 16000, messages: [{ role: 'user', content: 'Summarize the supplied text.' }],
        output_config: { ...(effort && effort !== 'default' ? { effort } : {}), format: { type: 'json_schema', schema: nativeSchema } }
      })
      for (const key of ['thinking', 'temperature', 'top_p', 'top_k', 'tools', 'tool_choice']) expect(call?.bodyJson).not.toHaveProperty(key)
      expect(result.result).toBe('{"content":"valid"}')
      expect(result.metadata).toMatchObject({
        llmService: 'anthropic', llmModel: model, providerReturnedModel: 'claude-fable-5-2-20261109',
        inputTokenCount: 40, outputTokenCount: 20, rawProviderUsage: usage,
        effectiveReasoningEffort: effort ?? 'default',
        requestSettings: {
          model, max_tokens: 16000,
          output_config: { format: { type: 'json_schema', schemaSha256: new Bun.CryptoHasher('sha256').update(JSON.stringify(nativeSchema)).digest('hex') } }
        }
      })
      expect(result.metadata.requestedReasoningEffort).toBe(effort)
      expect(result.metadata.requestSettings).not.toHaveProperty('messages')
    }
    expect(calls).toHaveLength(7)
    expect(structuredSchema.jsonSchema['properties']).toEqual({ content: { type: 'string', minLength: 1 } })
  })

  test('rejects disabled and minimal reasoning before credential lookup or dispatch', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected provider dispatch') })
    for (const requestedReasoningEffort of ['disabled', 'minimal'] as const) {
      await expect(runAnthropicModel('Summarize.', model, { ...opts, requestedReasoningEffort })).rejects.toThrow('does not support')
    }
    expect(calls).toHaveLength(0)
  })

  test('records provider capacity separately from the lower application output budget and has no long-context price band', () => {
    expect(getModelRegistry().llm['anthropic']?.models[model]).toMatchObject({
      inputCostPer1MCents: 800, cachedInputCostPer1MCents: 20, outputCostPer1MCents: 4000,
      limits: { contextTokens: 1000000, maxOutputTokens: 128000 },
      reasoning: { support: 'required', allowDisabled: false, supportedEfforts: ['low', 'medium', 'high', 'xhigh', 'max'] }
    })
    const price = getLlmCost('anthropic', model)
    expect(price).toMatchObject({ inputCostPer1MCents: 800, outputCostPer1MCents: 4000 })
    expect(price?.tokenPricingBands).toBeUndefined()
    for (const input of [100000, 272001, 900000]) {
      expect(computeTokenCost(price!, input, 1000)).toMatchObject({ inputCostPer1MCents: 800, outputCostPer1MCents: 4000 })
    }
    expect(getModelRegistry().extract['anthropic']?.models[model]).toBeUndefined()
  })

  for (const raw of ['{"content":"valid"}', '{"content":""}', '{"unexpected":"invalid"}', 'not json']) {
    test(`persists ${raw === '{"content":"valid"}' ? 'valid JSON' : 'invalid JSON/schema evidence'} for ${raw}`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json({ ...success(), content: [{ type: 'text', text: raw }] }))
      await lifecycle.withDir(async outputDir => {
        const results = await runLlmTargetsForStructuredPrompt({
          prompt: 'Summarize.', outputDir, targets: [{ service: 'anthropic', label: 'Anthropic', model, run: runAnthropicModel }],
          structuredSchema, structuredValidationContext: { leafPromptNames: ['content'], presetNames: [] }, reasoningEffort: 'xhigh'
        })
        const valid = raw === '{"content":"valid"}'
        expect(results[0]?.metadata.validationFailed).toBe(!valid)
        expect(results[0]?.metadata).toMatchObject({ llmModel: model, providerReturnedModel: 'claude-fable-5-2-20261109', requestedReasoningEffort: 'xhigh', effectiveReasoningEffort: 'xhigh' })
        expect(await Bun.file(join(outputDir, 'text.json')).json()).toMatchObject(valid ? { content: 'valid' } : { _raw: raw, _validationError: expect.any(String) })
        expect(await Bun.file(join(outputDir, `raw-response-${model}-attempt-1.json`)).json()).toMatchObject({
          result: raw, metadata: { llmModel: model, inputTokenCount: 40, outputTokenCount: 20, rawProviderUsage: usage }
        })
        expect(calls).toHaveLength(valid ? 1 : 2)
        if (!valid) expect(await Bun.file(join(outputDir, `raw-response-${model}-attempt-2.json`)).exists()).toBe(true)
      })
    })
  }

  for (const stopReason of ['refusal', 'max_tokens', 'pause_turn'] as const) {
    test(`rejects ${stopReason} with raw evidence and no automatic provider redispatch`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const payload = { ...success(), stop_reason: stopReason }
      const calls = installMockFetch(() => Response.json(payload))
      let caught: unknown
      try { await runAnthropicModel('Summarize.', model, opts) } catch (error) { caught = error }
      expect(caught).toBeDefined()
      expect(extractErrorMetadata(caught)).toMatchObject({ rawResponse: payload, rawProviderUsage: usage, requestedModel: model, returnedModel: payload.model })
      expect(calls).toHaveLength(1)
    })
  }

  for (const content of [[], [{ type: 'thinking', thinking: 'no visible output' }], [{ type: 'text', text: '' }], [{ type: 'text', text: '  ' }], [{ type: 'text', text: 42 }], [null]]) {
    test(`rejects empty or malformed content ${JSON.stringify(content)} while preserving the provider response`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const payload = { ...success(), content }
      const calls = installMockFetch(() => Response.json(payload))
      let caught: unknown
      try { await runAnthropicModel('Summarize.', model, opts) } catch (error) { caught = error }
      expect(caught).toBeDefined()
      expect(extractErrorMetadata(caught)).toMatchObject({ rawResponse: payload, rawProviderUsage: usage, requestedModel: model, returnedModel: payload.model })
      expect(calls).toHaveLength(1)
    })
  }

  for (const payload of [null, [], { ...success(), content: { type: 'text', text: 'malformed container' } }]) {
    test(`rejects malformed message shape ${JSON.stringify(payload)} with raw evidence`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json(payload))
      let caught: unknown
      try { await runAnthropicModel('Summarize.', model, opts) } catch (error) { caught = error }
      expect(caught).toBeDefined()
      expect(extractErrorMetadata(caught)).toMatchObject({ rawResponse: payload, requestedModel: model })
      expect(calls).toHaveLength(1)
    })
  }

  for (const message of [
    'Claude Fable 5.2 requires 30-day data retention; this workspace has zero data retention without express authorization.',
    'Native structured outputs are unavailable for organizations with customer-managed encryption keys (CMEK).'
  ]) {
    test(`preserves the provider account restriction without model or schema fallback: ${message}`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json({ type: 'error', error: { type: 'invalid_request_error', message } }, { status: 400 }))
      let caught: unknown
      try { await runAnthropicModel('Summarize.', model, opts) } catch (error) { caught = error }
      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toContain(message)
      expect(extractErrorMetadata(caught)).toMatchObject({ status: 400 })
      expect(caught).toHaveProperty('errorType', 'invalid_request_error')
      expect(calls).toHaveLength(1)
      expect(calls[0]?.bodyJson).toMatchObject({ model, output_config: { format: { type: 'json_schema', schema: nativeSchema } } })
    })
  }
})
