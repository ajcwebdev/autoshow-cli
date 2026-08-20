import { describe, expect, test } from 'bun:test'
import { getRetryPolicyForClass } from '~/utils/retries'
import {
  buildHostedOcrImageResult,
  classifyOcrCreateRetry,
  HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD,
  OCR_CREATE_RETRY_POLICY,
  OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS,
  OCR_PAGE_REQUEST_ATTEMPTS,
  OCR_PAGE_REQUEST_RETRY_POLICY,
  OCR_PAGE_REQUEST_TIMEOUT_MS,
  OCR_REQUEST_TIMEOUT_MS,
  OCR_SCHEMA_RETRY_ATTEMPTS
} from './shared'

describe('OCR resilience contracts', () => {
  test('OCR retry policy and timeout defaults are aggressive and env parsing is strict', () => {
    expect(OCR_REQUEST_TIMEOUT_MS).toBe(60 * 60_000)
    expect(OCR_PAGE_REQUEST_ATTEMPTS).toBe(2)
    expect(OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS).toBe(6)
    expect(OCR_PAGE_REQUEST_TIMEOUT_MS).toBe(5 * 60_000)
    expect(HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD).toBe(20)
    expect(OCR_SCHEMA_RETRY_ATTEMPTS).toBe(3)
    // Both OCR policies are now the shared retriable-create tier rather than private
    // literals with their own ceilings; only the page request's shorter attempt budget
    // (with the 429 extension above) still differs.
    expect(OCR_CREATE_RETRY_POLICY).toEqual(getRetryPolicyForClass('runtime_http_create_retriable'))
    expect(OCR_PAGE_REQUEST_RETRY_POLICY).toEqual({
      ...getRetryPolicyForClass('runtime_http_create_retriable'),
      maxAttempts: 2
    })
    expect(classifyOcrCreateRetry(new DOMException('deadline exceeded', 'TimeoutError')).shouldRetry).toBe(true)

  })

  test('hosted OCR image results allow blank page text', () => {
    expect(buildHostedOcrImageResult(7, ' \n ', {
      promptTokens: 12,
      completionTokens: 0
    })).toEqual({
      page: {
        pageNumber: 7,
        method: 'ocr',
        text: ''
      },
      promptTokens: 12,
      completionTokens: 0
    })
  })
})
