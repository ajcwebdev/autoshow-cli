import { describe, expect, test } from 'bun:test'
import { normalizeHostedOcrPages } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-json'
import { parseStoredHostedOcrPageCache } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback-state'
import { hostedRun } from './shared'

describe('PDF page cache and normalization contracts', () => {
  test('hosted page response cache identity includes provider mode, input, DPI, model, and reasoning policy', () => {
    const identity = {
      extractionMethod: 'openai-ocr' as const,
      ocrService: 'openai' as const,
      ocrModel: 'gpt-5.6-sol',
      requestedReasoningEffort: 'high' as const,
      effectiveReasoningEffort: 'high' as const,
      ocrProviderMode: 'pool' as const,
      inputSha256: 'abc123',
      inputFormat: 'pdf',
      inputPageNumber: 7,
      dpi: 300
    }
    const run = {
      ...hostedRun([{ pageNumber: 7, method: 'ocr', text: 'page 7' }]),
      ...identity
    }
    const stored = {
      version: 2,
      mode: 'single-page',
      totalPages: 10,
      pageNumber: 7,
      sourceFile: 'page-000007.pdf',
      run
    }

    expect(parseStoredHostedOcrPageCache(stored, {
      pageNumber: 7,
      totalPages: 10,
      sourceFile: 'page-000007.pdf',
      identity
    })?.run.pages[0]?.text).toBe('page 7')
    expect(parseStoredHostedOcrPageCache(stored, { identity: { ...identity, ocrProviderMode: 'fanout' } })).toBeUndefined()
    expect(parseStoredHostedOcrPageCache(stored, { identity: { ...identity, inputSha256: 'different' } })).toBeUndefined()
    expect(parseStoredHostedOcrPageCache(stored, { identity: { ...identity, effectiveReasoningEffort: 'low' } })).toBeUndefined()
    expect(parseStoredHostedOcrPageCache(stored, { identity: { ...identity, dpi: 200 } })).toBeUndefined()
  })

  test('hosted OCR page normalization decodes escaped line formatting artifacts', () => {
    const pages = normalizeHostedOcrPages([{
      pageNumber: 1,
      text: 'Page 115\\n\\nCHAPTER\\nVII\\nTHE LONG SHADOW OF ROME\\n\\tFirst paragraph'
    }], 1, {
      countMismatchMessage: (actual, expected) => `got ${actual}, wanted ${expected}`,
      nonContiguousMessage: 'non-contiguous'
    })

    expect(pages[0]?.text).toContain('CHAPTER\nVII\nTHE LONG SHADOW OF ROME')
    expect(pages[0]?.text).toContain('\tFirst paragraph')
  })

  test('hosted OCR page normalization leaves isolated literal slash-n text alone', () => {
    const pages = normalizeHostedOcrPages([{
      pageNumber: 1,
      text: 'Windows path C:\\new-folder stays literal'
    }], 1, {
      countMismatchMessage: (actual, expected) => `got ${actual}, wanted ${expected}`,
      nonContiguousMessage: 'non-contiguous'
    })

    expect(pages[0]?.text).toBe('Windows path C:\\new-folder stays literal')
  })
})
