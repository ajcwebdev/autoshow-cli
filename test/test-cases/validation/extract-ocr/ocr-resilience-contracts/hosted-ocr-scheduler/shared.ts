import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { waitFor as sharedWaitFor } from '../../../../../test-utils/wait-for'
import type {
  Deferred,
  HostedOcrSchedulerAdmission,
  HostedOcrSchedulerLaneTelemetry,
  HostedOcrSchedulerSetTimer,
  HostedOcrSchedulerTargetTelemetry,
  HostedOcrSchedulerTelemetry,
  HostedOcrService,
  HostedOcrThroughputProfile,
  SchedulerClock
} from '~/types'

export const defer = <T = void>(): Deferred<T> => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

export const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 500
): Promise<void> => await sharedWaitFor(predicate, { timeoutMs, label: 'scheduler test condition' })

export const createSchedulerClock = (): SchedulerClock => {
  let now = 0
  let nextTimer = 1
  const timers = new Map<number, { at: number, callback: () => void }>()
  const setTimer: HostedOcrSchedulerSetTimer = (callback, delayMs) => {
    const timer = nextTimer
    nextTimer += 1
    timers.set(timer, {
      at: now + Math.max(0, delayMs),
      callback
    })
    return timer
  }
  const advance = async (durationMs: number): Promise<void> => {
    const target = now + durationMs
    while (true) {
      const next = [...timers.entries()].sort(
        (left, right) =>
          left[1].at - right[1].at || left[0] - right[0]
      )[0]
      if (!next || next[1].at > target) break
      now = next[1].at
      timers.delete(next[0])
      next[1].callback()
      await Promise.resolve()
    }
    now = target
    await Promise.resolve()
  }
  return {
    now: () => now,
    setTimer,
    advance,
    timerCount: () => timers.size
  }
}

export const admission = (
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

export const missingProfilePath = (): string =>
  join(
    process.cwd(),
    '.test-work',
    `autoshow-missing-ocr-profile-${crypto.randomUUID()}.json`
  )

export const buildThroughputProfile = (
  overrides: Partial<HostedOcrThroughputProfile> = {}
): HostedOcrThroughputProfile => ({
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
  sourceConfidence: 'healthy',
  ...overrides
})

export const withThroughputProfile = async <T>(
  profile: HostedOcrThroughputProfile,
  run: (profilePath: string) => Promise<T>
): Promise<T> => {
  const dir = join(
    process.cwd(),
    '.test-work',
    `hosted-ocr-scheduler-profile-${crypto.randomUUID()}`
  )
  const profilePath = join(dir, 'profiles.json')
  await mkdir(dir, { recursive: true })
  try {
    await writeFile(profilePath, JSON.stringify({ version: 2, profiles: [profile] }, null, 2))
    return await run(profilePath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export const buildTargetTelemetry = (
  overrides: Partial<HostedOcrSchedulerTargetTelemetry> = {}
): HostedOcrSchedulerTargetTelemetry => ({
  targetKey: 'gemini:gemini-3.5-flash',
  service: 'gemini',
  model: 'gemini-3.5-flash',
  status: 'succeeded',
  submittedPages: 12,
  completedPages: 12,
  failedPages: 0,
  share: 1,
  pagesPerMinute: 120,
  ...overrides
})

export const buildLaneTelemetry = (
  overrides: Partial<HostedOcrSchedulerLaneTelemetry> = {}
): HostedOcrSchedulerLaneTelemetry => ({
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
  targets: [buildTargetTelemetry()],
  ...overrides
})

export const buildSchedulerTelemetry = (
  overrides: Partial<HostedOcrSchedulerTelemetry> = {}
): HostedOcrSchedulerTelemetry => ({
  version: 1,
  mode: 'auto',
  documentPages: 12,
  lanes: [buildLaneTelemetry()],
  ...overrides
})

export { sleep }
