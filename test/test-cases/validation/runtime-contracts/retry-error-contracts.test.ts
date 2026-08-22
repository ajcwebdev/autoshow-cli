import { describe, expect, test } from 'bun:test'
import { createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { classifyTtsProviderAdmissionError } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/tts-request-evidence'
import { AppError, CLIUsageError, ProviderError } from '~/utils/error-handler'
import { exec } from '~/utils/cli-utils'
import { classifyFetchRetry, classifyPaidCreateRetry, pollUntil, withRetry } from '~/utils/retries'
import { expectProviderHttpError } from '../../../test-utils/rest-contract-helpers'
import { waitFor } from '../../../test-utils/wait-for'

const FAST_RETRY_POLICY = {
  baseDelayMs: 0,
  maxDelayMs: 0,
  jitter: false,
  exponential: false
} as const

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

  test('withHostedTtsRetry does not redispatch an ambiguous timeout', async () => {
    let attempts = 0
    const signals: boolean[] = []

    await expect(withHostedTtsRetry(
      {
        operationName: 'hosted-tts-timeout-ambiguous',
        timeoutMs: 1_000,
        policy: {
          ...FAST_RETRY_POLICY,
          maxAttempts: 4
        }
      },
      async (signal) => {
        attempts += 1
        signals.push(signal instanceof AbortSignal)
        throw new DOMException('The operation timed out.', 'TimeoutError')
      }
    )).rejects.toThrow('timed out')

    expect(attempts).toBe(1)
    expect(signals).toEqual([true])
  })

  test('withHostedTtsRetry returns the first ambiguous timeout unchanged', async () => {
    let attempts = 0
    const timeout = new DOMException('The operation timed out.', 'TimeoutError')

    await expect(withHostedTtsRetry(
        {
          operationName: 'hosted-tts-timeout-exhaustion',
          policy: {
            ...FAST_RETRY_POLICY,
            maxAttempts: 2
          }
        },
        async () => {
          attempts += 1
          throw timeout
        }
      )).rejects.toBe(timeout)
    expect(attempts).toBe(1)
  })

  test('withHostedTtsRetry does not redispatch ambiguous 5xx and honors definite 400 rejection', async () => {
    let attempts = 0
    const unavailable = ProviderError('provider busy', {
      status: 503,
      headers: new Headers({ 'retry-after': '0' })
    })
    await expect(withHostedTtsRetry(
      {
        operationName: 'hosted-tts-http-retry',
        policy: {
          ...FAST_RETRY_POLICY,
          maxAttempts: 4
        }
      },
      async () => {
        attempts += 1
        throw unavailable
      }
    )).rejects.toBe(unavailable)

    expect(attempts).toBe(1)

    const badRequest = ProviderError('bad request', { status: 400 })
    attempts = 0
    await expect(withHostedTtsRetry(
      {
        operationName: 'hosted-tts-http-400',
        policy: {
          ...FAST_RETRY_POLICY,
          maxAttempts: 4
        }
      },
      async () => {
        attempts += 1
        throw badRequest
      }
    )).rejects.toBe(badRequest)
    expect(attempts).toBe(1)
  })

  test('withHostedTtsRetry never redispatches an ambiguous admission in flight', async () => {
    let attempts = 0
    const ambiguous = ProviderError('provider inference failed', { status: 500, retryable: true })
    Object.defineProperty(ambiguous, 'ttsAdmissionAmbiguous', { value: true, configurable: true })

    await expect(withHostedTtsRetry(
      {
        operationName: 'hosted-tts-ambiguous-admission',
        policy: { ...FAST_RETRY_POLICY, maxAttempts: 5 }
      },
      async () => {
        attempts += 1
        throw ambiguous
      }
    )).rejects.toBe(ambiguous)

    expect(attempts).toBe(1)
  })

  test('withHostedTtsRetry redispatches a definite provider rejection', async () => {
    let attempts = 0
    const result = await withHostedTtsRetry(
      {
        operationName: 'hosted-tts-rejected-create',
        policy: { ...FAST_RETRY_POLICY, maxAttempts: 5 }
      },
      async () => {
        attempts += 1
        if (attempts < 4) {
          throw ProviderError('slow down', { status: 429 })
        }
        return 'recovered'
      }
    )

    expect(result).toBe('recovered')
    expect(attempts).toBe(4)
  })

  test('withHostedTtsRetry does not retry deterministic local contract errors', async () => {
    let attempts = 0
    const contractError = CLIUsageError('serializer evidence does not match the immutable plan')
    await expect(withHostedTtsRetry(
      {
        operationName: 'hosted-tts-local-contract-error',
        policy: { ...FAST_RETRY_POLICY, maxAttempts: 4 }
      },
      async () => {
        attempts += 1
        throw contractError
      }
    )).rejects.toBe(contractError)
    expect(attempts).toBe(1)
  })

  test('withHostedTtsRetry notifies hosted TTS chunk scheduler on 429 retries', async () => {
    const scheduler = createHostedTtsChunkScheduler(4)
    let attempts = 0

    const [result] = await scheduler.runChunks('grok', ['chunk'], async (_chunk, _index, admission) =>
      await withHostedTtsRetry(
        {
          operationName: 'hosted-tts-rate-limit-feedback',
          policy: {
            ...FAST_RETRY_POLICY,
            maxAttempts: 2
          },
          admission,
          chunkScheduler: scheduler
        },
        async () => {
          attempts += 1
          if (attempts === 1) {
            throw ProviderError('rate limited', { status: 429, headers: new Headers({ 'retry-after': '0' }) })
          }
          return 'ok'
        }
      )
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(2)
    expect(scheduler.getProviderSnapshot('grok').currentLimit).toBe(2)
  })

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

  test('withHostedTtsRetry aborts a Retry-After backoff promptly', async () => {
    const controller = new AbortController()
    const cancellation = new Error('cancel hosted TTS retry backoff')
    let attempts = 0
    const startedAt = Date.now()
    const run = withHostedTtsRetry(
      {
        operationName: 'hosted-tts-abort-backoff',
        abortSignal: controller.signal,
        policy: {
          ...FAST_RETRY_POLICY,
          maxAttempts: 2
        }
      },
      async () => {
        attempts += 1
        throw ProviderError('rate limited', { status: 429, headers: new Headers({ 'retry-after': '10' }) })
      }
    )
    setTimeout(() => controller.abort(cancellation), 20)
    await expect(run).rejects.toBe(cancellation)

    expect(attempts).toBe(1)
    expect(Date.now() - startedAt).toBeLessThan(2_000)
  }, 5_000)

  test('pollUntil aborts its interval wait without issuing another poll', async () => {
    const controller = new AbortController()
    const cancellation = new Error('cancel provider status polling')
    let polls = 0
    const run = pollUntil({
      operationName: 'abortable-provider-status-poll',
      intervalMs: 10_000,
      deadlineMs: 20_000,
      abortSignal: controller.signal,
      pollFn: async () => {
        polls += 1
        return { done: false }
      },
      isDone: result => result.done
    })

    await waitFor(() => polls > 0, { label: 'the first poll' })
    const startedAt = Date.now()
    controller.abort(cancellation)

    await expect(run).rejects.toBe(cancellation)
    expect(polls).toBe(1)
    expect(Date.now() - startedAt).toBeLessThan(2_000)
  }, 5_000)

  test('exec terminates a subprocess promptly when its signal is aborted', async () => {
    const controller = new AbortController()
    const cancellation = new Error('cancel local subprocess')
    const startedAt = Date.now()
    const run = exec(process.execPath, ['-e', 'setTimeout(() => {}, 10_000)'], {
      signal: controller.signal,
      retry: { operationName: 'abortable subprocess' }
    })
    setTimeout(() => controller.abort(cancellation), 20)
    await expect(run).rejects.toBe(cancellation)

    expect(Date.now() - startedAt).toBeLessThan(2_000)
  }, 5_000)
})
