import { describe, expect, test } from 'bun:test'
import { runOpenAIModel } from '~/cli/commands/text/write/write-services/write-openai/run-openai'
import { runOpenAIOcr } from '~/cli/commands/text/ocr/ocr-services/openai-ocr/run-openai-ocr'
import { getExtractLimits, getExtractPricing, getLlmCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { requireDefined } from '../../../test-utils/value-assertions'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, structuredOpts, withOcrDocumentFixture } from './openai-rest-contracts/shared'

installOpenAIRestContractHooks()

// Independent expectations: official GPT-6.1 Sol / GPT-6 Luna model cards and GPT-6
// migration guide, fetched 2026-10-17. Responses uses reasoning.effort and text.format.
// https://developers.openai.com/api/docs/models/gpt-6.1-sol
// https://developers.openai.com/api/docs/models/gpt-6-luna
// https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6.1-sol
for (const model of ['gpt-6.1-sol', 'gpt-6-luna'] as const) {
  describe(`${model} Responses transport and decoded output contracts`, () => {
    test('write dispatch preserves native JSON and default, override and reset reasoning', async () => {
      process.env['OPENAI_API_KEY'] = 'local-test'
      const calls = installFetch(() => jsonResponse({
        status: 'completed', model,
        output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: '{"summary":"done"}' }] }],
        usage: { input_tokens: 100, output_tokens: 20, output_tokens_details: { reasoning_tokens: 10 } }
      }))
      for (const requestedReasoningEffort of [undefined, 'xhigh', 'default'] as const) {
        const result = await runOpenAIModel('Summarize.', model, { ...structuredOpts, requestedReasoningEffort })
        expect(result.result).toBe('{"summary":"done"}')
        expect(result.metadata).toMatchObject({ llmService: 'openai', llmModel: model, providerReturnedModel: model, outputTokenCount: 20, effectiveReasoningEffort: requestedReasoningEffort ?? 'default' })
      }
      expect(calls.map(call => call.bodyJson?.['reasoning'])).toEqual([undefined, { effort: 'xhigh' }, undefined])
      for (const call of calls) {
        expect(call.url).toBe('https://api.openai.com/v1/responses')
        expect(call.bodyJson).toMatchObject({ model, input: 'Summarize.', stream: false, text: { format: { type: 'json_schema', name: 'summary', strict: true, schema: structuredOpts.schema } } })
        expect(call.bodyJson).not.toHaveProperty('reasoning_effort')
      }
    })

    test('all accepted effort levels reach write and OCR dispatch; unsupported efforts reject before credentials', async () => {
      process.env['OPENAI_API_KEY'] = 'local-test'
      const calls = installFetch(() => jsonResponse({ status: 'completed', output_text: 'Visible text' }))
      await withOcrDocumentFixture({ slug: 'page', format: 'png' }, async ({ path, metadata }) => {
        for (const effort of ['low', 'medium', 'high', 'xhigh', 'max'] as const) {
          await runOpenAIModel('Read.', model, { ...structuredOpts, requestedReasoningEffort: effort })
          await runOpenAIOcr(path, metadata, model, { reasoningEffort: effort })
          expect(calls.at(-1)?.bodyJson?.['reasoning']).toEqual({ effort })
          expect(calls.at(-2)?.bodyJson?.['reasoning']).toEqual({ effort })
        }
        if (model === 'gpt-6-luna') {
          await runOpenAIModel('Read.', model, { ...structuredOpts, requestedReasoningEffort: 'disabled' })
          await runOpenAIOcr(path, metadata, model, { reasoningEffort: 'disabled' })
          expect(calls.at(-1)?.bodyJson?.['reasoning']).toEqual({ effort: 'none' })
          expect(calls.at(-2)?.bodyJson?.['reasoning']).toEqual({ effort: 'none' })
        }
        const count = calls.length
        delete process.env['OPENAI_API_KEY']
        for (const effort of model === 'gpt-6.1-sol' ? ['minimal', 'disabled'] as const : ['minimal'] as const) {
          await expect(runOpenAIModel('Read.', model, { ...structuredOpts, requestedReasoningEffort: effort })).rejects.toThrow('does not support')
          await expect(runOpenAIOcr(path, metadata, model, { reasoningEffort: effort })).rejects.toThrow('does not support')
        }
        expect(calls).toHaveLength(count)
      })
    })

    test('OCR dispatch sends native PDF/images and complete JSON pages with default/override/reset', async () => {
      process.env['OPENAI_API_KEY'] = 'local-test'
      const calls = installFetch(() => jsonResponse({ status: 'completed', output_text: '{"pages":[{"pageNumber":1,"text":"one"},{"pageNumber":2,"text":"two"}]}' }))
      for (const format of ['pdf', 'png'] as const) {
        await withOcrDocumentFixture({ slug: 'pages', format, pageCount: 2 }, async ({ path, bytes, metadata }) => {
          for (const reasoningEffort of [undefined, 'high', 'default'] as const) {
            const result = await runOpenAIOcr(path, metadata, model, { reasoningEffort })
            expect(result.pages.map(page => page.text)).toEqual(['one', 'two'])
            const body = calls.at(-1)?.bodyJson
            expect(body?.['text']).toMatchObject({ format: { type: 'json_schema', name: 'ocr_pages', strict: true } })
            expect(body?.['reasoning']).toEqual(reasoningEffort === 'high' ? { effort: 'high' } : undefined)
            const input = body?.['input'] as Array<{ content: unknown[] }>
            expect(input[0]?.content[1]).toMatchObject(format === 'pdf'
              ? { type: 'input_file', file_data: `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}` }
              : { type: 'input_image', detail: 'high', image_url: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` })
          }
        })
      }
      expect(getExtractLimits('openai', model, 'pdf')).toMatchObject({ contextTokens: 1050000, maxOutputTokens: 128000, effectiveBytes: 52428800 })
    })

    test('refusal and incomplete output fail after transport success instead of becoming blank OCR', async () => {
      process.env['OPENAI_API_KEY'] = 'local-test'
      for (const response of [
        { status: 'incomplete', output_text: '{"summary":"partial"}', incomplete_details: { reason: 'max_output_tokens' } },
        { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Declined' }] }] },
        { status: 'failed', error: { message: 'failed' } }
      ]) {
        const calls = installFetch(() => jsonResponse(response))
        await expect(runOpenAIModel('Read.', model, structuredOpts)).rejects.toThrow('instead of completed text')
        await withOcrDocumentFixture({ slug: 'page', format: 'png' }, async ({ path, metadata }) => {
          await expect(runOpenAIOcr(path, metadata, model)).rejects.toThrow('instead of completed text')
        })
        expect(calls).toHaveLength(2)
      }
    })

    test('invalid OCR page coverage is rejected and retains the invalid response', async () => {
      process.env['OPENAI_API_KEY'] = 'local-test'
      const invalid = '{"pages":[{"pageNumber":1,"text":"missing second page"}]}'
      installFetch(() => jsonResponse({ status: 'completed', output_text: invalid }))
      await withOcrDocumentFixture({ slug: 'pages', format: 'pdf', pageCount: 2 }, async ({ path, metadata }) => {
        try {
          await runOpenAIOcr(path, metadata, model)
          expect.unreachable('Incomplete page coverage must fail')
        } catch (error) {
          expect(error).toHaveProperty('rawResponse', invalid)
        }
      })
    })

    test('native token cost uses full-request rates immediately above 272000 input tokens', () => {
      const input = model === 'gpt-6.1-sol' ? 200 : 10
      const output = model === 'gpt-6.1-sol' ? 1000 : 50
      const ocr = getExtractPricing('openai', model)
      const rates = { ...ocr, inputCostPer1MCents: requireDefined(ocr.inputCostPer1MCents, 'input'), outputCostPer1MCents: requireDefined(ocr.outputCostPer1MCents, 'output') }
      for (const pricing of [requireDefined(getLlmCost('openai', model), 'write'), rates]) {
        expect(computeTokenCost(pricing, 272000, 100)).toMatchObject({ inputCostPer1MCents: input, outputCostPer1MCents: output })
        const long = computeTokenCost(pricing, 272001, 100)
        expect(long).toMatchObject({ inputCostPer1MCents: input * 2, outputCostPer1MCents: output * 1.5 })
        expect(long.totalCost).toBeCloseTo((272001 * input * 2 + 100 * output * 1.5) / 1000000, 8)
      }
    })
  })
}
