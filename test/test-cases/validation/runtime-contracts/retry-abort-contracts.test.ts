import { describe,expect,test } from 'bun:test'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { exec } from '~/utils/cli-utils'
import { ProviderError } from '~/utils/error-handler'
import { pollUntil } from '~/utils/retries'
import { waitFor } from '../../../test-utils/wait-for'

const FAST_RETRY_POLICY = {
  baseDelayMs: 0,
  maxDelayMs: 0,
  jitter: false,
  exponential: false
} as const

describe('retry error contracts', () => {

  test('an unobserved AbortSignal timeout does not keep a completed process alive', () => {
    const startedAt = Date.now()
    const result = Bun.spawnSync([
      'bun',
      '--no-env-file',
      './test/test-utils/fixtures/unobserved-abort-timeout.fixture.ts',
    ], {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 2_000,
    })

    expect(result.exitCode).toBe(0)
    expect(result.signalCode).toBeUndefined()
    expect(result.stdout.toString()).toBe('UNOBSERVED_TIMEOUT_COMPLETE\n')
    expect(Date.now() - startedAt).toBeLessThan(2_000)
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
      retry: { operationName: 'abortable subprocess', shouldRetry: () => true }
    })
    setTimeout(() => controller.abort(cancellation), 20)
    await expect(run).rejects.toBe(cancellation)

    expect(Date.now() - startedAt).toBeLessThan(2_000)
  }, 5_000)
})
