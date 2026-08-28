import { describe,expect,test } from 'bun:test'
import { runGeminiOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { installMockFetch } from '../../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { basePdfMetadata,join,jsonResponse,rm } from './shared'

describe('OCR resilience contracts', () => {

  test('Gemini single-page image OCR uses lower output cap and records schema retry diagnostics with document page context', async () => {
    const previousFetch = globalThis.fetch
    const previousEnv = {
      GEMINI_API_KEY: process.env['GEMINI_API_KEY']
    }
    const tempDir = await makeTempDir('autoshow-gemini-single-page-cap-')
    const inputPath = join(tempDir, 'input.png')

    try {
      await Bun.write(inputPath, new Uint8Array([137, 80, 78, 71]))
      process.env['GEMINI_API_KEY'] = 'test-key'
      const requests = installMockFetch((_call) => {
        if (requests.length === 1) {
          return jsonResponse({
            candidates: [{
              content: { parts: [{ text: 'not json' }] }
            }],
            usageMetadata: {
              promptTokenCount: 7,
              candidatesTokenCount: 8_000
            }
          })
        }
        return jsonResponse({
          candidates: [{
            content: { parts: [{ text: '{"pages":[{"pageNumber":1,"text":"fixed page"}]}' }] }
          }],
          usageMetadata: {
            promptTokenCount: 4,
            candidatesTokenCount: 5
          }
        })
      })

      const result = await runGeminiOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: 1,
        format: 'png',
        fileSize: 4
      }, 'gemini-3.5-flash-lite', {
        documentPageNumber: 7
      })

      expect(requests).toHaveLength(2)
      expect((requests[0]?.bodyJson?.['generationConfig'] as Record<string, unknown>)['maxOutputTokens']).toBe(8_192)
      expect((requests[1]?.bodyJson?.['generationConfig'] as Record<string, unknown>)['maxOutputTokens']).toBe(8_192)
      const retryContents = requests[1]?.bodyJson?.['contents'] as Array<Record<string, unknown>>
      const retryParts = retryContents[0]?.['parts'] as Array<Record<string, unknown>>
      expect(retryParts[0]?.['text']).toContain('Return only valid JSON for this single OCR page.')

      expect(result.pages[0]?.text).toBe('fixed page')
      expect(result.providerUsage?.[0]).toMatchObject({
        provider: 'gemini',
        usageRole: 'schema-retry',
        purpose: 'ocr-schema-retry',
        pageNumber: 7,
        pageCount: 1,
        attempt: 1,
        promptTokens: 7,
        completionTokens: 8_000,
        failureReason: expect.any(String)
      })
      expect(result.providerUsage?.[1]).toMatchObject({
        provider: 'gemini',
        usageRole: 'success',
        attempt: 2,
        promptTokens: 4,
        completionTokens: 5
      })
    } finally {
      globalThis.fetch = previousFetch
      if (previousEnv.GEMINI_API_KEY === undefined) {
        delete process.env['GEMINI_API_KEY']
      } else {
        process.env['GEMINI_API_KEY'] = previousEnv.GEMINI_API_KEY
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('Gemini direct single-page PDF keeps the higher direct-PDF output cap', async () => {
    const previousFetch = globalThis.fetch
    const previousEnv = {
      GEMINI_API_KEY: process.env['GEMINI_API_KEY']
    }
    const tempDir = await makeTempDir('autoshow-gemini-direct-pdf-cap-')
    const inputPath = join(tempDir, 'input.pdf')

    try {
      await Bun.write(inputPath, '%PDF-1.7 test placeholder')
      process.env['GEMINI_API_KEY'] = 'test-key'
      const requests = installMockFetch(() => {
        return jsonResponse({
          candidates: [{
            content: { parts: [{ text: '{"pages":[{"pageNumber":1,"text":"pdf page"}]}' }] }
          }],
          usageMetadata: {
            promptTokenCount: 3,
            candidatesTokenCount: 4
          }
        })
      })

      const result = await runGeminiOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: 1,
        format: 'pdf',
        fileSize: 24
      }, 'gemini-3.5-flash-lite')

      expect((requests[0]?.bodyJson?.['generationConfig'] as Record<string, unknown>)['maxOutputTokens']).toBe(24_576)
      expect(result.pages[0]?.text).toBe('pdf page')
    } finally {
      globalThis.fetch = previousFetch
      if (previousEnv.GEMINI_API_KEY === undefined) {
        delete process.env['GEMINI_API_KEY']
      } else {
        process.env['GEMINI_API_KEY'] = previousEnv.GEMINI_API_KEY
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
