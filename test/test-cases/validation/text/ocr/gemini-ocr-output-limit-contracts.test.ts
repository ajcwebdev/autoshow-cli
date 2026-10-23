import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runGeminiOcr } from '~/cli/commands/text/ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { OcrOutputLimitError } from '~/cli/commands/text/ocr/ocr-structured-response-error'
import { extractErrorMetadata } from '~/utils/error-handler'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { basePdfMetadata } from './ocr-resilience-contracts/shared'

// Native enum/endpoint expectations are independent of the adapter implementation:
// https://ai.google.dev/api/generate-content#FinishReason (checked 2026-10-23)
// STOP means a natural stop; MAX_TOKENS means the request's token limit was reached.
// These mocked contracts establish dispatch and completion classification, not OCR
// recognition accuracy on real images.
const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['GEMINI_API_KEY'], tempPrefix: 'autoshow-gemini-ocr-output-limit-'
})
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const models = [
  { model: 'gemini-3.5-flash-lite', nativeCap: 8_192 },
  { model: 'gemini-3.8-flash', nativeCap: 8_192 },
  { model: 'gemini-4-argon', nativeCap: 32_768 }
]

const input = async () => {
  process.env['GEMINI_API_KEY'] = 'test-key'
  const path = join(await tempDirs.make(), 'input.png')
  await Bun.write(path, png)
  return path
}
const metadata = { ...basePdfMetadata, pageCount: 1, format: 'png' as const, fileSize: png.length }

describe('Gemini OCR native output completeness without provider calls', () => {
  for (const { model, nativeCap } of models) {
    test(`${model} STOP decodes valid page JSON through the documented endpoint and leaves native output controls unchanged`, async () => {
      const path = await input()
      const calls = installMockFetch(() => jsonResponse({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"pages":[{"pageNumber":1,"text":"complete fixture page"}]}' }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, thoughtsTokenCount: 2 }
      }))
      const result = await runGeminiOcr(path, metadata, model)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)
      expect(calls[0]?.method).toBe('POST')
      expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({ responseMimeType: 'application/json', maxOutputTokens: nativeCap })
      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'complete fixture page' }])
      expect(result.promptTokens).toBe(12)
      expect(result.completionTokens).toBe(10)
      expect(result.providerUsage).toHaveLength(1)
      expect(result.providerUsage?.[0]?.['usageRole']).toBe('success')
    })

    for (const [shape, partial] of [
      ['syntactically valid partial-page JSON', '{"pages":[{"pageNumber":1,"text":"only the first article"}]}'],
      ['malformed partial JSON', '{"pages":[{"pageNumber":1,"text":"only the first article'],
      ['empty partial output', '']
    ] as const) {
      test(`${model} MAX_TOKENS rejects ${shape} once, retains native usage/response evidence and never buys a schema re-ask`, async () => {
        const path = await input()
        const usage = { promptTokenCount: 13, candidatesTokenCount: nativeCap, thoughtsTokenCount: 0 }
        const calls = installMockFetch(() => jsonResponse({
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: partial }] } }],
          usageMetadata: usage
        }))
        let failure: unknown
        try { await runGeminiOcr(path, metadata, model) } catch (error) { failure = error }
        expect(failure).toBeInstanceOf(OcrOutputLimitError)
        expect(calls).toHaveLength(1)
        expect(calls[0]?.url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)
        expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({ maxOutputTokens: nativeCap })
        expect((failure as OcrOutputLimitError).rawResponse).toBe(partial)
        const evidence = extractErrorMetadata(failure)
        expect(evidence['finishReason']).toBe('MAX_TOKENS')
        expect(evidence['rawProviderUsage']).toEqual(usage)
        expect(evidence['rawResponse']).toMatchObject({
          candidates: [{ finishReason: 'MAX_TOKENS' }], usageMetadata: usage, text: partial
        })
      })
    }
  }
})
