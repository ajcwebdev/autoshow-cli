import { describe, expect, test } from 'bun:test'
import { truncate, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import type { DocumentMetadata, NormalizedReasoningEffort, ResolvedStructuredSchema, StructuredRequestOptions } from '~/types'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { runGeminiModel } from '~/cli/commands/text/write/write-services/write-gemini/run-gemini'
import { runGeminiOcr } from '~/cli/commands/text/ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { normalizeHostedDirectImageInput } from '~/cli/commands/text/ocr/hosted-ocr'
import { collectLlmTargets, runLlmTargetsForStructuredPrompt } from '~/cli/commands/text/write/run-llm'
import { validateGeminiModel } from '~/cli/commands/setup-and-utilities/models/llm-models'
import { validateGeminiOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { resolveCheapestModelForFlag, selectCheapestExtractModel } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getExtractPricing, getLlmCost, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { extractErrorMetadata } from '~/utils/error-handler'
import { expectProviderHttpError, installMockFetch, jsonResponse } from '../../../test-utils/rest-contract-helpers'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { requireDefined } from '../../../test-utils/value-assertions'
import { setupGeminiRestContractFixture } from './gemini-rest-contract-fixture'
import { pngSignature } from '../../../test-utils/media-fixtures'

const { withTempDir } = setupGeminiRestContractFixture()
const model = 'gemini-4-argon'
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-argon:generateContent'
// Independent expectations: the Argon card, migration guide, pricing page and GenerateContent
// reference were checked on 2026-10-17, rather than inferred from the implementation.
// https://ai.google.dev/gemini-api/docs/models/gemini-4-argon
// https://ai.google.dev/gemini-api/docs/latest-model
// https://ai.google.dev/api/generate-content
// https://ai.google.dev/gemini-api/docs/pricing
const response = (text: string, finishReason = 'STOP') => ({
  modelVersion: model,
  candidates: [{ finishReason, content: { parts: [{ thought: true, text: 'Private reasoning' }, { text }] } }],
  usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 8, thoughtsTokenCount: 12 }
})
const schema: ResolvedStructuredSchema = {
  schemaName: 'content',
  leafPromptNames: ['content'],
  presetNames: [],
  schema: v.object({ content: v.string() }),
  jsonSchema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'], additionalProperties: false }
}
const requestOptions = (effort: NormalizedReasoningEffort | undefined): StructuredRequestOptions => ({
  schemaName: schema.schemaName,
  schema: schema.jsonSchema,
  strict: true,
  strategy: 'native',
  requestedReasoningEffort: effort
})

describe('Gemini 4 Argon synchronous write and OCR contracts', () => {
  test('selectable addition retains existing defaults and documents the unified synchronous limits', () => {
    expect(() => validateGeminiModel(model)).not.toThrow()
    expect(() => validateGeminiOcrModel(model)).not.toThrow()
    expect(resolveCheapestModelForFlag('gemini')).toBe('gemini-3.8-flash')
    expect(selectCheapestExtractModel('gemini')).toBe('gemini-3.5-flash-lite')
    const registry = getModelRegistry()
    for (const entry of [registry.llm['gemini']?.models[model], registry.extract['gemini']?.models[model]]) {
      expect(entry?.limits).toMatchObject({ contextTokens: 1_048_576, maxOutputTokens: 65_536 })
      expect(entry?.limits?.notes).toContain('thinking')
      expect(entry?.pricingCheckedAt).toBe('2026-10-17')
      expect(entry?.pricingNotes).toContain('2026-11-30')
      expect(entry?.pricingNotes).toContain('2026-12-01')
      expect(entry?.pricingNotes).toContain('overstate')
    }
    expect(registry.extract['gemini']?.models[model]?.limits).toMatchObject({ pdfBytes: 52_428_800, pageCount: 1000 })
    expect(registry.stt['gemini-stt']?.models[model]).toBeUndefined()
  })

  test('native token estimates use conservative standard rates at every context size', () => {
    const write = requireDefined(getLlmCost('gemini', model), 'Argon write rates')
    const extract = requireDefined(getExtractPricing('gemini', model), 'Argon OCR rates')
    const ocr = {
      ...extract,
      inputCostPer1MCents: requireDefined(extract.inputCostPer1MCents, 'OCR input rate'),
      outputCostPer1MCents: requireDefined(extract.outputCostPer1MCents, 'OCR output rate')
    }
    for (const inputTokens of [0, 200_000, 200_001, 1_000_000]) {
      for (const pricing of [write, ocr]) {
        const cost = computeTokenCost(pricing, inputTokens, 1_000_000)
        expect(cost).toMatchObject({ inputCostPer1MCents: 400, outputCostPer1MCents: 2000 })
        expect(cost.totalCost).toBe(inputTokens * 400 / 1_000_000 + 2000)
      }
    }
  })

  for (const effort of [undefined, 'low', 'medium', 'high', 'default'] as const) {
    test(`write dispatch serializes ${effort ?? 'omitted'} reasoning and decodes answer text without thought content`, async () => {
      process.env['GEMINI_API_KEY'] = 'test-key'
      const calls = installMockFetch(() => jsonResponse(response('{"content":"A repaired bicycle."}')))
      const result = await runGeminiModel('Summarize the workshop.', model, requestOptions(effort))
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe(endpoint)
      expect(calls[0]?.method).toBe('POST')
      expect(calls[0]?.headers.get('x-goog-api-key')).toBe('test-key')
      expect(calls[0]?.bodyJson?.['generationConfig']).toEqual({
        maxOutputTokens: 65_536,
        responseMimeType: 'application/json',
        responseJsonSchema: schema.jsonSchema,
        ...(effort && effort !== 'default' ? { thinkingConfig: { thinkingLevel: effort.toUpperCase() } } : {})
      })
      expect(result.result).toBe('{"content":"A repaired bicycle."}')
      expect(result.metadata.requestedReasoningEffort).toBe(effort)
      expect(result.metadata).toMatchObject({ effectiveReasoningEffort: effort ?? 'default', inputTokenCount: 20, outputTokenCount: 20 })
      expect(calls[0]?.bodyJson).not.toHaveProperty('background')
      expect(calls[0]?.bodyJson).not.toHaveProperty('continuationToken')
    })
  }

  for (const format of ['png', 'pdf'] as const) {
    for (const effort of [undefined, 'low', 'medium', 'high', 'default'] as const) {
      test(`OCR ${format} dispatch serializes ${effort ?? 'omitted'} reasoning with JSON schema and the Argon output budget`, async () => {
        process.env['GEMINI_API_KEY'] = 'test-key'
        await withTempDir(async dir => {
          const path = join(dir, `page.${format}`)
          await writeFile(path, new Uint8Array([1, 2, 3]))
          const calls = installMockFetch(() => jsonResponse(response('{"pages":[{"pageNumber":1,"text":"A repaired bicycle."}]}')))
          const result = await runGeminiOcr(path, { slug: 'page', pageCount: 1, format, fileSize: 3 }, model, { reasoningEffort: effort })
          expect(calls).toHaveLength(1)
          expect(calls[0]?.url).toBe(endpoint)
          expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({ responseMimeType: 'application/json', responseJsonSchema: { type: 'object' }, maxOutputTokens: 32_768 })
          const config = calls[0]?.bodyJson?.['generationConfig'] as Record<string, unknown>
          expect(config['thinkingConfig']).toEqual(effort && effort !== 'default' ? { thinkingLevel: effort.toUpperCase() } : undefined)
          expect(calls[0]?.bodyJson?.['contents']).toMatchObject([{ role: 'user', parts: [{ text: expect.any(String) }, { inlineData: { mimeType: format === 'pdf' ? 'application/pdf' : 'image/png', data: 'AQID' } }] }])
          expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'A repaired bicycle.' }])
          expect(result).toMatchObject({ promptTokens: 20, completionTokens: 20, effectiveReasoningEffort: effort ?? 'default' })
        })
      })
    }
  }

  test('multi-page OCR uses a 65,536 output cap and validates the requested page sequence', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key'
    await withTempDir(async dir => {
      const path = join(dir, 'pages.pdf')
      await writeFile(path, '%PDF')
      const calls = installMockFetch(() => jsonResponse(response(JSON.stringify({ pages: [1, 2, 3].map(pageNumber => ({ pageNumber, text: `Page ${pageNumber}` })) }))))
      const result = await runGeminiOcr(path, { slug: 'pages', pageCount: 3, format: 'pdf', fileSize: 4 }, model)
      expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({ maxOutputTokens: 65_536 })
      expect(result.pages.map(page => page.pageNumber)).toEqual([1, 2, 3])
    })
  })

  test('unsupported reasoning and generation controls reject before network dispatch', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key'
    const calls = installMockFetch(() => jsonResponse({}))
    for (const effort of ['minimal', 'disabled', 'xhigh', 'max'] as const) {
      for (const step of ['llm', 'extract'] as const) {
        expect(() => resolveReasoningPolicy({ step, service: 'gemini', model, requestedReasoningEffort: effort })).toThrow()
      }
      await expect(runGeminiModel('Synthetic prompt', model, requestOptions(effort))).rejects.toThrow()
      await expect(runGeminiOcr('unread-input.pdf', { slug: 'test', pageCount: 1, format: 'pdf', fileSize: 0 }, model, { reasoningEffort: effort })).rejects.toThrow()
    }
    for (const generationConfig of [
      ...['temperature', 'topP', 'topK', 'top_p', 'top_k'].map(key => ({ [key]: 1 })),
      { thinkingConfig: { thinkingBudget: 0 } },
      { thinkingConfig: { thinkingLevel: 'MINIMAL' } },
      ...[0, -1, 65_537, 1_048_576, 1.5, '65536'].map(maxOutputTokens => ({ maxOutputTokens }))
    ]) {
      await expect(geminiGenerateContent('test-key', { model, contents: 'Synthetic prompt', generationConfig })).rejects.toThrow(model)
    }
    expect(calls).toHaveLength(0)
  })

  test('BMP input is normalized to a decoded PNG artifact before the Argon image request', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key'
    await withTempDir(async dir => {
      const path = join(dir, 'page.bmp')
      await writeFile(path, new Uint8Array([
        0x42, 0x4d, 0x3a, 0, 0, 0, 0, 0, 0, 0, 0x36, 0, 0, 0,
        0x28, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0x18, 0,
        0, 0, 0, 0, 4, 0, 0, 0, 0x13, 0x0b, 0, 0, 0x13, 0x0b,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 0xff, 0
      ]))
      const calls = installMockFetch(() => jsonResponse(response('{"pages":[{"pageNumber":1,"text":""}]}')))
      await expect(runGeminiOcr(path, { slug: 'page', format: 'bmp', pageCount: 1, fileSize: 58 }, model)).rejects.toThrow('normalized to PNG')
      expect(calls).toHaveLength(0)
      const normalized = await normalizeHostedDirectImageInput(path, 'gemini-ocr', dir, 'normalized')
      const bytes = new Uint8Array(await Bun.file(normalized.filePath).arrayBuffer())
      expect(bytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
      expect(await new Bun.Image(bytes).metadata()).toMatchObject({ width: 1, height: 1 })
      await runGeminiOcr(normalized.filePath, { slug: 'page', format: normalized.format, pageCount: 1, fileSize: bytes.length }, model)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.bodyJson?.['contents']).toMatchObject([{ parts: [{ text: expect.any(String) }, { inlineData: { mimeType: 'image/png', data: Buffer.from(bytes).toString('base64') } }] }])
    })
  })

  test('oversized PDF and excessive page count fail before uploading or generating', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key'
    await withTempDir(async dir => {
      const path = join(dir, 'oversized.pdf')
      await writeFile(path, '%PDF')
      const calls = installMockFetch(() => jsonResponse({}))
      const metadata: DocumentMetadata = { slug: 'oversized', format: 'pdf', pageCount: 1001, fileSize: 4 }
      await expect(runGeminiOcr(path, metadata, model)).rejects.toThrow('50 MB or 1000 page')
      await truncate(path, 52_428_801)
      await expect(runGeminiOcr(path, { ...metadata, pageCount: 1 }, model)).rejects.toThrow('50 MB or 1000 page')
      expect(calls).toHaveLength(0)
    })
  })

  for (const artifact of ['missing-candidates', 'thought-only', 'MAX_TOKENS', 'CONTINUATION'] as const) {
    test(`HTTP success with ${artifact} is rejected without retry or automatic continuation`, async () => {
      process.env['GEMINI_API_KEY'] = 'test-key'
      const payload = artifact === 'missing-candidates'
        ? { usageMetadata: { promptTokenCount: 20 } }
        : artifact === 'thought-only'
          ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'Private reasoning' }] } }] }
          : response('{"content":"Truncated output"}', artifact)
      const calls = installMockFetch(() => jsonResponse(payload))
      const error = await expectProviderHttpError(() => runGeminiModel('Synthetic prompt', model, requestOptions(undefined)), { messageContains: 'incomplete or unusable synchronous response' })
      expect(extractErrorMetadata(error)['rawResponse']).toMatchObject(payload)
      expect(calls).toHaveLength(1)
    })
  }

  for (const valid of [true, false]) {
    test(`writing persists ${valid ? 'valid structured content' : 'invalid artifact evidence with a validation failure'}`, async () => {
      process.env['GEMINI_API_KEY'] = 'test-key'
      await withTempDir(async outputDir => {
        const raw = valid ? '{"content":"A repaired bicycle."}' : '{"unexpected":"Wrong schema"}'
        const calls = installMockFetch(() => jsonResponse(response(raw)))
        const { result } = await captureLogEvents(async () => await runLlmTargetsForStructuredPrompt({ prompt: 'Summarize.', outputDir, targets: collectLlmTargets({ outputDir, geminiModels: [model] }), structuredSchema: schema, structuredValidationContext: { leafPromptNames: ['content'], presetNames: [] } }))
        expect(result[0]?.metadata.validationFailed).toBe(!valid)
        expect(await Bun.file(join(outputDir, 'text.json')).json()).toEqual(valid ? { content: 'A repaired bicycle.' } : { _raw: raw, _validationError: expect.any(String) })
        expect(calls.every(call => call.url === endpoint)).toBe(true)
      })
    })
  }

  test('OCR schema recovery preserves malformed-response token usage before returning validated pages', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key'
    await withTempDir(async dir => {
      const path = join(dir, 'page.png')
      await writeFile(path, new Uint8Array([1, 2, 3]))
      let attempts = 0
      const calls = installMockFetch(() => jsonResponse(response(++attempts === 1 ? '{"pages":[]}' : '{"pages":[{"pageNumber":1,"text":"Recovered page"}]}')))
      const { result } = await captureLogEvents(async () => await runGeminiOcr(path, { slug: 'page', format: 'png', pageCount: 1, fileSize: 3 }, model))
      expect(calls).toHaveLength(2)
      expect(result.pages[0]?.text).toBe('Recovered page')
      expect(result).toMatchObject({ promptTokens: 40, completionTokens: 40 })
      expect(result.providerUsage?.map(entry => entry['usageRole'])).toEqual(['schema-retry', 'success'])
    })
  })

  test('OCR rejects persistently invalid page artifacts after the bounded schema retry budget', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key'
    await withTempDir(async dir => {
      const path = join(dir, 'page.png')
      await writeFile(path, new Uint8Array([1, 2, 3]))
      const calls = installMockFetch(() => jsonResponse(response('{"pages":[{"pageNumber":2,"text":"Wrong page"}]}')))
      await captureLogEvents(async () => await expect(runGeminiOcr(path, { slug: 'page', format: 'png', pageCount: 1, fileSize: 3 }, model)).rejects.toThrow())
      expect(calls).toHaveLength(3)
    })
  })
})
