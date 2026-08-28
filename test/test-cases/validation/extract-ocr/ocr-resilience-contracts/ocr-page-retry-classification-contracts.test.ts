import { describe,expect,test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import { classifyOcrCreateRetry,classifyOcrProviderFailure,OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS,OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS,OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS,OcrStructuredResponseError,withOcrPageRequestRetry } from './shared'

describe('OCR resilience contracts', () => {
  test('DeepInfra page OCR uses bounded request retries and timeout classification keeps page context', async () => {
    let attempts = 0
    await expect(withOcrPageRequestRetry(
      'deepinfra-ocr page 7',
      async () => {
        attempts += 1
        throw new OcrStructuredResponseError('DeepInfra OCR returned no text output.', '')
      },
      {
        attempts: 2,
        timeoutMs: 1000,
        classifier: () => ({ shouldRetry: true, delayMs: 1, reason: 'structured_response' })
      }
    )).rejects.toThrow('deepinfra-ocr page 7 failed after 2/2 attempts')
    expect(attempts).toBe(2)

    const timeoutCause = new Error('The operation was aborted due to timeout')
    timeoutCause.name = 'AbortError'
    const timeoutError = new Error('deepinfra-ocr page 7 failed after 2 attempts (600000ms elapsed)', {
      cause: timeoutCause
    })
    const failure = classifyOcrProviderFailure(timeoutError)
    expect(failure.category).toBe('timeout')
    expect(failure.message).toContain('deepinfra-ocr page 7')
    expect(failure.message).toContain('timeout')
  })

  test('page request retry delays no-header 429s for the hosted OCR cooldown window', async () => {
    const previousSleep = Bun.sleep
    const pressures: Array<{ reason: string, delayMs?: number | undefined, status?: number | undefined, retryAfterMs?: number | undefined }> = []
    const sleeps: number[] = []
    let attempts = 0

    try {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (delayMs: number) => {
        sleeps.push(delayMs)
      }) as typeof Bun.sleep
      await expect(withOcrPageRequestRetry(
        'kimi-ocr page 3',
        async () => {
          attempts += 1
          throw ProviderError('rate limited', { status: 429 })
        },
        {
          attempts: 2,
          timeoutMs: 1000,
          onRetryable: pressure => {
            pressures.push(pressure)
          }
        }
      )).rejects.toThrow('kimi-ocr page 3 failed after 2/2 attempts')
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(attempts).toBe(2)
    expect(sleeps).toHaveLength(1)
    expect(sleeps[0]).toBeGreaterThanOrEqual(OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS)
    expect(sleeps[0]).toBeLessThanOrEqual(OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS)
    expect(pressures).toHaveLength(1)
    expect(pressures[0]).toMatchObject({
      reason: 'retryable status 429',
      status: 429
    })
    expect(pressures[0]?.delayMs).toBeGreaterThanOrEqual(OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS)
    expect(pressures[0]?.delayMs).toBeLessThanOrEqual(OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS)
    expect(pressures[0]?.retryAfterMs).toBeUndefined()
  })

  test('page request retry uses the extended default attempt budget for 429s', async () => {
    const previousSleep = Bun.sleep
    let attempts = 0

    try {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
      await expect(withOcrPageRequestRetry(
        'kimi-ocr page 9',
        async () => {
          attempts += 1
          throw ProviderError('rate limited', { status: 429 })
        },
        { timeoutMs: 1000 }
      )).rejects.toThrow(`kimi-ocr page 9 failed after ${OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS}/${OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS} attempts`)
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(attempts).toBe(OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS)
  })

  test('Kimi insufficient-balance 429 is a non-retryable quota blocker', async () => {
    const previousSleep = Bun.sleep
    let attempts = 0
    const error = ProviderError('Kimi OCR request failed (429): insufficient account balance for account acct_live_secret1234', { status: 429, metadata: { rawResponse: {
        error: {
          message: 'insufficient account balance for account acct_live_secret1234',
          request_id: 'req_secret123456789'
        }
      } } })

    try {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {
        throw new Error('non-retryable Kimi quota failures should not sleep')
      }) as typeof Bun.sleep

      await expect(withOcrPageRequestRetry(
        'kimi-ocr page 3',
        async () => {
          attempts += 1
          throw error
        },
        { timeoutMs: 1000 }
      )).rejects.toThrow('insufficient account balance')
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(attempts).toBe(1)
    const failure = classifyOcrProviderFailure(error)
    expect(failure).toMatchObject({
      category: 'rate_limit',
      failureKind: 'quota',
      retryable: false,
      quota: true,
      providerWide: true,
      blockedReason: 'insufficient_balance'
    })
    expect(failure.message).not.toContain('acct_live_secret1234')
  })

  test('Anthropic content-policy and no-retry responses are non-retryable blockers', () => {
    const policyError = ProviderError('Anthropic Messages request failed (400): Output blocked by content filtering policy', { status: 400, metadata: { errorType: 'invalid_request_error', rawResponse: {
        error: {
          type: 'invalid_request_error',
          message: 'Output blocked by content filtering policy'
        }
      } } })
    const noRetryError = ProviderError('Anthropic Messages request failed (429): provider says do not retry', { status: 429, headers: new Headers({ 'x-should-retry': 'false' }) })

    expect(classifyOcrCreateRetry(policyError)).toMatchObject({
      shouldRetry: false,
      reason: 'content_policy'
    })
    expect(classifyOcrProviderFailure(policyError)).toMatchObject({
      category: 'content_policy',
      failureKind: 'content_policy',
      retryable: false,
      providerWide: true
    })
    expect(classifyOcrCreateRetry(noRetryError)).toMatchObject({
      shouldRetry: false,
      reason: 'provider_no_retry_header'
    })
    expect(classifyOcrProviderFailure(noRetryError)).toMatchObject({
      failureKind: 'provider_no_retry',
      retryable: false,
      providerWide: true
    })
  })

  test('transient OCR retry classification remains retryable', () => {
    expect(classifyOcrCreateRetry(ProviderError('try later', { status: 429 }))).toMatchObject({
      shouldRetry: true,
      reason: 'retryable status 429'
    })
    expect(classifyOcrCreateRetry(ProviderError('upstream unavailable', { status: 503 }))).toMatchObject({
      shouldRetry: true,
      reason: 'retryable status 503'
    })
    expect(classifyOcrCreateRetry(new TypeError('fetch failed'))).toMatchObject({
      shouldRetry: true,
      reason: 'network error'
    })
  })

  test('page request retry telemetry reports retryable status and retry-after pressure', async () => {
    const previousSleep = Bun.sleep
    const pressures: Array<{ reason: string, delayMs?: number | undefined, status?: number | undefined, retryAfterMs?: number | undefined }> = []
    const sleeps: number[] = []
    let attempts = 0

    try {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (delayMs: number) => {
        sleeps.push(delayMs)
      }) as typeof Bun.sleep
      await expect(withOcrPageRequestRetry(
        'kimi-ocr page 3',
        async () => {
          attempts += 1
          throw ProviderError('rate limited', { status: 429, headers: new Headers({ 'retry-after': '2' }) })
        },
        {
          attempts: 2,
          timeoutMs: 1000,
          classifier: () => ({ shouldRetry: true, delayMs: 1, reason: 'retryable status 429' }),
          onRetryable: pressure => {
            pressures.push(pressure)
          }
        }
      )).rejects.toThrow('kimi-ocr page 3 failed after 2/2 attempts')
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(attempts).toBe(2)
    expect(sleeps).toEqual([2_000])
    expect(pressures).toHaveLength(1)
    expect(pressures[0]).toMatchObject({
      reason: 'retryable status 429',
      delayMs: 2_000,
      status: 429,
      retryAfterMs: 2_000
    })
  })
})
