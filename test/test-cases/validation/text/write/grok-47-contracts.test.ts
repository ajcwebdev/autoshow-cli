import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import * as v from 'valibot'
import type { DocumentMetadata, ResolvedStructuredSchema } from '~/types'
import { runGrokModel } from '~/cli/commands/text/write/write-services/write-grok/run-grok'
import { collectLlmTargets, runLlmTargetsForStructuredPrompt } from '~/cli/commands/text/write/run-llm'
import { runGrokOcr } from '~/cli/commands/text/ocr/ocr-services/grok-ocr/run-grok-ocr'
import { OcrOutputLimitError, OcrStructuredResponseError } from '~/cli/commands/text/ocr/ocr-structured-response-error'
import { toRequestedProvider } from '~/cli/commands/text/ocr/ocr-run-state'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { getLlmCost } from '~/cli/commands/setup-and-utilities/models/model-loader/llm-accessors'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader/extract'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { computeOcrTokenCost } from '~/utils/pricing/ocr-token-pricing'
import { extractErrorMetadata } from '~/utils/error-handler'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

// Independent wire/limit expectations, read 2026-10-17:
// https://docs.x.ai/developers/model-capabilities/legacy/chat-completions
// https://docs.x.ai/developers/model-capabilities/text/structured-outputs
// https://docs.x.ai/developers/rest-api-reference/inference/chat-completions.md
// https://docs.x.ai/developers/pricing: long context >=200k, all request tokens.
const ocrOptions = { dpi: 150, outputDir: '.' }
const model = 'grok-4.7'
const endpoint = 'https://api.x.ai/v1/chat/completions'
const lifecycle = setupContractSuiteLifecycle({ envKeys: ['XAI_API_KEY'], tempPrefix: 'autoshow-grok-47-' })
const schema: ResolvedStructuredSchema = {
  schemaName: 'summary',
  leafPromptNames: ['summary'],
  presetNames: [],
  schema: v.object({ summary: v.string() }),
  jsonSchema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false }
}
const response = (content: unknown, finishReason = 'stop') => Response.json({
  model,
  choices: [{ message: { role: 'assistant', content }, finish_reason: finishReason }],
  usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 150, prompt_tokens_details: { cached_tokens: 40 }, completion_tokens_details: { reasoning_tokens: 20 } }
})
const metadata = (format: DocumentMetadata['format']): DocumentMetadata => ({ slug: 'synthetic', format, pageCount: 1, fileSize: 3 })

describe('Grok 4.7 documented Chat Completions and OCR contracts', () => {
  test('explicit selectors and defaults use Grok 4.7 for write and OCR', () => {
    expect(buildOptsFromFlags({ grok: true }).grokModels).toEqual(['grok-4.7'])
    expect(buildOptsFromFlags({ 'grok-ocr': true }).grokOcrModels).toEqual(['grok-4.7'])
    expect(buildOptsFromFlags({ grok: model }).grokModels).toEqual([model])
    expect(buildOptsFromFlags({ 'grok-ocr': model }).grokOcrModels).toEqual([model])
    expect(buildOptsFromFlags({ 'all-llm': true }).grokModels).toContain(model)
    expect(buildOptsFromFlags({ 'all-ocr': true }).grokOcrModels).toContain(model)
    expect(() => buildOptsFromFlags({ 'grok-ocr': 'grok-4.5' })).toThrow('Allowed values: grok-4.7')
    expect(() => buildOptsFromFlags({ grok: 'grok-4.5' })).toThrow('Invalid model "grok-4.5" for --llm grok[=model]. Allowed values: grok-4.7')
    expect(() => buildOptsFromFlags({ 'grok-ocr': 'grok-4.3' })).toThrow('Allowed values: grok-4.7')
  })

  for (const effort of [undefined, 'low', 'medium', 'high', 'xhigh', 'default'] as const) {
    test(`write dispatch uses native schema and ${effort ?? 'omitted'} reasoning; usage preserves billed totals`, async () => {
      process.env['XAI_API_KEY'] = 'mock-grok-key'
      const calls = installMockFetch(() => response('{"summary":"A synthetic summary."}'))
      const result = await runGrokModel('Summarize the synthetic note.', model, {
        schemaName: schema.schemaName, schema: schema.jsonSchema, strict: true, strategy: 'native', requestedReasoningEffort: effort
      })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe(endpoint)
      expect(calls[0]?.headers.get('authorization')).toBe('Bearer mock-grok-key')
      expect(calls[0]?.bodyJson).toEqual({
        model,
        messages: [{ role: 'user', content: 'Summarize the synthetic note.' }],
        response_format: { type: 'json_schema', json_schema: { name: 'summary', schema: schema.jsonSchema, strict: true } },
        ...(effort && effort !== 'default' ? { reasoning_effort: effort } : {})
      })
      expect(result.result).toBe('{"summary":"A synthetic summary."}')
      expect(result.metadata).toMatchObject({ llmService: 'grok', llmModel: model, providerReturnedModel: model, inputTokenCount: 100, outputTokenCount: 50, effectiveReasoningEffort: effort ?? 'default', tokenCountSource: 'provider_usage' })
      expect(result.metadata.requestedReasoningEffort).toBe(effort)
      expect(result.metadata.providerUsage).toMatchObject({ outputTokenCount: 50, totalTokenCount: 150 })
      expect(result.metadata.rawProviderUsage).toMatchObject({ completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 20 } })
    })

    test(`PNG OCR sends documented image blocks and ${effort ?? 'omitted'} reasoning; blank text is valid`, async () => {
      process.env['XAI_API_KEY'] = 'mock-grok-key'
      const calls = installMockFetch(() => response(''))
      const path = 'input/examples/document/1-document.png'
      const result = await runGrokOcr(path, metadata('png'), model, { ...ocrOptions, reasoningEffort: effort })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe(endpoint)
      const body = calls[0]?.bodyJson
      expect(body).toMatchObject({ model, max_completion_tokens: 4096 })
      expect(body?.['reasoning_effort']).toBe(effort && effort !== 'default' ? effort : undefined)
      expect(body).not.toHaveProperty('response_format')
      const messages = body?.['messages'] as Array<{ role: string, content: Array<Record<string, unknown>> }>
      expect(messages[0]?.role).toBe('user')
      expect(messages[0]?.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('Return only the text visible') })
      expect(messages[0]?.content[1]).toEqual({ type: 'image_url', image_url: { url: `data:image/png;base64,${Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')}` } })
      expect(result).toMatchObject({ pages: [{ pageNumber: 1, method: 'ocr', text: '' }], promptTokens: 100, completionTokens: 50, effectiveReasoningEffort: effort ?? 'default' })
      const requested = toRequestedProvider({ service: 'grok', model }, { reasoningEffort: effort })
      expect(requested).toMatchObject({ service: 'grok', model, settings: { settingsSchema: 'grok.ocr.v1', request: { model, effectiveReasoningEffort: effort ?? 'default' } } })
    })
  }

  test('write and OCR preserve completion totals when reasoning usage is absent', async () => {
    process.env['XAI_API_KEY'] = 'mock-grok-key'
    const calls = installMockFetch(() => Response.json({ model, choices: [{ message: { content: 'Synthetic page.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 30 } }))
    const write = await runGrokModel('Summarize.', model)
    const ocr = await runGrokOcr('input/examples/document/1-document.png', metadata('png'), model, ocrOptions)
    expect(write.metadata.outputTokenCount).toBe(30)
    expect(write.metadata.rawProviderUsage).toEqual({ prompt_tokens: 100, completion_tokens: 30 })
    expect(ocr.completionTokens).toBe(30)
    expect(calls).toHaveLength(2)
  })

  for (const finishReason of ['length', 'content_filter', 'tool_calls', null]) {
    test(`write rejects ${String(finishReason)} even with schema-valid JSON, retaining raw usage without retrying`, async () => {
      process.env['XAI_API_KEY'] = 'mock-grok-key'
      const calls = installMockFetch(() => Response.json({ model, choices: [{ message: { content: '{"summary":"valid prefix"}' }, finish_reason: finishReason }], usage: { prompt_tokens: 100, completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 20 } } }))
      try {
        await runGrokModel('Summarize.', model, { schemaName: 'summary', schema: schema.jsonSchema, strict: true, strategy: 'native' })
        expect.unreachable('An incomplete response must fail')
      } catch (error) {
        expect(extractErrorMetadata(error)).toMatchObject({ retryable: false, stage: 'write:grok', rawProviderUsage: { completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 20 } }, rawResponse: { choices: [{ finish_reason: finishReason }] } })
      }
      expect(calls).toHaveLength(1)
    })
  }

  test('write rejects refusal text and malformed content without treating HTTP success as usable output', async () => {
    process.env['XAI_API_KEY'] = 'mock-grok-key'
    for (const message of [{ content: '{"summary":"not usable"}', refusal: 'Refused' }, { content: null }, { content: [{ text: 'wrong wire shape' }] }]) {
      const calls = installMockFetch(() => Response.json({ model, choices: [{ message, finish_reason: 'stop' }] }))
      await expect(runGrokModel('Summarize.', model)).rejects.toThrow('incomplete or unusable')
      expect(calls).toHaveLength(1)
    }
  })

  test('JPEG OCR preserves returned page text and the JPEG data URL', async () => {
    process.env['XAI_API_KEY'] = 'mock-grok-key'
    const calls = installMockFetch(() => response('  Synthetic page.\nSecond line.  '))
    const result = await runGrokOcr('input/examples/document/1-document.jpg', metadata('jpg'), model, ocrOptions)
    expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'Synthetic page.\nSecond line.' }])
    const messages = calls[0]?.bodyJson?.['messages'] as Array<{ content: Array<{ image_url?: { url: string } }> }>
    expect(messages[0]?.content[1]?.image_url?.url).toStartWith('data:image/jpeg;base64,')
  })

  test('unsupported reasoning is rejected before dispatch or image reads', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected provider dispatch') })
    for (const effort of ['disabled', 'minimal', 'max'] as const) {
      await expect(runGrokModel('note', model, { schemaName: '', schema: {}, strict: true, strategy: 'native', requestedReasoningEffort: effort })).rejects.toThrow('does not support')
      await expect(runGrokOcr('/missing', metadata('png'), model, { ...ocrOptions, reasoningEffort: effort })).rejects.toThrow('does not support')
    }
    expect(calls).toHaveLength(0)
  })

  test('unsupported image formats and images above 20 MiB fail before dispatch', async () => {
    process.env['XAI_API_KEY'] = 'mock-grok-key'
    const calls = installMockFetch(() => { throw new Error('Unexpected provider dispatch') })
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'synthetic.webp')
      await Bun.write(path, new Uint8Array([1, 2, 3]))
      await expect(runGrokOcr(path, metadata('webp'), model, ocrOptions)).rejects.toThrow('Unsupported Grok OCR image format')
      await Bun.write(path, new Uint8Array(20 * 1024 * 1024 + 1))
      await expect(runGrokOcr(path, metadata('png'), model, ocrOptions)).rejects.toThrow('20 MiB')
    })
    expect(calls).toHaveLength(0)
  })

  for (const invalid of [null, 42, { text: 'wrong shape' }]) {
    test(`transport-success OCR with ${JSON.stringify(invalid)} content fails artifact validation`, async () => {
      process.env['XAI_API_KEY'] = 'mock-grok-key'
      const calls = installMockFetch(() => response(invalid))
      await expect(runGrokOcr('input/examples/document/1-document.png', metadata('png'), model, ocrOptions)).rejects.toBeInstanceOf(OcrStructuredResponseError)
      expect(calls).toHaveLength(1)
    })
  }

  test('truncated OCR retains partial text in the output-limit error', async () => {
    process.env['XAI_API_KEY'] = 'mock-grok-key'
    const calls = installMockFetch(() => response('Paid partial page', 'length'))
    try {
      await runGrokOcr('input/examples/document/1-document.png', metadata('png'), model, ocrOptions)
      expect.unreachable('Truncated OCR must reject')
    } catch (error) {
      expect(error).toBeInstanceOf(OcrOutputLimitError)
      expect((error as OcrOutputLimitError).rawResponse).toBe('Paid partial page')
      expect(extractErrorMetadata(error)).toMatchObject({ retryable: false, rawProviderUsage: { completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 20 } } })
    }
    expect(calls).toHaveLength(1)
  })

  test('OCR refusals are failures even when the transport provides text', async () => {
    process.env['XAI_API_KEY'] = 'mock-grok-key'
    const calls = installMockFetch(() => Response.json({ choices: [{ message: { content: 'Cannot process', refusal: 'Refused' }, finish_reason: 'stop' }] }))
    await expect(runGrokOcr('input/examples/document/1-document.png', metadata('png'), model, ocrOptions)).rejects.toThrow('refused')
    expect(calls).toHaveLength(1)
  })

  for (const finishReason of ['content_filter', 'tool_calls', null]) {
    test(`OCR rejects ${String(finishReason)} with visible text and retains paid usage without retrying`, async () => {
      process.env['XAI_API_KEY'] = 'mock-grok-key'
      const calls = installMockFetch(() => Response.json({ model, choices: [{ message: { content: 'Paid partial text' }, finish_reason: finishReason }], usage: { prompt_tokens: 100, completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 20 } } }))
      try {
        await runGrokOcr('input/examples/document/1-document.png', metadata('png'), model, ocrOptions)
        expect.unreachable('An incomplete response must fail')
      } catch (error) {
        expect(error).toBeInstanceOf(OcrStructuredResponseError)
        expect(extractErrorMetadata(error)).toMatchObject({ retryable: false, rawProviderUsage: { completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 20 } }, rawResponse: { choices: [{ finish_reason: finishReason }] } })
      }
      expect(calls).toHaveLength(1)
    })
  }

  for (const content of ['{"summary":"Valid synthetic summary."}', '{"unexpected":"invalid schema"}', 'invalid JSON']) {
    test(`actual write dispatch persists ${content.includes('Valid synthetic') ? 'valid' : 'invalid'} structured output and raw evidence`, async () => {
      process.env['XAI_API_KEY'] = 'mock-grok-key'
      const calls = installMockFetch(() => response(content))
      await lifecycle.withDir(async dir => {
        const results = await runLlmTargetsForStructuredPrompt({ prompt: 'Summarize.', outputDir: dir, targets: collectLlmTargets({ outputDir: dir, grokModels: [model] }), structuredSchema: schema, structuredValidationContext: { leafPromptNames: ['summary'], presetNames: [] } })
        const valid = content.includes('Valid synthetic')
        expect(results[0]?.metadata.validationFailed).toBe(!valid)
        const saved = await Bun.file(join(dir, 'text.json')).json()
        expect(saved).toMatchObject(valid ? { summary: 'Valid synthetic summary.' } : { _raw: content, _validationError: expect.any(String) })
        expect(await Bun.file(join(dir, 'raw-response-grok-4.7-attempt-1.json')).json()).toMatchObject({ result: content, metadata: { llmModel: model, inputTokenCount: 100, outputTokenCount: 50 } })
      })
      expect(calls).toHaveLength(1)
    })
  }

  test('write and OCR price all tokens at the documented inclusive 200K boundary', () => {
    const llm = getLlmCost('grok', model)!
    const ocr = getExtractPricing('grok', model)
    const registry = getModelRegistry()
    expect(registry.llm['grok']?.models[model]).toMatchObject({ pricingCheckedAt: '2026-10-17', cachedInputCostPer1MCents: 50, limits: { contextTokens: 500000 }, reasoning: { support: 'required', allowDisabled: false, supportedEfforts: ['low', 'medium', 'high', 'xhigh'] } })
    expect(registry.extract['grok']?.models[model]).toMatchObject({ costPerMCachedInputTokensCents: 50, limits: { imageBytes: 20971520, contextTokens: 500000 } })
    for (const input of [0, 199999, 200000, 200001, 500000]) {
      const long = input >= 200000
      for (const cost of [computeTokenCost(llm, input, 1000), computeOcrTokenCost(ocr, 0, 0, input, 1000)]) {
        expect(cost.inputCostPer1MCents).toBe(long ? 400 : 200)
        expect(cost.outputCostPer1MCents).toBe(long ? 1200 : 600)
        expect(cost.totalCost).toBeCloseTo(input / 1000000 * (long ? 400 : 200) + (long ? 1.2 : 0.6), 8)
      }
    }
  })
})
