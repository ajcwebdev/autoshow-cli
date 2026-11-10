import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import * as v from 'valibot'
import type { NormalizedReasoningEffort, ResolvedStructuredSchema, StructuredRequestOptions } from '~/types'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { runGeminiModel } from '~/cli/commands/text/write/write-services/write-gemini/run-gemini'
import { isGemini4Model } from '~/cli/commands/text/write/write-services/write-gemini/gemini-utils'
import { collectLlmTargets, runLlmTargetsForStructuredPrompt } from '~/cli/commands/text/write/run-llm'
import { validateGeminiModel } from '~/cli/commands/setup-and-utilities/models/llm-models'
import { validateGeminiOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import { getLlmCost, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { extractErrorMetadata } from '~/utils/error-handler'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { expectProviderHttpError, installMockFetch, jsonResponse } from '../../../test-utils/rest-contract-helpers'
import { setupGeminiRestContractFixture } from './gemini-rest-contract-fixture'
import { requireDefined } from '../../../test-utils/value-assertions'

const { withTempDir } = setupGeminiRestContractFixture()
const model = 'gemini-4-carbon'
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-carbon:generateContent'
// Independent expectations checked against official operation-specific docs on 2026-11-10:
// https://aistudio.google.com/docs/long-decode?generate-content=true#default-output-limits
// https://aistudio.google.com/docs/structured-output?generate-content=true
// https://aistudio.google.com/docs/thinking?generate-content=true
// https://aistudio.google.com/docs/pricing#gemini-4-carbon
const schema: ResolvedStructuredSchema = {
  schemaName: 'content', leafPromptNames: ['content'], presetNames: [],
  schema: v.object({ content: v.string() }),
  jsonSchema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'], additionalProperties: false }
}
const options = (effort?: NormalizedReasoningEffort): StructuredRequestOptions => ({
  schemaName: schema.schemaName, schema: schema.jsonSchema, strict: false, strategy: 'native',
  ...(effort !== undefined ? { requestedReasoningEffort: effort } : {})
})
const usage = { promptTokenCount: 20, candidatesTokenCount: 8, thoughtsTokenCount: 12, totalTokenCount: 40 }
const response = (text = '{"content":"A repaired bicycle."}', finishReason = 'STOP') => ({
  modelVersion: 'gemini-4-carbon-2026-11-10', usageMetadata: usage,
  candidates: [{ finishReason, content: { parts: [{ text: 'Private reasoning', thought: true }, { text }] } }]
})

describe('Gemini 4 Carbon direct non-streaming REST write contracts', () => {
  test('selects Carbon only for write and detects exact Gemini 4 capabilities with the optional models prefix', () => {
    expect(validateGeminiModel(model)).toBe(model)
    expect(() => validateGeminiOcrModel(model)).toThrow('Invalid model')
    const registry = getModelRegistry()
    expect(registry.llm['gemini']?.models[model]?.limits).toMatchObject({ contextTokens: 1_048_576, maxOutputTokens: 32_768 })
    expect(registry.extract['gemini']?.models[model]).toBeUndefined()
    expect(registry.stt['gemini-stt']?.models[model]).toBeUndefined()
    for (const identity of ['gemini-4-carbon', 'models/gemini-4-carbon', 'gemini-4-argon', 'models/gemini-4-argon']) {
      expect(isGemini4Model(identity)).toBe(true)
    }
    for (const identity of ['gemini-4-carbon-preview', 'gemini-4-argon-preview', 'gemini-4-neon', 'models/models/gemini-4-carbon', 'gemini-3.8-flash']) {
      expect(isGemini4Model(identity)).toBe(false)
    }
  })

  test('estimates conservative standard pricing without a context tier and records introductory overestimation', () => {
    const rates = requireDefined(getLlmCost('gemini', model), 'Carbon write rates')
    expect(rates).toMatchObject({ inputCostPer1MCents: 400, outputCostPer1MCents: 2000 })
    for (const inputTokens of [0, 272_000, 272_001, 1_000_000]) {
      expect(computeTokenCost(rates, inputTokens, 1_000_000)).toMatchObject({ inputCostPer1MCents: 400, outputCostPer1MCents: 2000, totalCost: inputTokens * 400 / 1_000_000 + 2000 })
    }
    const entry = getModelRegistry().llm['gemini']?.models[model]
    expect(entry).toMatchObject({ inputCostPer1MCents: 400, cachedInputCostPer1MCents: 20, outputCostPer1MCents: 2000 })
    expect(entry?.pricingCheckedAt).toBe('2026-11-10')
    expect(entry?.pricingNotes).toContain('2026-11-30')
    expect(entry?.pricingNotes).toContain('2026-12-01')
    expect(entry?.pricingNotes).toMatch(/overstat|overestimat/)
    expect(entry?.pricingNotes).toContain('uncalibrated')
  })

  for (const effort of [undefined, 'low', 'medium', 'high', 'default'] as const) {
    test(`dispatches ${effort ?? 'omitted'} effort with documented native REST schema and cap`, async () => {
      process.env['GEMINI_API_KEY'] = 'synthetic-carbon-key'
      const calls = installMockFetch(() => jsonResponse(response()))
      const result = await runGeminiModel('Summarize the workshop.', model, options(effort))
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe(endpoint)
      expect(calls[0]?.method).toBe('POST')
      expect(calls[0]?.headers.get('x-goog-api-key')).toBe('synthetic-carbon-key')
      expect(calls[0]?.headers.get('content-type')).toBe('application/json')
      expect(calls[0]?.bodyJson?.['generationConfig']).toEqual({
        maxOutputTokens: 32_768,
        responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: schema.jsonSchema } },
        ...(effort !== undefined && effort !== 'default' ? { thinkingConfig: { thinkingLevel: effort.toUpperCase() } } : {})
      })
      expect(result.result).toBe('{"content":"A repaired bicycle."}')
      expect(result.metadata).toMatchObject({
        llmService: 'gemini', llmModel: model, providerReturnedModel: 'gemini-4-carbon-2026-11-10',
        inputTokenCount: 20, outputTokenCount: 20, tokenCountSource: 'provider_usage',
        effectiveReasoningEffort: effort ?? 'default', rawProviderUsage: usage,
        providerUsage: { inputTokenCount: 20, outputTokenCount: 20, totalTokenCount: 40 },
        requestSettings: { model, generationConfig: { maxOutputTokens: 32_768, responseFormat: { text: {
          mimeType: 'APPLICATION_JSON', schemaSha256: createHash('sha256').update(JSON.stringify(schema.jsonSchema)).digest('hex')
        } } } }
      })
      expect(result.metadata.requestedReasoningEffort).toBe(effort)
      expect(JSON.stringify(result.metadata.requestSettings)).not.toContain('Summarize the workshop.')
      expect(calls[0]?.bodyJson).not.toHaveProperty('continuationToken')
    })
  }

  test('plain text omits schema config and explicit default resets the previous effort override', async () => {
    process.env['GEMINI_API_KEY'] = 'synthetic-carbon-key'
    const calls = installMockFetch(() => jsonResponse(response('Complete answer')))
    await runGeminiModel('Synthetic prompt.', model, options('high'))
    await runGeminiModel('Synthetic prompt.', model, options('default'))
    await runGeminiModel('Synthetic prompt.', model)
    expect(calls.map(call => (call.bodyJson?.['generationConfig'] as Record<string, unknown>)['thinkingConfig'])).toEqual([{ thinkingLevel: 'HIGH' }, undefined, undefined])
    expect(calls[2]?.bodyJson?.['generationConfig']).toEqual({ maxOutputTokens: 32_768 })
  })

  test('unsupported effort rejects before credential resolution or network access', async () => {
    delete process.env['GEMINI_API_KEY']
    const calls = installMockFetch(() => jsonResponse(response()))
    for (const effort of ['disabled', 'minimal', 'xhigh', 'max'] as const) {
      await expect(runGeminiModel('Synthetic prompt', model, options(effort))).rejects.toThrow('does not support')
    }
    expect(calls).toHaveLength(0)
  })

  test('unsupported sampling, numeric thinking budgets and candidate counts reject before dispatch', async () => {
    const calls = installMockFetch(() => jsonResponse(response()))
    for (const generationConfig of [
      ...['temperature', 'topP', 'topK', 'top_p', 'top_k', 'candidateCount', 'candidate_count'].map(key => ({ [key]: 1 })),
      ...[0, 1, 8192, -1].map(thinkingBudget => ({ thinkingConfig: { thinkingBudget } })),
      ...['DISABLED', 'MINIMAL', 'XHIGH', 'MAX'].map(thinkingLevel => ({ thinkingConfig: { thinkingLevel } }))
    ]) {
      await expect(geminiGenerateContent('', { model: `models/${model}`, contents: 'Synthetic prompt', generationConfig })).rejects.toThrow(model)
    }
    expect(calls).toHaveLength(0)
  })

  test('direct REST accepts 32,768 output tokens and rejects 32,769 for both exact Gemini 4 identities', async () => {
    const calls = installMockFetch(() => jsonResponse(response('Complete answer')))
    for (const identity of [model, `models/${model}`, 'gemini-4-argon', 'models/gemini-4-argon']) {
      await geminiGenerateContent('synthetic-key', { model: identity, contents: 'Synthetic prompt', generationConfig: { maxOutputTokens: 32_768 } })
      await expect(geminiGenerateContent('', { model: identity, contents: 'Synthetic prompt', generationConfig: { maxOutputTokens: 32_769 } })).rejects.toThrow('from 1 to 32768')
    }
    expect(calls).toHaveLength(4)
  })

  for (const artifact of ['missing-candidates', 'thinking-only', 'empty', 'refusal', 'MAX_TOKENS', 'CONTINUATION', 'continuation-token'] as const) {
    test(`rejects HTTP-success ${artifact} and retains raw evidence without automatic continuation`, async () => {
      process.env['GEMINI_API_KEY'] = 'synthetic-carbon-key'
      const payload = artifact === 'missing-candidates' ? { usageMetadata: usage }
        : artifact === 'thinking-only' ? { ...response(), candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'Private reasoning' }] } }] }
          : artifact === 'empty' ? response('')
            : artifact === 'refusal' ? { modelVersion: model, promptFeedback: { blockReason: 'SAFETY' }, usageMetadata: usage }
              : artifact === 'continuation-token' ? { ...response(), candidates: [{ ...response().candidates[0], continuationToken: 'retained-progress' }] }
                : response('{"content":"Partial answer"}', artifact)
      const calls = installMockFetch(() => jsonResponse(payload))
      const error = await expectProviderHttpError(() => runGeminiModel('Synthetic prompt', model, options()), { messageContains: 'incomplete or unusable synchronous response' })
      expect(extractErrorMetadata(error)['rawResponse']).toMatchObject(payload)
      expect(extractErrorMetadata(error)['rawProviderUsage']).toEqual(usage)
      expect(calls).toHaveLength(1)
    })
  }

  const malformedCandidates = [
    { label: 'null candidates', candidates: null },
    { label: 'primitive candidates', candidates: 'invalid' },
    { label: 'null candidate', candidates: [null] },
    { label: 'primitive candidate', candidates: [1] },
    { label: 'null content', candidates: [{ content: null }] },
    { label: 'primitive content', candidates: [{ content: 'invalid' }] },
    { label: 'null parts', candidates: [{ content: { parts: null } }] },
    { label: 'primitive parts', candidates: [{ content: { parts: 'invalid' } }] },
    { label: 'object parts', candidates: [{ content: { parts: { text: 'invalid' } } }] },
    { label: 'null part', candidates: [{ content: { parts: [null] } }] },
    { label: 'primitive part', candidates: [{ content: { parts: [1] } }] },
    { label: 'array part', candidates: [{ content: { parts: [[]] } }] },
    { label: 'null alongside valid text', candidates: [{ content: { parts: [null, { text: 'Partial answer' }] } }] }
  ]
  for (const identity of [model, 'gemini-4-argon']) {
    for (const { label, candidates } of malformedCandidates) {
      test(`${identity} rejects HTTP-success ${label} before decoding and retains raw usage/evidence`, async () => {
        process.env['GEMINI_API_KEY'] = 'synthetic-key'
        const payload = { ...response(), modelVersion: identity, candidates }
        const calls = installMockFetch(() => jsonResponse(payload))
        const error = await expectProviderHttpError(() => runGeminiModel('Synthetic prompt', identity, options()), { messageContains: 'malformed candidate/content/parts' })
        expect(extractErrorMetadata(error)).toMatchObject({ model: identity, rawResponse: payload, rawProviderUsage: usage })
        expect(calls).toHaveLength(1)
      })
    }
    for (const payload of [null, 'invalid', 42, []]) {
      test(`${identity} retains a malformed ${JSON.stringify(payload)} response envelope without redispatch`, async () => {
        process.env['GEMINI_API_KEY'] = 'synthetic-key'
        const calls = installMockFetch(() => jsonResponse(payload))
        const error = await expectProviderHttpError(() => runGeminiModel('Synthetic prompt', identity, options()), { messageContains: 'malformed candidate/content/parts' })
        expect(extractErrorMetadata(error)['rawResponse']).toEqual(payload)
        expect(calls).toHaveLength(1)
      })
    }
  }

  for (const artifact of ['valid', 'malformed-json', 'schema-invalid'] as const) {
    test(`persists ${artifact} with retained response and metadata evidence`, async () => {
      process.env['GEMINI_API_KEY'] = 'synthetic-carbon-key'
      await withTempDir(async outputDir => {
        const raw = artifact === 'valid' ? '{"content":"A repaired bicycle."}' : artifact === 'malformed-json' ? '{not JSON' : '{"unexpected":"Wrong schema"}'
        const calls = installMockFetch(() => jsonResponse(response(raw)))
        const { result } = await captureLogEvents(async () => await runLlmTargetsForStructuredPrompt({
          prompt: 'Summarize.', outputDir, targets: collectLlmTargets({ outputDir, geminiModels: [model] }), structuredSchema: schema,
          structuredValidationContext: { leafPromptNames: ['content'], presetNames: [] }, reasoningEffort: 'high'
        }))
        const valid = artifact === 'valid'
        expect(result[0]?.metadata.validationFailed).toBe(!valid)
        expect(await Bun.file(join(outputDir, 'text.json')).json()).toEqual(valid ? { content: 'A repaired bicycle.' } : { _raw: raw, _validationError: expect.any(String) })
        const evidence = await Bun.file(join(outputDir, `raw-response-${model}-attempt-1.json`)).json()
        expect(evidence).toMatchObject({ result: raw, metadata: { llmModel: model, providerReturnedModel: 'gemini-4-carbon-2026-11-10', outputTokenCount: 20, requestedReasoningEffort: 'high', rawProviderUsage: usage } })
        expect(calls).toHaveLength(valid ? 1 : 2)
        if (!valid) expect(await Bun.file(join(outputDir, `raw-response-${model}-attempt-2.json`)).exists()).toBe(true)
      })
    })
  }
})
