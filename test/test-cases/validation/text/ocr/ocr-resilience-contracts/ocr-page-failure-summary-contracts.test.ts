import { describe,expect,test } from 'bun:test'
import { AppError,ProviderError } from '~/utils/error-handler'
import { classifyFetchRetry,withRetry } from '~/utils/retries'
import { classifyOcrProviderFailure } from './shared'

describe('OCR resilience contracts', () => {

  test('retry-exhausted OCR failures surface attemptsMade in the provider failure summary', async () => {
    const previousSleep = Bun.sleep
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    let exhausted: unknown
    try {
      await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'deepinfra-ocr page 3',
          policy: { maxAttempts: 6, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false }
        },
        async () => {
          throw ProviderError('DeepInfra OCR request rejected (429)', { status: 429 })
        },
        (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
      )
    } catch (error) {
      exhausted = error
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(exhausted).toBeInstanceOf(AppError)
    expect((exhausted as AppError).message).toMatch(/^deepinfra-ocr page 3 failed after 6\/6 attempts \(max attempts reached, \d+ms elapsed\): DeepInfra OCR request rejected \(429\)/)

    const failure = classifyOcrProviderFailure(exhausted)
    expect(failure.attemptsMade).toBe(6)
    expect(failure.retryable).toBe(true)
    expect(failure.status).toBe(429)
  })
})
