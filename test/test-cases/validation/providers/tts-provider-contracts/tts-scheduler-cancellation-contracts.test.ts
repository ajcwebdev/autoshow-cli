import {
describe,
expect,
test
} from 'bun:test'
import { runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { requireDefined } from '../../../../test-utils/value-assertions'
import {
captureGatedAssertions,
waitForCondition
} from './shared'

describe('TTS provider service contracts', () => {

  test('hosted TTS chunk scheduler cancels a job waiting behind a provider pause', async () => {
      const scheduler = createHostedTtsChunkScheduler({
        maxConcurrency: 1,
        defaultRateLimitPauseMs: 10_000
      })
      const controller = new AbortController()
      const cancellation = new Error('cancel queued hosted TTS job')
      let starts = 0

      let admission
      await scheduler.runChunks('grok', ['seed'], async (chunk, _index, token) => {
        admission = token
        return chunk
      })
      if (!admission) throw new Error('Missing hosted TTS admission token')
      scheduler.notifyRateLimit(admission, { retryAfterMs: 10_000 })
      const runPromise = runTtsChunks(['a', 'b'], async (chunk) => {
        starts += 1
        return chunk
      }, {
        provider: 'grok',
        scheduler,
        abortSignal: controller.signal
      })

      const rethrowGatedAssertions = await captureGatedAssertions(async () => {
        await waitForCondition(
          () => scheduler.getProviderSnapshot('grok').queued === 2,
          'paused scheduler did not queue the cancellable job'
        )
      }, () => {})

      const startedAt = Date.now()
      controller.abort(cancellation)
      await expect(runPromise).rejects.toBe(cancellation)

      expect(Date.now() - startedAt).toBeLessThan(2_000)
      expect(starts).toBe(0)
      expect(scheduler.getProviderSnapshot('grok')).toMatchObject({
        active: 0,
        queued: 0
      })
      rethrowGatedAssertions()
    }, 5_000)

  test('hosted TTS chunk scheduler waits for active chunks to settle after cancellation', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 2, concurrencyMode: 'immediate' })
      const controller = new AbortController()
      const cancellation = new Error('cancel active hosted TTS chunks')
      const releases: Array<() => void> = []
      let starts = 0
      let settled = false
      let rejection: unknown

      const run = runTtsChunks(['a', 'b', 'must-not-start'], async (chunk) => {
        starts += 1
        await new Promise<void>((resolve) => releases.push(resolve))
        return chunk
      }, {
        provider: 'grok',
        scheduler,
        abortSignal: controller.signal
      })
      const observed = run.then(
        () => { settled = true },
        (error: unknown) => {
          rejection = error
          settled = true
        }
      )

      await waitForCondition(() => releases.length === 2, 'scheduler did not start both active chunks')
      controller.abort(cancellation)
      await Bun.sleep(20)
      expect(settled).toBe(false)
      expect(starts).toBe(2)
      expect(scheduler.getProviderSnapshot('grok')).toMatchObject({ active: 2, queued: 0 })

      const firstRelease = requireDefined(releases.shift(), 'first active chunk release')
      firstRelease()
      await waitForCondition(() => scheduler.getProviderSnapshot('grok').active === 1, 'first active chunk did not settle')
      expect(settled).toBe(false)

      const secondRelease = requireDefined(releases.shift(), 'second active chunk release')
      secondRelease()
      await observed

      expect(rejection).toBe(cancellation)
      expect(starts).toBe(2)
      expect(scheduler.getProviderSnapshot('grok')).toMatchObject({ active: 0, queued: 0 })
    }, 5_000)

  test('hosted TTS chunk scheduler does not admit a sibling job during shared-signal abort dispatch', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 1, concurrencyMode: 'immediate' })
      const controller = new AbortController()
      const cancellation = new Error('cancel shared hosted TTS signal')
      let releaseActive: (() => void) | undefined
      let queuedStarts = 0

      const active = scheduler.runChunks('grok', ['active'], async (chunk) => {
        await new Promise<void>((resolve) => { releaseActive = resolve })
        return chunk
      }, { abortSignal: controller.signal })
      const queued = scheduler.runChunks('grok', ['queued'], async (chunk) => {
        queuedStarts += 1
        return chunk
      }, { abortSignal: controller.signal })

      await waitForCondition(
        () => releaseActive !== undefined && scheduler.getProviderSnapshot('grok').queued === 1,
        'scheduler did not establish the active/queued shared-signal race'
      )
      controller.abort(cancellation)
      await expect(queued).rejects.toBe(cancellation)
      expect(queuedStarts).toBe(0)

      releaseActive?.()
      await expect(active).rejects.toBe(cancellation)
      expect(scheduler.getProviderSnapshot('grok')).toMatchObject({ active: 0, queued: 0 })
    }, 5_000)
})
