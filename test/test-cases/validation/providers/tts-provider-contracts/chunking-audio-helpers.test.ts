import {
  describe,
  expect,
  test
} from 'bun:test'
import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { concatAndConvertToWav, runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { createHostedTtsBatchCoordinator, createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { configureBinDir, getConfiguredBinDir } from '~/utils/runtime-paths'
import { setupTtsContractLifecycle, waitForCondition } from './shared'

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
      let waitError: unknown

      try {
        await waitForCondition(() => releases.length === 2, 'same-provider scheduler did not start the first capped chunks')
        expect(maxInFlight).toBe(2)
        expect(scheduler.getProviderSnapshot('grok')).toMatchObject({
          maxLimit: 2,
          currentLimit: 2,
          active: 2
        })
      } catch (error) {
        waitError = error
      } finally {
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
      }

      const results = await Promise.all([first, second])
      if (waitError) throw waitError
      expect(maxInFlight).toBe(2)
      expect(results).toEqual([
        ['a1', 'a2', 'a3'],
        ['b1', 'b2', 'b3']
      ])
    })

  test('hosted TTS batch coordinator admits small jobs before large jobs registered in the same batch', async () => {
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
      let waitError: unknown

      try {
        expect(await scheduler.waitForRegisteredJobs(2, 100)).toBe(true)
        scheduler.start()
        await waitForCondition(() => started.length === 2, 'batch coordinator did not start initial fair chunks')
        expect(started).toEqual(['S1', 'L1'])
      } catch (error) {
        waitError = error
      } finally {
        releaseImmediately = true
        for (const release of releases.values()) release()
      }

      expect(await Promise.all([large, small])).toEqual([
        ['L1', 'L2', 'L3'],
        ['S1']
      ])
      if (waitError) throw waitError
    })

  test('hosted TTS batch coordinator enforces a per-job base window before overflow', async () => {
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
      let waitError: unknown

      try {
        expect(await scheduler.waitForRegisteredJobs(2, 100)).toBe(true)
        scheduler.start()
        await waitForCondition(() => started.length === 3, 'batch coordinator did not fill provider capacity')
        expect(started).toEqual(['A1', 'B1', 'A2'])
        expect(scheduler.getProviderSnapshot('grok').active).toBe(3)
      } catch (error) {
        waitError = error
      } finally {
        releaseImmediately = true
        for (const release of releases.values()) release()
      }

      await Promise.all([first, second])
      if (waitError) throw waitError
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
      let waitError: unknown

      try {
        await waitForCondition(() => releases.length === 4, 'different-provider scheduler did not use independent caps')
        expect(maxInFlight).toBe(4)
        expect(scheduler.getProviderSnapshot('grok').active).toBe(2)
        expect(scheduler.getProviderSnapshot('openai').active).toBe(2)
      } catch (error) {
        waitError = error
      } finally {
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
      }

      await Promise.all([grok, openai])
      if (waitError) throw waitError
    })

  test('hosted TTS chunk scheduler reduces provider limit and pauses new starts on 429 feedback', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 4, defaultRateLimitPauseMs: 30 })
      const starts: string[] = []
      const releases: Array<() => void> = []
      let releaseImmediately = false
      let rateLimited = false

      const runPromise = runTtsChunks(['a', 'b', 'c', 'd', 'e'], 4, async (chunk) => {
        starts.push(chunk)
        if (!rateLimited) {
          rateLimited = true
          scheduler.notifyRateLimit('grok', { retryAfterMs: 30 })
        }
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.push(resolve))
        }
        return chunk
      }, { provider: 'grok', scheduler })
      let waitError: unknown

      try {
        await waitForCondition(() => starts.length === 2, 'rate-limit test did not start the reduced-limit chunks')
        expect(scheduler.getProviderSnapshot('grok').currentLimit).toBe(2)
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
        await Bun.sleep(5)
        expect(starts).toHaveLength(2)
        await waitForCondition(() => starts.length === 5, 'rate-limit pause did not eventually reopen starts')
      } catch (error) {
        waitError = error
      } finally {
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
      }

      expect(await runPromise).toEqual(['a', 'b', 'c', 'd', 'e'])
      if (waitError) throw waitError
    })

  test('hosted TTS chunk scheduler gradually ramps successful providers back to the configured max', async () => {
      const scheduler = createHostedTtsChunkScheduler(4)

      scheduler.notifyRateLimit('grok', { retryAfterMs: 0 })
      expect(scheduler.getProviderSnapshot('grok').currentLimit).toBe(2)

      await scheduler.runChunks('grok', ['a', 'b'], async (chunk) => chunk)
      expect(scheduler.getProviderSnapshot('grok').currentLimit).toBe(3)

      await scheduler.runChunks('grok', ['c', 'd', 'e'], async (chunk) => chunk)
      expect(scheduler.getProviderSnapshot('grok').currentLimit).toBe(4)
    })

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
