import { describe,expect,test } from 'bun:test'
import { AppError,ProviderError } from '~/utils/error-handler'
import { classifyFetchRetry,withRetry } from '~/utils/retries'
import { expectProviderHttpError } from '../../../test-utils/rest-contract-helpers'

const FAST_RETRY_POLICY = {
  baseDelayMs: 0,
  maxDelayMs: 0,
  jitter: false,
  exponential: false
} as const

describe('retry error contracts', () => {

  test('withRetry throws AppError with attempts and provider metadata after exhaustion', async () => {
    let attempts = 0

    await expect(withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'test-provider-read',
        policy: {
          maxAttempts: 2,
          baseDelayMs: 0,
          maxDelayMs: 0,
          jitter: false,
          exponential: false
        }
      },
      async () => {
        attempts += 1
        throw ProviderError('provider unavailable', { status: 503, stage: 'poll', retryable: true, metadata: { category: 'network', rawResponse: { error: 'temporary outage' } } })
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read')
    )).rejects.toThrow(AppError)

    expect(attempts).toBe(2)

    const exhausted = await expectProviderHttpError(
      () => withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'test-provider-read',
          policy: {
            maxAttempts: 2,
            baseDelayMs: 0,
            maxDelayMs: 0,
            jitter: false,
            exponential: false
          }
        },
        async () => {
          throw ProviderError('provider unavailable', { status: 503, stage: 'poll', retryable: true, metadata: { category: 'network', rawResponse: { error: 'temporary outage' } } })
        },
        (error) => classifyFetchRetry(error, 'runtime_http_read')
      ),
      {
        instanceOf: AppError,
        kind: 'retry_exhausted',
        status: 503,
        stage: 'poll',
        retryable: true,
        messageContains: 'test-provider-read failed after 2/2 attempts (max attempts reached,'
      }
    ) as AppError
    expect(exhausted.retryClass).toBe('runtime_http_read')
    expect(exhausted.metadata).toMatchObject({
      attemptsMade: 2,
      maxAttempts: 2,
      stopReason: 'max attempts reached',
      category: 'network',
      rawResponse: { error: 'temporary outage' }
    })
  })

  test('withRetry hoists response headers so exhausted errors retain Retry-After pacing', async () => {
    const exhausted = await expectProviderHttpError(
      () => withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'rate-limited-read',
          policy: {
            ...FAST_RETRY_POLICY,
            maxAttempts: 1
          }
        },
        async () => {
          throw ProviderError('rate limited', { status: 429, headers: new Headers({ 'retry-after': '3' }) })
        },
        (error) => classifyFetchRetry(error, 'runtime_http_read')
      ),
      { instanceOf: AppError, kind: 'retry_exhausted', headers: { 'retry-after': '3' } }
    )
    expect(classifyFetchRetry(exhausted, 'runtime_http_read')).toEqual({
      shouldRetry: true,
      delayMs: 3_000,
      reason: 'retryable status 429'
    })
  })

  test('withRetry reports actual attempts when a later failure is non-retryable', async () => {
    let attempts = 0

    const exhausted = await expectProviderHttpError(
      () => withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'test-provider-create',
          policy: {
            maxAttempts: 4,
            baseDelayMs: 0,
            maxDelayMs: 0,
            jitter: false,
            exponential: false
          }
        },
        async () => {
          attempts += 1
          if (attempts === 1) {
            throw new TypeError('fetch failed')
          }
          throw ProviderError('bad request', { status: 400, stage: 'create' })
        },
        (error) => classifyFetchRetry(error, 'runtime_http_read')
      ),
      {
        instanceOf: AppError,
        kind: 'retry_exhausted',
        status: 400,
        stage: 'create',
        messageContains: 'test-provider-create failed after 2/4 attempts (non-retryable status 400,'
      }
    ) as AppError
    expect(exhausted.metadata['attemptsMade']).toBe(2)
    expect(exhausted.metadata['stopReason']).toBe('non-retryable status 400')
  })

  test('withRetry rethrows a first non-retryable failure unchanged', async () => {
    const original = ProviderError('bad request', { status: 400 })

    await expect(withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'test-provider-read',
        policy: {
          maxAttempts: 3,
          baseDelayMs: 0,
          maxDelayMs: 0,
          jitter: false,
          exponential: false
        }
      },
      async () => {
        throw original
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read')
    )).rejects.toBe(original)
  })
})
