import { describe,expect,test } from 'bun:test'
import { createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { ProviderError,UsageError } from '~/utils/error-handler'

const FAST_RETRY_POLICY = {
  baseDelayMs: 0,
  maxDelayMs: 0,
  jitter: false,
  exponential: false
} as const

describe('retry error contracts', () => {

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
    const contractError = UsageError('serializer evidence does not match the immutable plan')
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
    const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 4, concurrencyMode: 'immediate' })
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
})
