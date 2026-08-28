import {
describe,
expect,
test
} from 'bun:test'
import { runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import {
captureGatedAssertions,
waitForCondition
} from './shared'

describe('TTS provider service contracts', () => {

  test('hosted TTS chunk scheduler reduces provider limit and pauses new starts on 429 feedback', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 4, defaultRateLimitPauseMs: 30 })
      const starts: string[] = []
      const releases: Array<() => void> = []
      let releaseImmediately = false
      let rateLimited = false

      const runPromise = runTtsChunks(['a', 'b', 'c', 'd', 'e'], async (chunk, _index, admission) => {
        starts.push(chunk)
        if (!rateLimited) {
          rateLimited = true
          if (!admission) throw new Error('Missing hosted TTS admission token')
          scheduler.notifyRateLimit(admission, { retryAfterMs: 30 })
        }
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.push(resolve))
        }
        return chunk
      }, { provider: 'grok', scheduler })
      const rethrowGatedAssertions = await captureGatedAssertions(async () => {
        await waitForCondition(() => starts.length === 2, 'rate-limit test did not start the reduced-limit chunks')
        expect(scheduler.getProviderSnapshot('grok').currentLimit).toBe(2)
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
        await Bun.sleep(5)
        expect(starts).toHaveLength(2)
        await new Promise<void>((resolve) => setTimeout(resolve, 35))
        await waitForCondition(() => starts.length === 5, 'rate-limit pause did not eventually reopen starts')
      }, () => {
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
      })

      expect(await runPromise).toEqual(['a', 'b', 'c', 'd', 'e'])
      rethrowGatedAssertions()
    })

  test('hosted TTS chunk scheduler gradually ramps successful providers back to the configured max', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 4, concurrencyMode: 'immediate' })
      let admission
      await scheduler.runChunks('grok', ['seed'], async (chunk, _index, token) => {
        admission = token
        return chunk
      })
      if (!admission) throw new Error('Missing hosted TTS admission token')
      scheduler.notifyRateLimit(admission, { retryAfterMs: 0 })
      expect(scheduler.getProviderSnapshot('grok').currentLimit).toBe(2)

      await scheduler.runChunks('grok', ['a', 'b'], async (chunk) => chunk)
      expect(scheduler.getProviderSnapshot('grok').currentLimit).toBe(3)

      await scheduler.runChunks('grok', ['c', 'd', 'e'], async (chunk) => chunk)
      expect(scheduler.getProviderSnapshot('grok').currentLimit).toBe(4)
    })
})
