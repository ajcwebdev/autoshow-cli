import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import * as v from 'valibot'
import type { DocumentMetadata, ResolvedStructuredSchema, StructuredRequestOptions } from '~/types'
import { runAnthropicModel } from '~/cli/commands/text/write/write-services/write-anthropic/run-anthropic'
import { runAnthropicOcr } from '~/cli/commands/text/ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runLlmTargetsForStructuredPrompt } from '~/cli/commands/text/write/run-llm'
import { writeInvalidOcrStructuredResponse } from '~/cli/commands/text/ocr/ocr-structured-response-error'
import { getLlmCost } from '~/cli/commands/setup-and-utilities/models/model-loader/llm-accessors'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader/extract'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { computeOcrTokenCost } from '~/utils/pricing/ocr-token-pricing'
import { extractErrorMetadata } from '~/utils/error-handler'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

// Independent first-party contracts, checked 2026-10-17:
// https://platform.claude.com/docs/en/models/opus-5-5/overview
// https://platform.claude.com/docs/en/models/sonnet-5-5/overview
// https://platform.claude.com/docs/en/models/haiku-5-5/overview
// https://platform.claude.com/docs/en/build-with-claude/effort
// https://platform.claude.com/docs/en/build-with-claude/structured-outputs
// https://platform.claude.com/docs/en/build-with-claude/vision
// These mocked tests establish request/decoded-artifact contracts, not OCR accuracy.
const lifecycle = setupContractSuiteLifecycle({ envKeys: ['ANTHROPIC_API_KEY'], tempPrefix: 'autoshow-claude-5-5-' })
const models = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const
const metadata: DocumentMetadata = { slug: 'synthetic', format: 'png', pageCount: 1, fileSize: 68 }
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64')
const pageText = '{"pages":[{"pageNumber":1,"text":"Synthetic document"}]}'
const structuredSchema: ResolvedStructuredSchema = {
  schemaName: 'content', leafPromptNames: ['content'], presetNames: [],
  schema: v.object({ content: v.string() }),
  jsonSchema: { type: 'object', additionalProperties: false, required: ['content'], properties: { content: { type: 'string' } } }
}
const structuredOpts: StructuredRequestOptions = { schemaName: 'content', schema: structuredSchema.jsonSchema, strict: false, strategy: 'native' }

describe('Claude 5.5 Messages and native JSON contracts', () => {
  for (const model of models) {
    test(`${model} write accepts every documented effort, resets native defaults, and filters thinking`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json({
        model, stop_reason: 'end_turn',
        content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: '{"content":' }, { type: 'text', text: '"valid"}' }],
        usage: { input_tokens: 40, output_tokens: 20 }
      }))
      for (const effort of [undefined, 'low', 'medium', 'high', 'xhigh', 'max', 'default'] as const) {
        const result = await runAnthropicModel('Summarize.', model, { ...structuredOpts, requestedReasoningEffort: effort })
        const call = calls.at(-1)
        expect(call?.url).toBe('https://api.anthropic.com/v1/messages')
        expect(call?.headers.get('anthropic-version')).toBe('2023-06-01')
        expect(call?.bodyJson?.['output_config']).toEqual({
          ...(effort && effort !== 'default' ? { effort } : {}),
          format: { type: 'json_schema', schema: structuredSchema.jsonSchema }
        })
        expect(call?.bodyJson?.['max_tokens']).toBe(16000)
        for (const absent of ['thinking', 'tool_choice', 'tools', 'temperature', 'top_p', 'top_k']) expect(call?.bodyJson).not.toHaveProperty(absent)
        expect(JSON.parse(result.result)).toEqual({ content: 'valid' })
        expect(result.metadata.effectiveReasoningEffort).toBe(effort ?? 'default')
        expect(result.metadata.requestedReasoningEffort).toBe(effort)
      }
      expect(calls).toHaveLength(7)
    })

    test(`${model} OCR dispatch merges native JSON and all accepted effort overrides/reset`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json({
        model, stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: pageText }],
        usage: { input_tokens: 4800, output_tokens: 30 }
      }))
      await lifecycle.withDir(async dir => {
        const path = join(dir, 'one-pixel.png')
        await Bun.write(path, png)
        for (const effort of [undefined, 'low', 'medium', 'high', 'xhigh', 'max', 'default'] as const) {
          const result = await runAnthropicOcr(path, metadata, model, { reasoningEffort: effort })
          const body = calls.at(-1)?.bodyJson
          expect(body?.['model']).toBe(model)
          expect(body?.['max_tokens']).toBe(64000)
          const config = body?.['output_config'] as Record<string, unknown>
          expect(config['effort']).toBe(effort && effort !== 'default' ? effort : undefined)
          expect(config['format']).toMatchObject({ type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['pages'] } })
          const schema = (config['format'] as { schema: Record<string, unknown> }).schema
          expect(JSON.stringify(schema)).not.toContain('"minimum"')
          expect(body?.['messages']).toMatchObject([{ role: 'user', content: [{ type: 'text' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } }] }])
          expect(result).toMatchObject({ pages: [{ pageNumber: 1, method: 'ocr', text: 'Synthetic document' }], promptTokens: 4800, completionTokens: 30, effectiveReasoningEffort: effort ?? 'default' })
        }
      })
      expect(calls).toHaveLength(7)
    })

    test(`${model} rejects unsupported reasoning before credentials, file reads or dispatch`, async () => {
      const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
      for (const effort of model === 'claude-haiku-5-5' ? ['minimal'] as const : ['minimal', 'disabled'] as const) {
        await expect(runAnthropicModel('Summarize.', model, { ...structuredOpts, requestedReasoningEffort: effort })).rejects.toThrow('does not support')
        await expect(runAnthropicOcr('/missing', metadata, model, { reasoningEffort: effort })).rejects.toThrow('does not support')
      }
      expect(calls).toHaveLength(0)
    })
  }

  test('Haiku disabled thinking reaches both dispatch paths, followed by a clean reset', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'mock-key'
    const calls = installMockFetch(() => Response.json({ content: [{ type: 'text', text: pageText }] }))
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'image.png')
      await Bun.write(path, png)
      for (const effort of ['disabled', 'default'] as const) {
        await runAnthropicModel('Summarize.', 'claude-haiku-5-5', { ...structuredOpts, requestedReasoningEffort: effort })
        await runAnthropicOcr(path, metadata, 'claude-haiku-5-5', { reasoningEffort: effort })
        expect(calls.at(-1)?.bodyJson?.['thinking']).toEqual(effort === 'disabled' ? { type: 'disabled' } : undefined)
        expect(calls.at(-2)?.bodyJson?.['thinking']).toEqual(effort === 'disabled' ? { type: 'disabled' } : undefined)
      }
    })
  })

  test('Claude PDF upload dispatch uses native JSON, Files beta and cleanup', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'mock-key'
    const calls = installMockFetch(call => Response.json(call.method === 'DELETE'
      ? { id: 'file_pdf', type: 'file_deleted' }
      : call.url.endsWith('/files') ? { id: 'file_pdf' } : { content: [{ type: 'text', text: pageText }] }))
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'document.pdf')
      await Bun.write(path, '%PDF-1.4\n%%EOF')
      const result = await runAnthropicOcr(path, { ...metadata, format: 'pdf' }, 'claude-sonnet-5-5', { reasoningEffort: 'low' })
      expect(result.pages).toHaveLength(1)
      const call = calls[1]
      expect(call?.headers.get('anthropic-beta')).toBe('files-api-2025-04-14')
      expect(call?.bodyJson?.['output_config']).toMatchObject({ effort: 'low', format: { type: 'json_schema' } })
      expect(call?.bodyJson?.['messages']).toMatchObject([{ content: [{ type: 'text' }, { type: 'document', source: { type: 'file', file_id: 'file_pdf' } }] }])
      expect(calls[2]?.method).toBe('DELETE')
    })
    expect(calls).toHaveLength(3)
  })

  test('oversize OCR images are rejected before dispatch while a base64 image stays within budget', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
    await lifecycle.withDir(async dir => {
      const jpegPath = join(dir, 'oversize.jpg')
      await Bun.write(jpegPath, new Uint8Array(5 * 1024 * 1024 + 1))
      await expect(runAnthropicOcr(jpegPath, { ...metadata, format: 'jpg' }, 'claude-haiku-5-5')).rejects.toThrow('5 MB')
      // Oversized PNGs get one lossless normalization attempt; undecodable bytes still reject locally.
      const pngPath = join(dir, 'oversize.png')
      await Bun.write(pngPath, new Uint8Array(5 * 1024 * 1024 + 1))
      await expect(runAnthropicOcr(pngPath, metadata, 'claude-haiku-5-5')).rejects.toThrow('could not losslessly normalize oversized PNG')
    })
    expect(calls).toHaveLength(0)
    expect(Math.ceil(5 * 1024 * 1024 / 3) * 4).toBeLessThan(10 * 1000 * 1000)
  })

  for (const responseText of ['{"content":"valid"}', '{"unexpected":"invalid"}', 'not json']) {
    test(`write persists and validates decoded artifact ${responseText}`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json({ content: [{ type: 'thinking' }, { type: 'text', text: responseText }], usage: { input_tokens: 40, output_tokens: 20 } }))
      await lifecycle.withDir(async outputDir => {
        const results = await runLlmTargetsForStructuredPrompt({
          prompt: 'Summarize.', outputDir, targets: [{ service: 'anthropic', label: 'Anthropic', model: 'claude-sonnet-5-5', run: runAnthropicModel }],
          structuredSchema, structuredValidationContext: { leafPromptNames: ['content'], presetNames: [] }
        })
        const valid = responseText === '{"content":"valid"}'
        expect(results[0]?.metadata.validationFailed).toBe(!valid)
        const artifact = await Bun.file(join(outputDir, 'text.json')).json()
        expect(artifact).toMatchObject(valid ? { content: 'valid' } : { _raw: responseText, _validationError: expect.any(String) })
        expect(await Bun.file(join(outputDir, 'raw-response-claude-sonnet-5-5-attempt-1.json')).json()).toMatchObject({ result: responseText, metadata: { inputTokenCount: 40, outputTokenCount: 20 } })
        expect(calls).toHaveLength(valid ? 1 : 2)
      })
    })
  }

  for (const stopReason of ['refusal', 'max_tokens', 'pause_turn'] as const) {
    test(`write rejects ${stopReason} with raw response/usage and no billable retry`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const payload = { model: 'claude-opus-5-5', stop_reason: stopReason, content: [{ type: 'text', text: '{"content":"looks valid"}' }], usage: { input_tokens: 7, output_tokens: 4 } }
      const calls = installMockFetch(() => Response.json(payload))
      try {
        await runAnthropicModel('Summarize.', 'claude-opus-5-5', structuredOpts)
        expect.unreachable('Incomplete provider response must fail')
      } catch (error) {
        expect(extractErrorMetadata(error)).toMatchObject({ rawResponse: payload, rawProviderUsage: payload.usage })
      }
      expect(calls).toHaveLength(1)
    })

    test(`OCR ${stopReason} cannot become a successful page and preserves an error artifact`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json({ stop_reason: stopReason, content: [{ type: 'text', text: pageText }], usage: { input_tokens: 7, output_tokens: 4 } }))
      await lifecycle.withDir(async dir => {
        const path = join(dir, 'image.png')
        await Bun.write(path, png)
        try {
          await runAnthropicOcr(path, metadata, 'claude-haiku-5-5')
          expect.unreachable('Incomplete OCR response must fail')
        } catch (error) {
          expect(await writeInvalidOcrStructuredResponse(dir, error)).toBe('invalid-structured-response.txt')
          expect(await Bun.file(join(dir, 'invalid-structured-response.txt')).text()).toBe(pageText)
          expect(extractErrorMetadata(error)).toMatchObject({ stopReason, rawProviderUsage: { input_tokens: 7, output_tokens: 4 } })
        }
      })
      expect(calls).toHaveLength(1)
    })
  }

  for (const raw of ['', '{"pages":[{"pageNumber":0,"text":"bad"}]}', '{"pages":[{"pageNumber":1,"text":42}]}', 'not json']) {
    test(`OCR invalid decoded artifact ${raw || '(empty)'} is reasked and preserved`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json({ content: [{ type: 'thinking' }, { type: 'text', text: raw }] }))
      await lifecycle.withDir(async dir => {
        const path = join(dir, 'image.png')
        await Bun.write(path, png)
        try {
          await runAnthropicOcr(path, metadata, 'claude-sonnet-5-5')
          expect.unreachable('Invalid OCR artifact must fail')
        } catch (error) {
          expect(await writeInvalidOcrStructuredResponse(dir, error)).toBe('invalid-structured-response.txt')
          expect(await Bun.file(join(dir, 'invalid-structured-response.txt')).text()).toBe(raw)
        }
      })
      expect(calls).toHaveLength(3)
    })
  }

  test('a genuinely blank OCR page uses a valid JSON envelope', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'mock-key'
    installMockFetch(() => Response.json({ content: [{ type: 'text', text: '{"pages":[{"pageNumber":1,"text":""}]}' }] }))
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'image.png')
      await Bun.write(path, png)
      expect((await runAnthropicOcr(path, metadata, 'claude-haiku-5-5')).pages).toEqual([{ pageNumber: 1, method: 'ocr', text: '' }])
    })
  })

  test('Haiku write and OCR bill the whole request on either side of 100K, with no unconditional cache discount', () => {
    const write = getLlmCost('anthropic', 'claude-haiku-5-5')
    expect(write).toBeDefined()
    const ocr = getExtractPricing('anthropic', 'claude-haiku-5-5')
    expect(ocr.cachedInputCostPer1MCents).toBe(1)
    for (const input of [0, 99999, 100000, 100001, 900000]) {
      const long = input > 100000
      for (const cost of [computeTokenCost(write!, input, 1000000), computeOcrTokenCost(ocr, 0, 0, input, 1000000)]) {
        expect(cost.inputCostPer1MCents).toBe(long ? 50 : 10)
        expect(cost.outputCostPer1MCents).toBe(long ? 250 : 50)
        expect(cost.totalCost).toBeCloseTo(input / 1000000 * (long ? 50 : 10) + (long ? 250 : 50), 8)
      }
    }
  })
})
