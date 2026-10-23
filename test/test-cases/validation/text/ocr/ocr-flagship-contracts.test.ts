import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runOpenAIOcr } from '~/cli/commands/text/ocr/ocr-services/openai-ocr/run-openai-ocr'
import { runAnthropicOcr } from '~/cli/commands/text/ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader/extract'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { computeOcrTokenCost } from '~/utils/pricing/ocr-token-pricing'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const lifecycle = setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'], tempPrefix: 'autoshow-ocr-flagship-' })
const pages = [{ pageNumber: 1, text: 'Synthetic document' }] as const

describe('Flagship OCR additions', () => {
  test('new and existing OCR selectors resolve with the current cheapest bare default', () => {
    for (const model of ['gpt-6.1-sol', 'gpt-6-luna']) {
      expect(buildOptsFromFlags({ 'openai-ocr': model }).openaiOcrModels).toEqual([model])
    }
    expect(() => buildOptsFromFlags({ 'openai-ocr': 'gpt-6-astra' })).toThrow('Allowed values: gpt-6.1-sol, gpt-6-luna')
    expect(() => buildOptsFromFlags({ 'anthropic-ocr': 'claude-fable-5-1' })).toThrow('Allowed values: claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5, claude-fable-5')
    for (const model of ['claude-opus-5-5', 'claude-fable-5', 'claude-sonnet-5-5']) {
      expect(buildOptsFromFlags({ 'anthropic-ocr': model }).anthropicOcrModels).toEqual([model])
    }
    expect(buildOptsFromFlags({ 'anthropic-ocr': true }).anthropicOcrModels).toEqual(['claude-haiku-5-5'])
  })

  for (const format of ['png', 'pdf'] as const) {
    for (const effort of ['default', 'low', 'medium', 'high', 'xhigh', 'max'] as const) {
      test(`Opus 5.5 ${format} preserves Messages construction and ${effort} reasoning`, async () => {
        process.env['ANTHROPIC_API_KEY'] = 'test-key'
        const calls = installMockFetch((call) => {
          if (call.method === 'DELETE') return Response.json({ id: 'file_synthetic', type: 'file_deleted' })
          if (call.url.endsWith('/files')) return Response.json({ id: 'file_synthetic' })
          return Response.json({ content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text: JSON.stringify({ pages }) }], usage: { input_tokens: 100, output_tokens: 20 } })
        })
        await lifecycle.withDir(async (dir) => {
          const path = join(dir, `synthetic.${format}`)
          await Bun.write(path, new Uint8Array([1, 2, 3]))
          const result = await runAnthropicOcr(path, { slug: 'synthetic', format, pageCount: 1, fileSize: 3 }, 'claude-opus-5-5', { reasoningEffort: effort })
          expect(result.pages).toEqual([{ ...pages[0], method: 'ocr' }])
          expect(result).toMatchObject({ promptTokens: 100, completionTokens: 20, effectiveReasoningEffort: effort })
          const request = calls.find((call) => call.url.endsWith('/messages'))
          expect(request?.bodyJson?.['model']).toBe('claude-opus-5-5')
          expect(request?.bodyJson).not.toHaveProperty('thinking')
          expect(request?.bodyJson).not.toHaveProperty('tool_choice')
          expect(request?.bodyJson).not.toHaveProperty('cache_control')
          expect(request?.bodyJson?.['output_config']).toMatchObject({
            ...(effort === 'default' ? {} : { effort }),
            format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['pages'] } }
          })
          if (effort === 'default') expect(request?.bodyJson?.['output_config']).not.toHaveProperty('effort')
          const messages = request?.bodyJson?.['messages'] as Array<{ content: Array<Record<string, unknown>> }>
          expect(messages[0]?.content[0]?.['text']).toContain('JSON')
          expect(messages[0]?.content[1]).toMatchObject(format === 'pdf'
            ? { type: 'document', source: { type: 'file', file_id: 'file_synthetic' } }
            : { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AQID' } })
          expect(calls).toHaveLength(format === 'pdf' ? 3 : 1)
        })
      })
    }
    for (const effort of ['default', 'low', 'medium', 'high', 'xhigh', 'max'] as const) {
      test(`GPT-6.1 Sol ${format} preserves single-page text and ${effort} reasoning`, async () => {
        process.env['OPENAI_API_KEY'] = 'test-key'
        const calls = installMockFetch(() => Response.json({ output_text: 'Synthetic document', usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 80 } } }))
        await lifecycle.withDir(async (dir) => {
          const path = join(dir, `synthetic.${format}`)
          await Bun.write(path, new Uint8Array([1, 2, 3]))
          const result = await runOpenAIOcr(path, { slug: 'synthetic', format, pageCount: 1, fileSize: 3 }, 'gpt-6.1-sol', { reasoningEffort: effort })
          expect(result).toMatchObject({ pages: [{ ...pages[0], method: 'ocr' }], promptTokens: 100, completionTokens: 20 })
          const body = calls[0]?.bodyJson
          expect(body?.['text']).toEqual({ verbosity: 'low' })
          if (effort === 'default') expect(body).not.toHaveProperty('reasoning')
          else expect(body?.['reasoning']).toEqual({ effort })
          const input = body?.['input'] as Array<{ content: Array<Record<string, unknown>> }>
          expect(input[0]?.content[1]?.['type']).toBe(format === 'pdf' ? 'input_file' : 'input_image')
          expect(calls).toHaveLength(1)
        })
      })
    }
  }

  test('unsupported reasoning fails before file reads or HTTP', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected HTTP') })
    const metadata = { slug: 'synthetic', format: 'png' as const, pageCount: 1, fileSize: 3 }
    for (const reasoningEffort of ['disabled', 'minimal'] as const) {
      await expect(runOpenAIOcr('/missing', metadata, 'gpt-6.1-sol', { reasoningEffort })).rejects.toThrow('does not support')
      await expect(runAnthropicOcr('/missing', metadata, 'claude-opus-5-5', { reasoningEffort })).rejects.toThrow('does not support')
    }
    expect(calls).toHaveLength(0)
  })

  test('GPT-6.1 Sol prices the whole request at the context boundary with separate cache metadata', () => {
    const pricing = getExtractPricing('openai', 'gpt-6.1-sol')
    expect(pricing.cachedInputCostPer1MCents).toBe(10)
    expect(getModelRegistry().extract['openai']?.models['gpt-6.1-sol']?.tokenPricingBands).toMatchObject([
      { maxInputTokens: 272000, cachedInputCostPer1MCents: 10 },
      { minInputTokens: 272001, cachedInputCostPer1MCents: 20 }
    ])
    for (const input of [0, 271999, 272000, 272001, 1050000]) {
      const cost = computeOcrTokenCost(pricing, 0, 0, input, 1000)
      const long = input > 272000
      expect(cost.inputCostPer1MCents).toBe(long ? 400 : 200)
      expect(cost.outputCostPer1MCents).toBe(long ? 1500 : 1000)
      expect(cost.totalCost).toBeCloseTo(input / 1000000 * (long ? 400 : 200) + (long ? 1.5 : 1), 6)
    }
  })

  test('Opus 5.5 cache-read metadata never discounts uncached OCR estimates', () => {
    const pricing = getExtractPricing('anthropic', 'claude-opus-5-5')
    expect(pricing.cachedInputCostPer1MCents).toBe(20)
    expect(computeOcrTokenCost(pricing, 0, 0, 1000000, 1000000).totalCost).toBe(2400)
  })
})
