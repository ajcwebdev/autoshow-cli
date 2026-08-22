import { describe, expect, test } from 'bun:test'
import { AppError, InfraError, ProviderError } from '~/utils/error-handler'
import {
  classifyFetchRetry,
  classifyPaidCreateRetry,
  classifyRetryFloor,
  formatRetryExhaustedMessage,
  getRetryPolicyForClass,
  isNonRetryableStatus,
  isRetryableStatus,
  NON_RETRYABLE_STATUS_CODES,
  parseRetryAfterMs,
  pollUntil,
  RETRYABLE_STATUS_CODES,
  withRetry
} from '~/utils/retries'
import { expectProviderHttpError } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

const expectAppError = async (
  fn: () => Promise<unknown>,
  expectation: { kind: 'retry_exhausted' | 'infrastructure' }
): Promise<AppError> => {
  const error = await expectProviderHttpError(fn, expectation)
  expect(error).toBeInstanceOf(AppError)
  return error as AppError
}

const recordSleeps = async <T>(run: () => Promise<T>): Promise<{ result?: T, error?: unknown, sleeps: number[] }> => {
  const previousSleep = Bun.sleep
  const sleeps: number[] = []
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (delayMs: number) => {
    sleeps.push(delayMs)
  }) as typeof Bun.sleep
  try {
    return { result: await run(), sleeps }
  } catch (error) {
    return { error, sleeps }
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
  }
}

const alwaysFails = (error: unknown) => async (): Promise<never> => {
  throw error
}

describe('retry delay computation', () => {
  test('doubles the base delay each attempt within the jitter band', async () => {
    const { sleeps } = await recordSleeps(async () => await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'delay-progression',
        policy: { maxAttempts: 4, baseDelayMs: 1_000, maxDelayMs: 60_000, jitter: true, exponential: true }
      },
      alwaysFails(InfraError('transient')),
      () => ({ shouldRetry: true, delayMs: 0, reason: 'forced' })
    ))

    expect(sleeps).toHaveLength(3)
    for (const [index, delayMs] of sleeps.entries()) {
      const base = 1_000 * Math.pow(2, index)
      expect(delayMs).toBeGreaterThanOrEqual(base * 0.5)
      expect(delayMs).toBeLessThanOrEqual(base)
    }
    expect(requireDefined(sleeps[2], 'third delay')).toBeGreaterThan(requireDefined(sleeps[0], 'first delay'))
  })

  test('omits jitter when the policy disables it', async () => {
    const { sleeps } = await recordSleeps(async () => await withRetry(
      {
        retryClass: 'runtime_subprocess_transient',
        operationName: 'delay-flat',
        policy: { maxAttempts: 3, baseDelayMs: 750, maxDelayMs: 60_000, jitter: false, exponential: false }
      },
      alwaysFails(InfraError('transient')),
      () => ({ shouldRetry: true, delayMs: 0, reason: 'forced' })
    ))

    expect(sleeps).toEqual([750, 750])
  })

  test('clamps every delay to the policy ceiling', async () => {
    const { sleeps } = await recordSleeps(async () => await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'delay-clamp',
        policy: { maxAttempts: 5, baseDelayMs: 10_000, maxDelayMs: 12_000, jitter: false, exponential: true }
      },
      alwaysFails(InfraError('transient')),
      () => ({ shouldRetry: true, delayMs: 0, reason: 'forced' })
    ))

    expect(sleeps).toEqual([10_000, 12_000, 12_000, 12_000])
  })

  test('a classifier delay overrides the computed backoff', async () => {
    const { sleeps } = await recordSleeps(async () => await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'delay-from-classifier',
        policy: { maxAttempts: 3, baseDelayMs: 9_000, maxDelayMs: 9_000, jitter: false, exponential: false }
      },
      alwaysFails(ProviderError('slow down', { status: 429, headers: new Headers({ 'retry-after': '3' }) })),
      (error) => classifyFetchRetry(error, 'runtime_http_read')
    ))

    expect(sleeps).toEqual([3_000, 3_000])
  })
})

describe('Retry-After parsing', () => {
  test('reads the delta-seconds form, including fractions', () => {
    expect(parseRetryAfterMs(new Headers({ 'retry-after': '2' }))).toBe(2_000)
    expect(parseRetryAfterMs(new Headers({ 'retry-after': '0.25' }))).toBe(250)
  })

  test('reads the HTTP-date form as a delay from now', () => {
    const future = new Date(Date.now() + 30_000).toUTCString()
    const parsed = requireDefined(parseRetryAfterMs(new Headers({ 'retry-after': future })), 'http-date retry-after')

    expect(parsed).toBeGreaterThan(25_000)
    expect(parsed).toBeLessThanOrEqual(30_000)
  })

  test('ignores a past HTTP date, an unparseable value, and a missing header', () => {
    const past = new Date(Date.now() - 60_000).toUTCString()

    expect(parseRetryAfterMs(new Headers({ 'retry-after': past }))).toBeUndefined()
    expect(parseRetryAfterMs(new Headers({ 'retry-after': 'soon' }))).toBeUndefined()
    expect(parseRetryAfterMs(new Headers())).toBeUndefined()
    expect(parseRetryAfterMs(undefined)).toBeUndefined()
  })
})

describe('status vocabulary', () => {
  test('every retryable status and the 5xx catch-all classify as retryable', () => {
    for (const status of RETRYABLE_STATUS_CODES) {
      expect(isRetryableStatus(status)).toBe(true)
      expect(classifyFetchRetry(ProviderError('transient', { status }), 'runtime_http_read')).toMatchObject({
        shouldRetry: true,
        reason: `retryable status ${status}`
      })
    }

    expect(isRetryableStatus(529)).toBe(true)
    expect(classifyFetchRetry(ProviderError('overloaded', { status: 529 }), 'runtime_http_read')).toMatchObject({
      shouldRetry: true,
      reason: 'retryable status 529'
    })
  })

  test('every non-retryable status stops the loop, 402 included', () => {
    expect([...NON_RETRYABLE_STATUS_CODES]).toContain(402)
    for (const status of NON_RETRYABLE_STATUS_CODES) {
      expect(isNonRetryableStatus(status)).toBe(true)
      expect(isRetryableStatus(status)).toBe(false)
      expect(classifyFetchRetry(ProviderError('deterministic', { status }), 'runtime_http_read')).toMatchObject({
        shouldRetry: false,
        reason: `non-retryable status ${status}`
      })
    }
  })

  test('a status in neither set is refused as unexpected rather than retried', () => {
    expect(classifyFetchRetry(ProviderError('teapot', { status: 418 }), 'runtime_http_read')).toMatchObject({
      shouldRetry: false,
      reason: 'unexpected status 418'
    })
  })

  test('paid creates redispatch on 425 and 429 only', () => {
    expect(classifyPaidCreateRetry(ProviderError('too early', { status: 425 }))).toMatchObject({
      shouldRetry: true,
      reason: 'provider rejected paid create with retryable status 425'
    })
    expect(classifyPaidCreateRetry(ProviderError('slow down', { status: 429 }))).toMatchObject({ shouldRetry: true })
    for (const status of [408, 500, 502, 503, 504]) {
      expect(classifyPaidCreateRetry(ProviderError('ambiguous', { status }))).toMatchObject({
        shouldRetry: false,
        reason: `paid create status ${status} is not safe to redispatch`
      })
    }
  })

  test('classification reads the status through a wrapping error', () => {
    const wrapped = InfraError('target failed', { cause: ProviderError('unauthorized', { status: 401 }) })

    expect(classifyFetchRetry(wrapped, 'runtime_http_read')).toMatchObject({
      shouldRetry: false,
      reason: 'non-retryable status 401'
    })
  })
})

describe('the classifier-less retry floor', () => {
  test('a classifier-less withRetry still refuses an explicitly non-retryable error', async () => {
    const deterministic = ProviderError('wrong checksum', { retryable: false })
    let attempts = 0

    await expect(withRetry(
      { retryClass: 'setup_download', operationName: 'model-download' },
      async () => {
        attempts += 1
        throw deterministic
      }
    )).rejects.toBe(deterministic)

    expect(attempts).toBe(1)
  })

  test('a classifier-less withRetry still refuses a deterministic status', async () => {
    const notFound = ProviderError('missing model file', { status: 404 })
    let attempts = 0

    await expect(withRetry(
      { retryClass: 'setup_download', operationName: 'model-download-404' },
      async () => {
        attempts += 1
        throw notFound
      }
    )).rejects.toBe(notFound)

    expect(attempts).toBe(1)
  })

  test('a classifier-less withRetry honors Retry-After instead of computed backoff', async () => {
    const { sleeps } = await recordSleeps(async () => await withRetry(
      {
        retryClass: 'setup_download',
        operationName: 'model-download-429',
        policy: { maxAttempts: 2, baseDelayMs: 30_000, maxDelayMs: 30_000, jitter: false, exponential: false }
      },
      alwaysFails(ProviderError('slow down', { status: 429, headers: new Headers({ 'retry-after': '4' }) }))
    ))

    expect(sleeps).toEqual([4_000])
  })

  test('the floor keeps retry-on-any-error as the default', () => {
    expect(classifyRetryFloor(new Error('something unrecognized'))).toMatchObject({
      shouldRetry: true,
      reason: 'something unrecognized'
    })
  })

  test('a retryable: false property is honored when driven through withRetry with a classifier too', async () => {
    const deterministic = ProviderError('business rejection on a 200', { retryable: false })
    let attempts = 0

    await expect(withRetry(
      { retryClass: 'runtime_http_read', operationName: 'classified-non-retryable' },
      async () => {
        attempts += 1
        throw deterministic
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read')
    )).rejects.toBe(deterministic)

    expect(attempts).toBe(1)
  })
})

describe('exhaustion contract', () => {
  test('retry_exhausted carries numeric attempt and elapsed metadata', async () => {
    const error = await expectAppError(
      () => withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'exhaustion-metadata',
          policy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false }
        },
        alwaysFails(ProviderError('provider busy', { status: 503 })),
        (error) => classifyFetchRetry(error, 'runtime_http_read')
      ),
      { kind: 'retry_exhausted' }
    )

    expect(typeof error.metadata['elapsedMs']).toBe('number')
    expect(error.metadata).toMatchObject({
      attemptsMade: 2,
      maxAttempts: 2,
      stopReason: 'max attempts reached',
      retryClass: 'runtime_http_read'
    })
    expect(error.status).toBe(503)
  })

  test('the exhaustion message wording the harness classifies on is stable', async () => {
    expect(formatRetryExhaustedMessage('some-op', 2, 4, 'max attempts reached', 1_200))
      .toBe('some-op failed after 2/4 attempts (max attempts reached, 1200ms elapsed)')

    const error = await expectAppError(
      () => withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'wording-pin',
          policy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false }
        },
        alwaysFails(ProviderError('provider busy', { status: 503 })),
        (error) => classifyFetchRetry(error, 'runtime_http_read')
      ),
      { kind: 'retry_exhausted' }
    )

    expect(error.message).toMatch(/^wording-pin failed after 2\/2 attempts \(max attempts reached, \d+ms elapsed\)$/)
  })

  test('a deterministic refusal names its stop reason in the message', async () => {
    const error = await expectAppError(
      () => withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'deterministic-stop',
          policy: { maxAttempts: 4, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false }
        },
        (() => {
          let attempts = 0
          return async (): Promise<never> => {
            attempts += 1
            throw attempts === 1
              ? ProviderError('provider busy', { status: 503 })
              : ProviderError('bad request', { status: 400 })
          }
        })(),
        (error) => classifyFetchRetry(error, 'runtime_http_read')
      ),
      { kind: 'retry_exhausted' }
    )

    expect(error.message).toContain('(non-retryable status 400,')
    expect(error.metadata['stopReason']).toBe('non-retryable status 400')
  })

  test('an already-aborted signal is refused before the first attempt', async () => {
    const controller = new AbortController()
    const cancellation = new Error('cancelled before entry')
    controller.abort(cancellation)
    let attempts = 0

    await expect(withRetry(
      { retryClass: 'runtime_http_read', operationName: 'pre-aborted', abortSignal: controller.signal },
      async () => {
        attempts += 1
        return 'unreachable'
      }
    )).rejects.toBe(cancellation)

    expect(attempts).toBe(0)
  })
})

describe('the retry policy table', () => {
  test('the retriable-create tier is one policy shared by every hosted create', () => {
    expect(getRetryPolicyForClass('runtime_http_create_retriable')).toEqual({
      maxAttempts: 4,
      baseDelayMs: 2_000,
      maxDelayMs: 30_000,
      jitter: true,
      exponential: true
    })
  })

  test('the conservative tier keeps its own attempt budget but the same ceiling', () => {
    const conservative = getRetryPolicyForClass('runtime_http_create_conservative')
    const retriable = getRetryPolicyForClass('runtime_http_create_retriable')

    expect(conservative.maxAttempts).toBe(2)
    expect(conservative.maxDelayMs).toBe(retriable.maxDelayMs)
    expect(conservative).not.toBe(retriable)
  })

  test('the returned policy is a copy, so a caller cannot mutate the table', () => {
    const policy = getRetryPolicyForClass('runtime_http_read')
    policy.maxAttempts = 99

    expect(getRetryPolicyForClass('runtime_http_read').maxAttempts).toBe(4)
  })
})

describe('pollUntil', () => {
  test('deadline exhaustion throws retry_exhausted with the last poll snapshot', async () => {
    const error = await expectAppError(
      () => pollUntil<{ state: string }>({
        operationName: 'deadline-poll',
        pollFn: async () => ({ state: 'processing' }),
        isDone: () => false,
        describeResult: (result) => ({ state: result.state }),
        intervalMs: 1,
        deadlineMs: 25
      }),
      { kind: 'retry_exhausted' }
    )

    expect(error.message).toContain('deadline exceeded')
    expect(error.stage).toBe('deadline-poll')
    expect(error.metadata).toMatchObject({
      operationName: 'deadline-poll',
      deadlineMs: 25,
      stopReason: 'deadline exceeded',
      lastPoll: { state: 'processing' }
    })
    expect(typeof error.metadata['elapsedMs']).toBe('number')
    expect(error.metadata['pollCount']).toBeGreaterThan(0)
  })

  test('a terminal failure carries the provider status and headers', async () => {
    const error = await expectAppError(
      () => pollUntil<{ state: string }>({
        operationName: 'terminal-poll',
        pollFn: async () => ({ state: 'failed' }),
        isDone: () => false,
        isFailed: () => ({
          failed: true,
          reason: 'provider reported a terminal failure',
          status: 502,
          headers: new Headers({ 'x-request-id': 'req-terminal' }),
          metadata: { jobId: 'job-1' }
        }),
        intervalMs: 1,
        deadlineMs: 5_000
      }),
      { kind: 'infrastructure' }
    )

    expect(error.message).toContain('terminal failure — provider reported a terminal failure')
    expect(error.status).toBe(502)
    expect(error.headers?.get('x-request-id')).toBe('req-terminal')
    expect(error.metadata).toMatchObject({ jobId: 'job-1', pollCount: 1 })
  })

  test('an already-aborted signal is refused before the first poll', async () => {
    const controller = new AbortController()
    const cancellation = new Error('cancelled before entry')
    controller.abort(cancellation)
    let polls = 0

    await expect(pollUntil({
      operationName: 'pre-aborted-poll',
      pollFn: async () => {
        polls += 1
        return { done: true }
      },
      isDone: (result: { done: boolean }) => result.done,
      intervalMs: 1,
      deadlineMs: 1_000,
      abortSignal: controller.signal
    })).rejects.toBe(cancellation)

    expect(polls).toBe(0)
  })

  test('the interval grows toward the ceiling and a poll result can pace it', async () => {
    const stats = { pollCount: 0, pollSleepMs: 0 }
    const { sleeps } = await recordSleeps(async () => await pollUntil<{ done: boolean, retryAfterMs: number | null }>({
      operationName: 'adaptive-poll',
      pollFn: (() => {
        let polls = 0
        return async () => {
          polls += 1
          return { done: polls >= 5, retryAfterMs: polls === 3 ? 7_000 : null }
        }
      })(),
      isDone: (result) => result.done,
      nextIntervalMs: (result) => result.retryAfterMs ?? undefined,
      intervalMs: 1_000,
      maxIntervalMs: 8_000,
      deadlineMs: 10 * 60_000,
      sleepBeforeFirstPoll: true,
      stats
    }))

    expect(sleeps).toEqual([1_000, 2_000, 4_000, 7_000, 8_000])
    expect(stats.pollCount).toBe(5)
  })

  test('a fixed interval schedule bounds the poll count', async () => {
    let polls = 0
    const { error, sleeps } = await recordSleeps(async () => await pollUntil({
      operationName: 'probe-ladder',
      pollFn: async () => {
        polls += 1
        return { done: false }
      },
      isDone: (result: { done: boolean }) => result.done,
      intervalMs: 0,
      intervalSchedule: [0, 30_000, 60_000],
      deadlineMs: 10 * 60_000
    }))

    expect(polls).toBe(3)
    expect(sleeps).toEqual([30_000, 60_000])
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).metadata).toMatchObject({ stopReason: 'max polls reached', attemptsMade: 3, maxAttempts: 3 })
  })

  test('an interval never overruns the deadline', async () => {
    const { sleeps } = await recordSleeps(async () => await pollUntil({
      operationName: 'clamped-poll',
      pollFn: async () => ({ done: false }),
      isDone: (result: { done: boolean }) => result.done,
      intervalMs: 10_000,
      deadlineMs: 40,
      sleepBeforeFirstPoll: true
    }))

    for (const delayMs of sleeps) {
      expect(delayMs).toBeLessThanOrEqual(40)
    }
  })
})
