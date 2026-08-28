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

  test('hosted TTS chunk scheduler shares one cap across simultaneous runs for the same provider', async () => {
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

      const first = runTtsChunks(['a1', 'a2', 'a3'], runChunk, { provider: 'grok', scheduler })
      const second = runTtsChunks(['b1', 'b2', 'b3'], runChunk, { provider: 'grok', scheduler })
      const rethrowGatedAssertions = await captureGatedAssertions(async () => {
        await waitForCondition(() => releases.length === 2, 'same-provider scheduler did not start the first capped chunks')
        expect(maxInFlight).toBe(2)
        expect(scheduler.getProviderSnapshot('grok')).toMatchObject({
          maxLimit: 2,
          currentLimit: 2,
          active: 2
        })
      }, () => {
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
      })

      const results = await Promise.all([first, second])
      rethrowGatedAssertions()
      expect(maxInFlight).toBe(2)
      expect(results).toEqual([
        ['a1', 'a2', 'a3'],
        ['b1', 'b2', 'b3']
      ])
    })

  test('hosted TTS batch coordinator dispatches the earliest job before later smaller jobs', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 2, concurrencyMode: 'immediate', autoStart: false })
      const started: string[] = []
      const releases = new Map<string, () => void>()
      let releaseImmediately = false

      const runChunk = async (chunk: string): Promise<string> => {
        started.push(chunk)
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.set(chunk, resolve))
        }
        return chunk
      }

      const large = runTtsChunks(['L1', 'L2', 'L3'], runChunk, {
        provider: 'grok',
        scheduler,
        job: { originalOrder: 0, label: 'large' }
      })
      const small = runTtsChunks(['S1'], runChunk, {
        provider: 'grok',
        scheduler,
        job: { originalOrder: 1, label: 'small' }
      })
      const rethrowGatedAssertions = await captureGatedAssertions(async () => {
        expect(await scheduler.waitForRegisteredJobs(2, 100)).toBe(true)
        scheduler.start()
        await waitForCondition(() => started.length === 2, 'batch coordinator did not fill capacity from the earliest job')
        expect(started).toEqual(['L1', 'L2'])
      }, () => {
        releaseImmediately = true
        for (const release of releases.values()) release()
      })

      expect(await Promise.all([large, small])).toEqual([
        ['L1', 'L2', 'L3'],
        ['S1']
      ])
      rethrowGatedAssertions()
    })

  test('hosted TTS batch coordinator fills provider capacity from the earliest job', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 3, concurrencyMode: 'immediate', autoStart: false })
      const started: string[] = []
      const releases = new Map<string, () => void>()
      let releaseImmediately = false

      const runChunk = async (chunk: string): Promise<string> => {
        started.push(chunk)
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.set(chunk, resolve))
        }
        return chunk
      }

      const first = runTtsChunks(['A1', 'A2', 'A3'], runChunk, {
        provider: 'grok',
        scheduler,
        job: { originalOrder: 0 }
      })
      const second = runTtsChunks(['B1', 'B2', 'B3'], runChunk, {
        provider: 'grok',
        scheduler,
        job: { originalOrder: 1 }
      })
      const rethrowGatedAssertions = await captureGatedAssertions(async () => {
        expect(await scheduler.waitForRegisteredJobs(2, 100)).toBe(true)
        scheduler.start()
        await waitForCondition(() => started.length === 3, 'batch coordinator did not fill provider capacity')
        expect(started).toEqual(['A1', 'A2', 'A3'])
        expect(scheduler.getProviderSnapshot('grok').active).toBe(3)
      }, () => {
        releaseImmediately = true
        for (const release of releases.values()) release()
      })

      await Promise.all([first, second])
      rethrowGatedAssertions()
    })

  test('hosted TTS batch coordinator moves forward only after all earlier-job chunks are dispatched', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 6, concurrencyMode: 'immediate', autoStart: false })
      const started: string[] = []
      const releases: Array<() => void> = []
      let releaseImmediately = false
      const runChunk = async (chunk: string): Promise<string> => {
        started.push(chunk)
        if (!releaseImmediately) await new Promise<void>((resolve) => releases.push(resolve))
        return chunk
      }
      const runs = ['A', 'B', 'C'].map((prefix, originalOrder) =>
        runTtsChunks(Array.from({ length: 5 }, (_, index) => `${prefix}${index + 1}`), runChunk, {
          provider: 'grok',
          scheduler,
          job: { originalOrder, jobId: `job-${prefix}` }
        })
      )

      try {
        expect(await scheduler.waitForRegisteredJobs(3, 100)).toBe(true)
        scheduler.start()
        await waitForCondition(() => started.length === 6, 'chapter-first scheduler did not fill the provider lane')
        expect(started).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'B1'])
      } finally {
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
      }

      await Promise.all(runs)
    })

  test('hosted TTS dispatch ordering is stable when later jobs arrive during execution', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 1, concurrencyMode: 'immediate', autoStart: false })
      const started: string[] = []
      const releases: Array<() => void> = []
      let secondShort: Promise<string[]> | undefined
      const long = runTtsChunks(['L1', 'L2', 'L3'], async (chunk) => {
        started.push(chunk)
        await new Promise<void>((resolve) => releases.push(resolve))
        return chunk
      }, { provider: 'grok', scheduler, job: { originalOrder: 0, jobId: 'long' } })
      const firstShort = runTtsChunks(['S1'], async (chunk) => {
        started.push(chunk)
        secondShort = runTtsChunks(['S2'], async (nextChunk) => {
          started.push(nextChunk)
          return nextChunk
        }, { provider: 'grok', scheduler, job: { originalOrder: 2, jobId: 'short-2' } })
        return chunk
      }, { provider: 'grok', scheduler, job: { originalOrder: 1, jobId: 'short-1' } })

      expect(await scheduler.waitForRegisteredJobs(2, 100)).toBe(true)
      scheduler.start()
      await waitForCondition(() => started.length === 1, 'ordered scheduler did not start the earliest job')
      expect(started).toEqual(['L1'])
      releases.shift()?.()
      await waitForCondition(() => started.length === 2, 'ordered scheduler did not continue the earliest job')
      expect(started).toEqual(['L1', 'L2'])
      releases.shift()?.()
      await waitForCondition(() => started.length === 3, 'ordered scheduler did not dispatch the final earliest-job chunk')
      expect(started).toEqual(['L1', 'L2', 'L3'])
      releases.shift()?.()
      await Promise.all([long, firstShort, secondShort as Promise<string[]>])
    })
})
