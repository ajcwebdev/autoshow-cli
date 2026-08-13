import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { describe, expect, test } from 'bun:test'
import {
  createHostedOcrScheduler,
  HOSTED_OCR_PROFILE_MAX_CAP_CEILING,
  resolveHostedOcrAutoMaxCap,
  resolveHostedOcrEstimateCap,
  resolveHostedOcrLaneKey
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler'
import {
  findHostedOcrThroughputProfile,
  persistHostedOcrThroughputProfiles
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-throughput-profiles'
import type { HostedOcrSchedulerAdmission, HostedOcrSchedulerTelemetry, HostedOcrService } from '~/types'

const defer = <T = void>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
} => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 500
): Promise<void> => {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for scheduler test condition')
    }
    await sleep(1)
  }
}

const admission = (
  service: HostedOcrService,
  model: string,
  targetKey = `${service}:${model}`,
  pageCount = 1
): HostedOcrSchedulerAdmission => ({
  service,
  model,
  targetKey,
  pageCount
})

const missingProfilePath = (): string =>
  join(tmpdir(), `autoshow-missing-ocr-profile-${process.pid}-${Date.now()}-${Math.random()}.json`)

describe('hosted OCR scheduler contracts', () => {
  test('auto cap formula and fixed estimate caps follow ADR bounds', () => {
      expect(resolveHostedOcrAutoMaxCap(1)).toBe(10)
      expect(resolveHostedOcrAutoMaxCap(100)).toBe(10)
      expect(resolveHostedOcrAutoMaxCap(121)).toBe(11)
      expect(resolveHostedOcrAutoMaxCap(10_000)).toBe(32)
      expect(resolveHostedOcrEstimateCap(199, 'auto')).toBe(13)
      expect(resolveHostedOcrEstimateCap(286, 'auto')).toBe(17)
      expect(resolveHostedOcrEstimateCap(1024, 'auto')).toBe(32)
      expect(resolveHostedOcrEstimateCap(1024, 'fixed', 7)).toBe(7)
      expect(resolveHostedOcrEstimateCap(1024, 'fixed', 0)).toBe(1)
      expect(resolveHostedOcrLaneKey('gemini')).toBe('gemini:env-api-key')
      const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 2, pageCount: 1 })
      expect(() => scheduler.getMaxConcurrency({
        ...admission('gemini', 'gemini-3.5-flash'),
        laneKey: 'gemini:mismatched-scope'
      })).toThrow('does not match its service and scope label')
    })

  test('large auto lanes start at the large-document estimate cap', async () => {
      const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 286, profilePath: missingProfilePath() })
      const gate = defer()
      const starts: number[] = []
      const runs = Array.from({ length: 40 }, (_, index) =>
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => {
          starts.push(index)
          await gate.promise
          return index
        })
      )

      try {
        await waitFor(() => starts.length === 17)
        expect(scheduler.snapshot().lanes[0]).toMatchObject({
          mode: 'auto',
          initialCap: 17,
          currentCap: 17,
          maxCap: 17,
          capSource: 'unprofiled',
          sourceConfidence: 'none'
        })
      } finally {
        gate.resolve()
      }

      await Promise.all(runs)
    })

  test('clean auto lanes fast-ramp until retry pressure disables fast-ramp', async () => {
      const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 196, profilePath: missingProfilePath() })

      await Promise.all(Array.from({ length: 5 }, (_, index) =>
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => index)
      ))
      expect(scheduler.snapshot().lanes[0]).toMatchObject({
        initialCap: 10,
        currentCap: 12,
        retryPressureCount: 0
      })

      scheduler.recordRetryPressure(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), {
        reason: 'rate-limit',
        status: 429
      })
      expect(scheduler.snapshot().lanes[0]).toMatchObject({
        currentCap: 6,
        retryPressureCount: 1
      })

      await Promise.all(Array.from({ length: 3 }, (_, index) =>
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => index)
      ))
      expect(scheduler.snapshot().lanes[0]?.currentCap).toBe(6)

      await Promise.all(Array.from({ length: 3 }, (_, index) =>
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => index)
      ))
      expect(scheduler.snapshot().lanes[0]?.currentCap).toBe(7)
    })

  test('profile-raised caps can exceed unprofiled auto caps but fixed caps ignore profiles', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-profile-cap-'))
      const profilePath = join(tempDir, 'profiles.json')

      try {
        await writeFile(profilePath, JSON.stringify({
          version: 2,
          profiles: [{
            provider: 'gemini',
            model: 'gemini-3.5-flash',
            scopeClass: 'env-api-key',
            pageCountBand: '201-1000',
            ocrConcurrencyMode: 'auto',
            throughputPagesPerMinute: 900,
            activePeak: 46,
            retryPressureCount: 0,
            pauseTimeMs: 0,
            completionStatus: 'full',
            firstSeenAt: '2026-07-11T12:00:00.000Z',
            lastSeenAt: '2026-07-11T12:00:00.000Z',
            sampleCount: 1,
            cleanSampleCount: 1,
            raisedMaxCap: 99,
            capSource: 'exact-clean-sample',
            sourceConfidence: 'healthy'
          }]
        }, null, 2))

        const autoScheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 286, profilePath })
        const fixedScheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 7, pageCount: 286, profilePath })

        expect(autoScheduler.getMaxConcurrency(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'))).toBe(HOSTED_OCR_PROFILE_MAX_CAP_CEILING)
        expect(fixedScheduler.getMaxConcurrency(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'))).toBe(7)

        await autoScheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => 'ok')
        expect(autoScheduler.snapshot().lanes[0]).toMatchObject({
          initialCap: 17,
          maxCap: HOSTED_OCR_PROFILE_MAX_CAP_CEILING,
          capSource: 'profile',
          sourceConfidence: 'healthy',
          profileSampleCount: 1,
          profileRaisedMaxCap: HOSTED_OCR_PROFILE_MAX_CAP_CEILING
        })
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('unpromoted throughput profiles expose why the lane cap stayed unprofiled', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-profile-cap-reason-'))
      const profilePath = join(tempDir, 'profiles.json')

      try {
        await writeFile(profilePath, JSON.stringify({
          version: 2,
          profiles: [{
            provider: 'kimi',
            model: 'kimi-k2.6',
            scopeClass: 'env-api-key',
            pageCountBand: '201-1000',
            ocrConcurrencyMode: 'auto',
            throughputPagesPerMinute: 50,
            activePeak: 16,
            retryPressureCount: 0,
            pauseTimeMs: 0,
            completionStatus: 'full',
            firstSeenAt: '2026-07-12T18:55:00.000Z',
            lastSeenAt: '2026-07-12T18:55:00.000Z',
            sampleCount: 3,
            cleanSampleCount: 3,
            raisedMaxCap: 16,
            capSource: 'exact-clean-sample',
            sourceConfidence: 'healthy'
          }]
        }, null, 2))

        const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 228, profilePath })
        await scheduler.run(admission('kimi', 'kimi-k2.6', 'kimi:kimi-k2.6'), async () => 'ok')

        expect(scheduler.snapshot().lanes[0]).toMatchObject({
          capSource: 'unprofiled',
          sourceConfidence: 'healthy',
          profileSampleCount: 3,
          profileDisqualificationReason: 'profile-cap-not-above-auto-cap'
        })
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('Kimi profiles with historical retry pressure stay healthy but do not promote high caps', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-profile-clean-history-'))
      const profilePath = join(tempDir, 'profiles.json')

      try {
        await writeFile(profilePath, JSON.stringify({
          version: 2,
          profiles: [{
            provider: 'kimi',
            model: 'kimi-k2.6',
            scopeClass: 'env-api-key',
            pageCountBand: '201-1000',
            ocrConcurrencyMode: 'auto',
            laneTargetCount: 1,
            throughputPagesPerMinute: 44,
            activePeak: 20,
            retryPressureCount: 1,
            pauseTimeMs: 250,
            completionStatus: 'full',
            firstSeenAt: '2026-07-12T18:55:00.000Z',
            lastSeenAt: '2026-07-12T19:21:00.000Z',
            sampleCount: 4,
            cleanSampleCount: 1,
            raisedMaxCap: 22,
            capSource: 'exact-clean-sample',
            sourceConfidence: 'healthy'
          }]
        }, null, 2))

        const estimate = findHostedOcrThroughputProfile({
          provider: 'kimi',
          model: 'kimi-k2.6',
          pageCount: 312,
          ocrConcurrencyMode: 'auto',
          laneTargetCount: 1,
          profilePath
        })
        expect(estimate?.confidence).toBe('healthy')

        const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 312, profilePath })
        await scheduler.run(admission('kimi', 'kimi-k2.6', 'kimi:kimi-k2.6'), async () => 'ok')

        expect(scheduler.snapshot().lanes[0]).toMatchObject({
          maxCap: 18,
          capSource: 'unprofiled',
          sourceConfidence: 'healthy',
          profileSampleCount: 4,
          profileDisqualificationReason: 'kimi-profile-retry-pressure'
        })
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('Kimi high profile caps require repeated clean samples', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-profile-kimi-clean-samples-'))
      const profilePath = join(tempDir, 'profiles.json')

      try {
        await writeFile(profilePath, JSON.stringify({
          version: 2,
          profiles: [{
            provider: 'kimi',
            model: 'kimi-k2.6',
            scopeClass: 'env-api-key',
            pageCountBand: '51-200',
            ocrConcurrencyMode: 'auto',
            laneTargetCount: 1,
            throughputPagesPerMinute: 52,
            activePeak: 11,
            retryPressureCount: 0,
            pauseTimeMs: 0,
            completionStatus: 'full',
            firstSeenAt: '2026-07-12T18:55:00.000Z',
            lastSeenAt: '2026-07-12T18:55:00.000Z',
            sampleCount: 1,
            cleanSampleCount: 1,
            raisedMaxCap: 13,
            capSource: 'exact-clean-sample',
            sourceConfidence: 'healthy'
          }]
        }, null, 2))

        const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 121, profilePath })
        await scheduler.run(admission('kimi', 'kimi-k2.6', 'kimi:kimi-k2.6'), async () => 'ok')

        expect(scheduler.snapshot().lanes[0]).toMatchObject({
          maxCap: 11,
          capSource: 'unprofiled',
          sourceConfidence: 'healthy',
          profileSampleCount: 1,
          profileDisqualificationReason: 'kimi-profile-needs-clean-samples'
        })
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('Kimi current retry pressure demotes profile caps and records page-level timeout telemetry', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-profile-kimi-current-pressure-'))
      const profilePath = join(tempDir, 'profiles.json')

      try {
        await writeFile(profilePath, JSON.stringify({
          version: 2,
          profiles: [{
            provider: 'kimi',
            model: 'kimi-k2.6',
            scopeClass: 'env-api-key',
            pageCountBand: '201-1000',
            ocrConcurrencyMode: 'auto',
            laneTargetCount: 1,
            throughputPagesPerMinute: 54,
            activePeak: 20,
            retryPressureCount: 0,
            pauseTimeMs: 0,
            completionStatus: 'full',
            firstSeenAt: '2026-07-12T18:55:00.000Z',
            lastSeenAt: '2026-07-12T18:55:00.000Z',
            sampleCount: 3,
            cleanSampleCount: 3,
            raisedMaxCap: 22,
            capSource: 'exact-clean-sample',
            sourceConfidence: 'healthy'
          }]
        }, null, 2))

        const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 312, profilePath })
        await scheduler.run({
          ...admission('kimi', 'kimi-k2.6', 'kimi:kimi-k2.6'),
          pageNumber: 9
        }, async ({ onRetryable }) => {
          onRetryable({
            reason: 'timeout',
            delayMs: 125
          })
          return 'ok'
        })

        const lane = scheduler.snapshot().lanes[0]
        expect(lane).toMatchObject({
          maxCap: 18,
          capSource: 'unprofiled',
          profileDisqualificationReason: 'kimi-current-retry-pressure',
          retryPressureCount: 1,
          retryEvents: [{
            reason: 'timeout',
            targetKey: 'kimi:kimi-k2.6',
            pageNumber: 9,
            delayMs: 125,
            effectiveCap: 9
          }]
        })
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('explicit fixed caps are hard lane maxima while retry pressure can back off below them', async () => {
      const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 4, pageCount: 50 })
      const gate = defer()
      const starts: number[] = []

      scheduler.recordRetryPressure(admission('gemini', 'gemini-3.5-flash'), {
        reason: 'rate-limit',
        status: 429
      })
      const runs = Array.from({ length: 8 }, (_, index) =>
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => {
          starts.push(index)
          await gate.promise
          return index
        })
      )

      try {
        await waitFor(() => starts.length === 2)
        const backedOffLane = scheduler.snapshot().lanes[0]
        expect(backedOffLane).toMatchObject({
          mode: 'fixed',
          initialCap: 4,
          currentCap: 2,
          maxCap: 4,
          activePeak: 2,
          retryPressureCount: 1
        })
      } finally {
        gate.resolve()
      }

      await Promise.all(runs)
      const lane = scheduler.snapshot().lanes[0]
      expect(lane?.maxCap).toBe(4)
      expect(lane?.activePeak ?? 0).toBeLessThanOrEqual(4)
      expect(lane?.status).toBe('succeeded')
    })

  test('same-provider hosted targets share one provider/API-key lane', async () => {
      const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 2, pageCount: 6 })
      const gate = defer()
      const starts: string[] = []
      const runs = [
        ...Array.from({ length: 3 }, (_, index) =>
          scheduler.run(admission('gemini', 'gemini-3.5-flash', 'flash'), async () => {
            starts.push(`flash-${index}`)
            await gate.promise
            return index
          })
        ),
        ...Array.from({ length: 3 }, (_, index) =>
          scheduler.run(admission('gemini', 'gemini-3.1-flash-lite', 'lite'), async () => {
            starts.push(`lite-${index}`)
            await gate.promise
            return index
          })
        )
      ]

      try {
        await waitFor(() => starts.length === 2)
        const snapshot = scheduler.snapshot()
        expect(snapshot.lanes).toHaveLength(1)
        expect(snapshot.lanes[0]).toMatchObject({
          laneKey: 'gemini:env-api-key',
          activePeak: 2,
          submittedPages: 6
        })
      } finally {
        await sleep(5)
        gate.resolve()
      }

      await Promise.all(runs)
      const lane = scheduler.snapshot().lanes[0]
      expect(lane?.targets).toHaveLength(2)
      expect(lane?.completedPages).toBe(6)
      expect(lane?.targets.map((target) => target.share).sort()).toEqual([0.5, 0.5])
      expect(lane?.targets.every((target) => target.status === 'succeeded')).toBe(true)
      expect(lane?.pagesPerMinute).toEqual(expect.any(Number))
    })

  test('run-scoped document adapters share one hard provider cap across documents', async () => {
      const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 2, pageCount: 0, lifetime: 'run' })
      const firstDocument = scheduler.createDocumentScope(4)
      const secondDocument = scheduler.createDocumentScope(6)
      const gate = defer()
      let active = 0
      let maxActive = 0
      const runPage = async (value: string): Promise<string> => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await gate.promise
        active -= 1
        return value
      }
      const runs = [
        ...Array.from({ length: 4 }, (_, index) => firstDocument.run(admission('gemini', 'gemini-3.5-flash'), async () => await runPage(`a-${index}`))),
        ...Array.from({ length: 6 }, (_, index) => secondDocument.run(admission('gemini', 'gemini-3.5-flash'), async () => await runPage(`b-${index}`)))
      ]

      try {
        await waitFor(() => active === 2)
        expect(maxActive).toBe(2)
        expect(scheduler.snapshot()).toMatchObject({
          lifetime: 'run',
          documentCount: 2,
          documentPages: 10,
          lanes: [{ activePeak: 2, currentCap: 2, maxCap: 2 }]
        })
      } finally {
        gate.resolve()
      }
      await Promise.all(runs)
      expect(maxActive).toBe(2)
      expect(scheduler.snapshot().lanes[0]?.targets.map(target => target.targetKey)).toEqual(['gemini:gemini-3.5-flash'])
      expect(firstDocument.snapshot()).toMatchObject({
        lifetime: 'run',
        documentCount: 1,
        documentPages: 4,
        lanes: [{ submittedPages: 4, completedPages: 4, targets: [{ completedPages: 4, share: 1 }] }]
      })
      expect(secondDocument.snapshot()).toMatchObject({
        lifetime: 'run',
        documentCount: 1,
        documentPages: 6,
        lanes: [{ submittedPages: 6, completedPages: 6, targets: [{ completedPages: 6, share: 1 }] }]
      })
    })

  test('different hosted providers run independent lanes', async () => {
      const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 2, pageCount: 6 })
      const gate = defer()
      const starts: string[] = []
      const runs = [
        ...Array.from({ length: 3 }, (_, index) =>
          scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini'), async () => {
            starts.push(`gemini-${index}`)
            await gate.promise
            return index
          })
        ),
        ...Array.from({ length: 3 }, (_, index) =>
          scheduler.run(admission('openai', 'gpt-5.4-nano', 'openai'), async () => {
            starts.push(`openai-${index}`)
            await gate.promise
            return index
          })
        )
      ]

      try {
        await waitFor(() => starts.length === 4)
        const lanes = scheduler.snapshot().lanes
        expect(lanes).toHaveLength(2)
        expect(lanes.map((lane) => [lane.service, lane.activePeak]).sort()).toEqual([
          ['gemini', 2],
          ['openai', 2]
        ])
      } finally {
        gate.resolve()
      }

      await Promise.all(runs)
    })

  test('likely gating target includes failed partial targets by projected observed duration', async () => {
      const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 16, pageCount: 228 })
      const kimiFailure = new Error('Kimi OCR page 9 timed out after 10m')
      const runs = [
        scheduler.run(admission('kimi', 'kimi-latest', 'kimi:kimi-latest', 227), async () => {
          await sleep(5)
          return 'kimi-success-pages'
        }),
        scheduler.run(admission('kimi', 'kimi-latest', 'kimi:kimi-latest', 1), async () => {
          await sleep(30)
          throw kimiFailure
        }),
        scheduler.run(admission('deepinfra', 'mistral-small-ocr', 'deepinfra:mistral-small-ocr', 228), async () => {
          await sleep(10)
          return 'deepinfra'
        })
      ]

      const results = await Promise.allSettled(runs)
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

      const snapshot = scheduler.snapshot()
      expect(snapshot.likelyGatingTarget).toMatchObject({
        service: 'kimi',
        model: 'kimi-latest',
        status: 'failed',
        submittedPages: 228,
        completedPages: 227,
        failedPages: 1
      })
      const kimiLane = snapshot.lanes.find((lane) => lane.service === 'kimi')
      const deepinfraLane = snapshot.lanes.find((lane) => lane.service === 'deepinfra')
      expect(kimiLane?.status).toBe('failed')
      expect(deepinfraLane?.status).toBe('succeeded')
      expect(kimiLane?.targets[0]?.projectedObservedDurationMs ?? 0).toBeGreaterThan(deepinfraLane?.targets[0]?.projectedObservedDurationMs ?? 0)
    })

  test('Retry-After pauses only the affected lane', async () => {
      const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 1, pageCount: 2 })
      const starts: string[] = []

      scheduler.recordRetryPressure(admission('gemini', 'gemini-3.5-flash'), {
        reason: 'retry-after',
        status: 429,
        retryAfterMs: 30
      })
      const geminiRun = scheduler.run(admission('gemini', 'gemini-3.5-flash'), async () => {
        starts.push('gemini')
        return 'gemini'
      })
      const openaiRun = scheduler.run(admission('openai', 'gpt-5.4-nano'), async () => {
        starts.push('openai')
        return 'openai'
      })

      await waitFor(() => starts.includes('openai'))
      expect(starts).not.toContain('gemini')
      await waitFor(() => starts.includes('gemini'), 150)
      await Promise.all([geminiRun, openaiRun])

      const lanes = new Map(scheduler.snapshot().lanes.map((lane) => [lane.service, lane]))
      expect(lanes.get('gemini')).toMatchObject({
        retryPressureCount: 1
      })
      expect(lanes.get('gemini')?.pauseTimeMs ?? 0).toBeGreaterThanOrEqual(25)
      expect(lanes.get('openai')).toMatchObject({
        retryPressureCount: 0,
        pauseTimeMs: 0
      })
    })

  test('queued targets are admitted round-robin within a shared lane', async () => {
      const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 2, pageCount: 4 })
      const initialGate = defer()
      const followGate = defer()
      const starts: string[] = []

      const runs = [
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'a'), async () => {
          starts.push('a1')
          await initialGate.promise
          return 'a1'
        }),
        scheduler.run(admission('gemini', 'gemini-3.1-flash-lite', 'b'), async () => {
          starts.push('b1')
          await initialGate.promise
          return 'b1'
        })
      ]

      await waitFor(() => starts.length === 2)
      runs.push(
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'a'), async () => {
          starts.push('a2')
          await followGate.promise
          return 'a2'
        }),
        scheduler.run(admission('gemini', 'gemini-3.1-flash-lite', 'b'), async () => {
          starts.push('b2')
          await followGate.promise
          return 'b2'
        })
      )
      await sleep(5)
      expect(starts).toEqual(['a1', 'b1'])

      initialGate.resolve()
      await waitFor(() => starts.length === 4)
      expect(starts).toEqual(['a1', 'b1', 'a2', 'b2'])
      followGate.resolve()
      await Promise.all(runs)
    })

  test('profile storage persists only privacy-preserving throughput fields', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-profiles-'))
      const profilePath = join(tempDir, 'profiles.json')
      const snapshot: HostedOcrSchedulerTelemetry = {
        version: 1,
        mode: 'auto',
        documentPages: 12,
        lanes: [{
          laneKey: 'gemini:env-api-key',
          service: 'gemini',
          scopeLabel: 'env-api-key',
          status: 'succeeded',
          mode: 'auto',
          initialCap: 10,
          currentCap: 12,
          maxCap: 12,
          activePeak: 11,
          retryPressureCount: 0,
          pauseTimeMs: 0,
          submittedPages: 12,
          completedPages: 12,
          failedPages: 0,
          pagesPerMinute: 120,
          targets: [{
            targetKey: 'gemini:gemini-3.5-flash',
            service: 'gemini',
            model: 'gemini-3.5-flash',
            status: 'succeeded',
            submittedPages: 12,
            completedPages: 12,
            failedPages: 0,
            share: 1,
            pagesPerMinute: 120
          }]
        }]
      }

      try {
        await persistHostedOcrThroughputProfiles(snapshot, {
          completionStatus: 'full',
          profilePath,
          now: new Date('2026-07-11T12:00:00.000Z')
        })
        await persistHostedOcrThroughputProfiles(snapshot, {
          completionStatus: 'full',
          profilePath,
          now: new Date('2026-07-11T12:01:00.000Z')
        })
        await persistHostedOcrThroughputProfiles(snapshot, {
          completionStatus: 'full',
          profilePath,
          now: new Date('2026-07-11T12:02:00.000Z')
        })

        const store = JSON.parse(await readFile(profilePath, 'utf-8')) as {
          profiles: Array<Record<string, unknown>>
        }
        const profile = store.profiles[0]
        expect(profile).toMatchObject({
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          scopeClass: 'env-api-key',
          pageCountBand: '11-50',
          ocrConcurrencyMode: 'auto',
          laneTargetCount: 1,
          throughputPagesPerMinute: 120,
          activePeak: 11,
          retryPressureCount: 0,
          pauseTimeMs: 0,
          completionStatus: 'full',
          sampleCount: 3,
          cleanSampleCount: 3,
          raisedMaxCap: 14,
          capSource: 'exact-clean-sample',
          sourceConfidence: 'healthy'
        })
        expect(Object.keys(profile ?? {}).sort()).toEqual([
          'activePeak',
          'capSource',
          'cleanSampleCount',
          'completionStatus',
          'firstSeenAt',
          'laneTargetCount',
          'lastSeenAt',
          'model',
          'ocrConcurrencyMode',
          'pageCountBand',
          'pauseTimeMs',
          'provider',
          'raisedMaxCap',
          'retryPressureCount',
          'sampleCount',
          'scopeClass',
          'sourceConfidence',
          'throughputPagesPerMinute'
        ])
        expect(JSON.stringify(store)).not.toContain('input.pdf')
        expect(JSON.stringify(store)).not.toContain('sk-')

        const estimate = findHostedOcrThroughputProfile({
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          pageCount: 12,
          ocrConcurrencyMode: 'auto',
          profilePath
        })
        expect(estimate?.confidence).toBe('healthy')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('profile storage persists mixed run targets with target-level completion status', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-profiles-mixed-'))
      const profilePath = join(tempDir, 'profiles.json')
      const snapshot: HostedOcrSchedulerTelemetry = {
        version: 1,
        mode: 'auto',
        documentPages: 228,
        lanes: [{
          laneKey: 'gemini:env-api-key',
          service: 'gemini',
          scopeLabel: 'env-api-key',
          status: 'succeeded',
          mode: 'auto',
          initialCap: 10,
          currentCap: 16,
          maxCap: 16,
          activePeak: 16,
          retryPressureCount: 1,
          pauseTimeMs: 0,
          submittedPages: 456,
          completedPages: 456,
          failedPages: 0,
          pagesPerMinute: 200,
          targets: [{
            targetKey: 'gemini:flash',
            service: 'gemini',
            model: 'gemini-3.5-flash',
            status: 'succeeded',
            submittedPages: 228,
            completedPages: 228,
            failedPages: 0,
            share: 0.5,
            pagesPerMinute: 300
          }, {
            targetKey: 'gemini:lite',
            service: 'gemini',
            model: 'gemini-3.1-flash-lite',
            status: 'succeeded',
            submittedPages: 228,
            completedPages: 228,
            failedPages: 0,
            share: 0.5,
            pagesPerMinute: 150
          }]
        }, {
          laneKey: 'deepinfra:env-api-key',
          service: 'deepinfra',
          scopeLabel: 'env-api-key',
          status: 'succeeded',
          mode: 'auto',
          initialCap: 10,
          currentCap: 16,
          maxCap: 16,
          activePeak: 16,
          retryPressureCount: 0,
          pauseTimeMs: 0,
          submittedPages: 228,
          completedPages: 228,
          failedPages: 0,
          pagesPerMinute: 38,
          targets: [{
            targetKey: 'deepinfra:mistral-small-ocr',
            service: 'deepinfra',
            model: 'mistral-small-ocr',
            status: 'succeeded',
            submittedPages: 228,
            completedPages: 228,
            failedPages: 0,
            share: 1,
            pagesPerMinute: 38
          }]
        }, {
          laneKey: 'kimi:env-api-key',
          service: 'kimi',
          scopeLabel: 'env-api-key',
          status: 'failed',
          mode: 'auto',
          initialCap: 10,
          currentCap: 1,
          maxCap: 16,
          activePeak: 16,
          retryPressureCount: 1,
          pauseTimeMs: 0,
          submittedPages: 228,
          completedPages: 227,
          failedPages: 1,
          pagesPerMinute: 22.7,
          targets: [{
            targetKey: 'kimi:kimi-latest',
            service: 'kimi',
            model: 'kimi-latest',
            status: 'failed',
            submittedPages: 228,
            completedPages: 227,
            failedPages: 1,
            share: 1,
            pagesPerMinute: 22.7
          }]
        }]
      }

      try {
        await persistHostedOcrThroughputProfiles(snapshot, {
          completionStatus: 'incomplete',
          profilePath,
          now: new Date('2026-07-11T12:00:00.000Z')
        })
        const store = JSON.parse(await readFile(profilePath, 'utf-8')) as {
          profiles: Array<Record<string, unknown>>
        }
        const byModel = new Map(store.profiles.map((profile) => [profile['model'], profile]))
        expect(byModel.get('gemini-3.5-flash')?.['completionStatus']).toBe('full')
        expect(byModel.get('gemini-3.1-flash-lite')?.['completionStatus']).toBe('full')
        expect(byModel.get('mistral-small-ocr')?.['completionStatus']).toBe('full')
        expect(byModel.get('kimi-latest')?.['completionStatus']).toBe('incomplete')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
})
