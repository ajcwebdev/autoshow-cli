import { describe, expect, test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exec } from '~/utils/cli-utils'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { expectProviderHttpError } from '../../../test-utils/rest-contract-helpers'

describe('general retry-on-any-error contracts', () => {
  test('classifyFetchRetry retries unrecognized error types', () => {
    const decision = classifyFetchRetry(new Error('totally novel failure'), 'runtime_http_read')
    expect(decision).toMatchObject({ shouldRetry: true, reason: 'unclassified error' })
  })

  test('classifyFetchRetry still refuses deterministic 4xx client errors', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      const decision = classifyFetchRetry(ProviderError('client error', { status }), 'runtime_http_read')
      expect(decision.shouldRetry).toBe(false)
    }
  })

  test('classifyFetchRetry preserves timeout identity through retry-exhaustion wrappers', async () => {
    const error = await expectProviderHttpError(
      () => withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'wrapped-timeout',
          policy: {
            maxAttempts: 1,
            baseDelayMs: 0,
            maxDelayMs: 0,
            jitter: false,
            exponential: false
          }
        },
        async () => {
          throw new DOMException('The operation timed out.', 'TimeoutError')
        },
        (error) => classifyFetchRetry(error, 'runtime_http_read')
      ),
      { kind: 'retry_exhausted' }
    )
    expect(classifyFetchRetry(error, 'runtime_http_create_conservative')).toMatchObject({
      shouldRetry: false,
      reason: 'paid create outcome is ambiguous'
    })
    expect(classifyFetchRetry(error, 'runtime_http_create_retriable')).toMatchObject({
      shouldRetry: true,
      reason: 'abort/timeout'
    })
  })

  test('exec does not retry by default and returns the first failing result', async () => {
    const result = await exec('sh', ['-c', 'exit 5'])
    expect(result.exitCode).toBe(5)
  })

  test('exec retries a non-zero exit and succeeds once the command recovers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-exec-retry-'))
    try {
      const counter = join(dir, 'count')
      const script = `n=$(cat ${counter} 2>/dev/null || echo 0); n=$((n+1)); echo $n > ${counter}; if [ $n -lt 2 ]; then exit 1; fi; printf ok`
      const result = await exec('sh', ['-c', script], {
        retry: { operationName: 'flaky-exec', maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 }
      })
      expect(result.exitCode).toBe(0)
      expect(result.stdout.trim()).toBe('ok')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('exec returns the last failing result after exhausting retries', async () => {
    const result = await exec('sh', ['-c', 'exit 7'], {
      retry: { operationName: 'always-fails', maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 }
    })
    expect(result.exitCode).toBe(7)
  })

})
