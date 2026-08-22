import {
  describe,
  expect,
  test
} from 'bun:test'
import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { concatAndConvertToWav, runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { bindHostedTtsChunkScheduler, createHostedTtsBatchCoordinator, createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { configureBinDir, getConfiguredBinDir } from '~/utils/runtime-paths'
import {
  captureGatedAssertions,
  setupTtsContractLifecycle,
  waitForCondition
} from './shared'
import { requireDefined } from '../../../../test-utils/value-assertions'

const { makeTempDir } = setupTtsContractLifecycle()

describe('TTS provider service contracts', () => {
  test('concat cleanup removes the temporary list when ffmpeg fails', async () => {
      const outputDir = await makeTempDir('concat-failure-')
      const fakeFfmpegPath = join(outputDir, 'ffmpeg')
      const concatListPath = join(outputDir, 'speech-testprovider-chunks.txt')
      const previousBinDir = getConfiguredBinDir()
      await Bun.write(fakeFfmpegPath, '#!/bin/sh\nprintf "forced concat failure" >&2\nexit 7\n')
      await chmod(fakeFfmpegPath, 0o755)
      configureBinDir(outputDir)

      try {
        await expect(concatAndConvertToWav([
          join(outputDir, 'chunk-1.mp3'),
          join(outputDir, 'chunk-2.mp3')
        ], outputDir, 'TestProvider')).rejects.toThrow(
          'Failed to concatenate TestProvider audio chunks: forced concat failure'
        )
        expect(await Bun.file(concatListPath).exists()).toBe(false)
      } finally {
        configureBinDir(previousBinDir ?? '')
      }
    })

  test('hosted TTS chunk scheduler shares one cap across simultaneous runs for the same provider', async () => {
      const scheduler = createHostedTtsChunkScheduler(2)
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

      const first = runTtsChunks(['a1', 'a2', 'a3'], 2, runChunk, { provider: 'grok', scheduler })
      const second = runTtsChunks(['b1', 'b2', 'b3'], 2, runChunk, { provider: 'grok', scheduler })
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
      const scheduler = createHostedTtsBatchCoordinator(2)
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

      const large = runTtsChunks(['L1', 'L2', 'L3'], 2, runChunk, {
        provider: 'grok',
        scheduler,
        job: { originalOrder: 0, label: 'large' }
      })
      const small = runTtsChunks(['S1'], 2, runChunk, {
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
      const scheduler = createHostedTtsBatchCoordinator(3)
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

      const first = runTtsChunks(['A1', 'A2', 'A3'], 3, runChunk, {
        provider: 'grok',
        scheduler,
        job: { originalOrder: 0 }
      })
      const second = runTtsChunks(['B1', 'B2', 'B3'], 3, runChunk, {
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
      const scheduler = createHostedTtsBatchCoordinator(6)
      const started: string[] = []
      const releases: Array<() => void> = []
      let releaseImmediately = false
      const runChunk = async (chunk: string): Promise<string> => {
        started.push(chunk)
        if (!releaseImmediately) await new Promise<void>((resolve) => releases.push(resolve))
        return chunk
      }
      const runs = ['A', 'B', 'C'].map((prefix, originalOrder) =>
        runTtsChunks(Array.from({ length: 5 }, (_, index) => `${prefix}${index + 1}`), 6, runChunk, {
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
      const scheduler = createHostedTtsBatchCoordinator(1)
      const started: string[] = []
      const releases: Array<() => void> = []
      let secondShort: Promise<string[]> | undefined
      const long = runTtsChunks(['L1', 'L2', 'L3'], 1, async (chunk) => {
        started.push(chunk)
        await new Promise<void>((resolve) => releases.push(resolve))
        return chunk
      }, { provider: 'grok', scheduler, job: { originalOrder: 0, jobId: 'long' } })
      const firstShort = runTtsChunks(['S1'], 1, async (chunk) => {
        started.push(chunk)
        secondShort = runTtsChunks(['S2'], 1, async (nextChunk) => {
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

  test('hosted TTS admission tokens attribute retries and rate limits to the exact chunk job', async () => {
      const scheduler = createHostedTtsBatchCoordinator(2)
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
      const scheduler = createHostedTtsChunkScheduler(1)
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
      const scheduler = createHostedTtsChunkScheduler(2)
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
      const first = runTtsChunks(['A1', 'A2'], 2, runChunk, { provider: 'grok', scheduler, scopeLabel: 'account-a' })
      const second = runTtsChunks(['B1', 'B2'], 2, runChunk, { provider: 'grok', scheduler, scopeLabel: 'account-b' })

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
      const scheduler = createHostedTtsChunkScheduler(2)
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

      const grok = runTtsChunks(['g1', 'g2'], 2, runChunk, { provider: 'grok', scheduler })
      const openai = runTtsChunks(['o1', 'o2'], 2, runChunk, { provider: 'openai', scheduler })
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

  test('hosted TTS chunk scheduler reduces provider limit and pauses new starts on 429 feedback', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 4, defaultRateLimitPauseMs: 30 })
      const starts: string[] = []
      const releases: Array<() => void> = []
      let releaseImmediately = false
      let rateLimited = false

      const runPromise = runTtsChunks(['a', 'b', 'c', 'd', 'e'], 4, async (chunk, _index, admission) => {
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
      const scheduler = createHostedTtsChunkScheduler(4)
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
      const runPromise = runTtsChunks(['a', 'b'], 1, async (chunk) => {
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
      const scheduler = createHostedTtsChunkScheduler(2)
      const controller = new AbortController()
      const cancellation = new Error('cancel active hosted TTS chunks')
      const releases: Array<() => void> = []
      let starts = 0
      let settled = false
      let rejection: unknown

      const run = runTtsChunks(['a', 'b', 'must-not-start'], 2, async (chunk) => {
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
      const scheduler = createHostedTtsChunkScheduler(1)
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

  test('hosted TTS scheduler records provider and job telemetry', async () => {
      const scheduler = createHostedTtsChunkScheduler(2)

      await runTtsChunks(['a', 'b', 'c'], 2, async (chunk) => chunk, {
        provider: 'grok',
        scheduler,
        job: { jobId: 'job-a', inputIndex: 0, targetIndex: 0 }
      })

      const telemetry = scheduler.getTelemetry()
      expect(telemetry.providers).toHaveLength(1)
      expect(telemetry.providers[0]).toMatchObject({
        provider: 'grok',
        maxLimit: 2,
        startedChunks: 3,
        completedChunks: 3,
        failedChunks: 0,
        maxActive: 2
      })
      expect(telemetry.providers[0]?.queueWait.p95Ms).toBeGreaterThanOrEqual(0)
      expect(telemetry.jobs).toHaveLength(1)
      expect(telemetry.jobs[0]).toMatchObject({
        provider: 'grok',
        jobId: 'job-a',
        chunkCount: 3,
        completedChunks: 3,
        inputIndex: 0,
        targetIndex: 0
      })
    })
})
