import {
describe,
expect,
test
} from 'bun:test'
import { runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { bindHostedTtsChunkScheduler,createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import {
captureGatedAssertions,
waitForCondition
} from './shared'

describe('TTS provider service contracts', () => {

  test('hosted TTS admission tokens attribute retries and rate limits to the exact chunk job', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 2, concurrencyMode: 'immediate', autoStart: false })
      const first = scheduler.runChunks('grok', ['A'], async (chunk, _index, admission) => {
        expect(Object.isFrozen(admission)).toBe(true)
        expect(Object.isFrozen(admission.context)).toBe(true)
        scheduler.notifyRetry(admission)
        scheduler.notifyRetry(admission)
        scheduler.notifyRetry({ ...admission })
        scheduler.notifyRateLimit(admission, { retryAfterMs: 0 })
        return chunk
      }, { job: { jobId: 'job-a', inputIndex: 0, targetIndex: 0 } })
      const second = scheduler.runChunks('grok', ['B'], async (chunk, _index, admission) => {
        scheduler.notifyRetry(admission)
        return chunk
      }, { job: { jobId: 'job-b', inputIndex: 1, targetIndex: 0 } })

      expect(await scheduler.waitForRegisteredJobs(2, 100)).toBe(true)
      scheduler.start()
      await Promise.all([first, second])
      const telemetry = scheduler.getTelemetry()
      expect(telemetry.providers[0]).toMatchObject({ retryCount: 3, rateLimitCount: 1 })
      expect(telemetry.jobs.find(job => job.jobId === 'job-a')).toMatchObject({ retryCount: 2, rateLimitCount: 1 })
      expect(telemetry.jobs.find(job => job.jobId === 'job-b')).toMatchObject({ retryCount: 1, rateLimitCount: 0 })
      expect(telemetry.providers[0]?.retryCount).toBe(telemetry.jobs.reduce((sum, job) => sum + job.retryCount, 0))
      expect(telemetry.providers[0]?.rateLimitCount).toBe(telemetry.jobs.reduce((sum, job) => sum + job.rateLimitCount, 0))
    })

  test('hosted TTS scheduler bindings preserve input, target, turn, and segment identity', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 1, concurrencyMode: 'immediate' })
      const targetScheduler = bindHostedTtsChunkScheduler(scheduler, {
        job: { jobId: 'input-2-target-3', inputIndex: 2, targetIndex: 3, originalOrder: 23 }
      })
      const segmentScheduler = bindHostedTtsChunkScheduler(targetScheduler, {
        job: { jobId: 'input-2-target-3-turn-4-segment-5', turnIndex: 4, segmentIndex: 5, originalOrder: 23.004005 }
      })

      await segmentScheduler.runChunks('grok', ['chunk'], async (chunk) => chunk)
      expect(scheduler.getTelemetry().jobs[0]).toMatchObject({
        jobId: 'input-2-target-3-turn-4-segment-5',
        inputIndex: 2,
        targetIndex: 3,
        turnIndex: 4,
        segmentIndex: 5,
        originalOrder: 23.004005
      })
    })

  test('hosted TTS scope labels isolate pressure lanes for the same provider', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 2, concurrencyMode: 'immediate' })
      const releases: Array<() => void> = []
      let releaseImmediately = false
      let active = 0
      let maxActive = 0
      const runChunk = async (chunk: string): Promise<string> => {
        active += 1
        maxActive = Math.max(maxActive, active)
        if (!releaseImmediately) await new Promise<void>((resolve) => releases.push(resolve))
        active -= 1
        return chunk
      }
      const first = runTtsChunks(['A1', 'A2'], runChunk, { provider: 'grok', scheduler, scopeLabel: 'account-a' })
      const second = runTtsChunks(['B1', 'B2'], runChunk, { provider: 'grok', scheduler, scopeLabel: 'account-b' })

      try {
        await waitForCondition(() => releases.length === 4, 'scoped hosted TTS lanes did not admit independently')
        expect(maxActive).toBe(4)
        expect(scheduler.getProviderSnapshot('grok', 'account-a')).toMatchObject({ active: 2, laneKey: 'grok:account-a' })
        expect(scheduler.getProviderSnapshot('grok', 'account-b')).toMatchObject({ active: 2, laneKey: 'grok:account-b' })
      } finally {
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
      }
      await Promise.all([first, second])
      expect(scheduler.getTelemetry().providers.map(provider => provider.laneKey)).toEqual(['grok:account-a', 'grok:account-b'])
    })

  test('hosted TTS chunk scheduler uses independent caps for different providers', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 2, concurrencyMode: 'immediate' })
      const releases: Array<() => void> = []
      let releaseImmediately = false
      let inFlight = 0
      let maxInFlight = 0

      const runChunk = async (chunk: string): Promise<string> => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.push(resolve))
        }
        inFlight -= 1
        return chunk
      }

      const grok = runTtsChunks(['g1', 'g2'], runChunk, { provider: 'grok', scheduler })
      const openai = runTtsChunks(['o1', 'o2'], runChunk, { provider: 'openai', scheduler })
      const rethrowGatedAssertions = await captureGatedAssertions(async () => {
        await waitForCondition(() => releases.length === 4, 'different-provider scheduler did not use independent caps')
        expect(maxInFlight).toBe(4)
        expect(scheduler.getProviderSnapshot('grok').active).toBe(2)
        expect(scheduler.getProviderSnapshot('openai').active).toBe(2)
      }, () => {
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
      })

      await Promise.all([grok, openai])
      rethrowGatedAssertions()
    })

})
