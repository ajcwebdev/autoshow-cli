import { describe,expect,test } from 'bun:test'
import { classifyTtsProviderAdmissionError } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/tts-request-evidence'
import { AppError,ProviderError } from '~/utils/error-handler'
import { classifyFetchRetry,classifyPaidCreateRetry } from '~/utils/retries'

describe('retry error contracts', () => {
  test('TTS admission distinguishes definite client rejection from ambiguous outcomes through wrapped causes', () => {
    const wrappedBadRequest = new AppError('target failed', {
      kind: 'infrastructure',
      cause: ProviderError('invalid voice', { status: 400, headers: new Headers({ 'x-request-id': 'req-400' }) })
    })
    const statuses = [408, 409, 500, 502, 503]

    expect(classifyTtsProviderAdmissionError(wrappedBadRequest)).toBe('rejected')
    for (const status of statuses) {
      expect(classifyTtsProviderAdmissionError(ProviderError('uncertain create', { status }))).toBe('ambiguous')
    }
    expect(classifyTtsProviderAdmissionError(new TypeError('fetch failed'))).toBe('ambiguous')
    expect(classifyTtsProviderAdmissionError(new DOMException('timed out', 'TimeoutError'))).toBe('ambiguous')
  })

  test('paid creates retry only explicit provider rejections that cannot have admitted work', () => {
    expect(classifyPaidCreateRetry(ProviderError('rate limited', {
      status: 429,
      headers: new Headers({ 'retry-after': '2' })
    }))).toEqual({ shouldRetry: true, delayMs: 2_000, reason: 'provider rejected paid create with retryable status 429' })
    expect(classifyPaidCreateRetry(ProviderError('unavailable', { status: 503 }))).toMatchObject({ shouldRetry: false })
    expect(classifyPaidCreateRetry(new TypeError('fetch failed'))).toMatchObject({ shouldRetry: false })
    expect(classifyPaidCreateRetry(new DOMException('timed out', 'TimeoutError'))).toMatchObject({ shouldRetry: false })
  })

  test('classifyFetchRetry treats Bun TimeoutError DOMExceptions as retryable', () => {
    const decision = classifyFetchRetry(
      new DOMException('The operation timed out.', 'TimeoutError'),
      'runtime_http_read'
    )

    expect(decision).toMatchObject({
      shouldRetry: true,
      reason: 'abort/timeout'
    })
  })

  test('classifyFetchRetry keeps every ambiguous conservative-create failure separate from retriable creates', () => {
    expect(classifyFetchRetry(
      new DOMException('The operation timed out.', 'TimeoutError'),
      'runtime_http_create_conservative'
    )).toMatchObject({
      shouldRetry: false,
      reason: 'paid create outcome is ambiguous'
    })

    expect(classifyFetchRetry(
      new TypeError('fetch failed'),
      'runtime_http_create_conservative'
    )).toMatchObject({ shouldRetry: false })

    expect(classifyFetchRetry(
      ProviderError('provider unavailable', { status: 503 }),
      'runtime_http_create_conservative'
    )).toMatchObject({ shouldRetry: false })

    expect(classifyFetchRetry(
      new DOMException('The operation timed out.', 'TimeoutError'),
      'runtime_http_create_retriable'
    )).toMatchObject({
      shouldRetry: true,
      reason: 'abort/timeout'
    })

    expect(classifyFetchRetry(
      new Error('Socket connection was closed unexpectedly'),
      'runtime_http_create_retriable'
    )).toMatchObject({
      shouldRetry: true,
      reason: 'network error'
    })
  })
})
