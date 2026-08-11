import type {
  HostedTtsBatchCoordinator,
  HostedTtsChunkJob,
  HostedTtsChunkRateLimitFeedback,
  HostedTtsChunkScheduler,
  HostedTtsChunkSchedulerOptions,
  HostedTtsChunkSchedulerSnapshot,
  HostedTtsMetricSummary,
  HostedTtsProviderChunkState,
  HostedTtsRunChunksOptions,
  HostedTtsSchedulerJobSummary,
  HostedTtsSchedulerLimitChange,
  HostedTtsSchedulerProviderSummary,
  HostedTtsSchedulerTelemetry,
  TtsProvider
} from '~/types'
import { DEFAULT_TTS_CHUNK_CONCURRENCY } from '~/utils/concurrency-defaults'

const DEFAULT_RATE_LIMIT_PAUSE_MS = 2_000

export const normalizeHostedTtsChunkConcurrency = (concurrency: number | undefined): number => {
  if (typeof concurrency !== 'number' || !Number.isFinite(concurrency)) {
    return DEFAULT_TTS_CHUNK_CONCURRENCY
  }
  return Math.max(1, Math.trunc(concurrency))
}

const emptyMetricSummary = (): HostedTtsMetricSummary => ({
  totalMs: 0,
  maxMs: 0,
  p50Ms: 0,
  p95Ms: 0
})

const percentile = (sortedSamples: readonly number[], percentileValue: number): number => {
  if (sortedSamples.length === 0) {
    return 0
  }
  const index = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sortedSamples.length) - 1)
  )
  return Math.round(sortedSamples[index] ?? 0)
}

const summarizeMetric = (samples: readonly number[]): HostedTtsMetricSummary => {
  if (samples.length === 0) {
    return emptyMetricSummary()
  }
  const sorted = samples.map((value) => Math.max(0, Math.round(value))).sort((a, b) => a - b)
  return {
    totalMs: sorted.reduce((sum, value) => sum + value, 0),
    maxMs: sorted[sorted.length - 1] ?? 0,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95)
  }
}

const hasRemainingChunks = (job: HostedTtsChunkJob): boolean =>
  !job.failed
  && !job.settled
  && job.abortSignal?.aborted !== true
  && job.nextChunkIndex < job.chunks.length

const remainingChunks = (job: HostedTtsChunkJob): number =>
  Math.max(0, job.chunks.length - job.completedChunks)

const compareJobPriority = (
  left: HostedTtsChunkJob,
  right: HostedTtsChunkJob
): number => {
  const leftRemaining = remainingChunks(left)
  const rightRemaining = remainingChunks(right)
  if (leftRemaining !== rightRemaining) {
    return leftRemaining - rightRemaining
  }
  if (left.active !== right.active) {
    return left.active - right.active
  }
  if (left.startedChunks !== right.startedChunks) {
    return left.startedChunks - right.startedChunks
  }
  if (left.lastSelectedAtMs !== right.lastSelectedAtMs) {
    return left.lastSelectedAtMs - right.lastSelectedAtMs
  }
  return (left.originalOrder ?? left.internalId) - (right.originalOrder ?? right.internalId)
}

export class HostedTtsBatchCoordinatorImpl implements HostedTtsBatchCoordinator {
  readonly #maxLimit: number
  readonly #defaultRateLimitPauseMs: number
  readonly #states = new Map<TtsProvider, HostedTtsProviderChunkState>()
  readonly #registrationWaiters: Array<() => void> = []
  #autoStart: boolean
  #started: boolean
  #nextJobId = 1
  #registeredJobCount = 0

  constructor(options: HostedTtsChunkSchedulerOptions | number | undefined = {}) {
    const normalizedOptions = typeof options === 'number'
      ? { maxConcurrency: options, autoStart: true }
      : options
    this.#maxLimit = normalizeHostedTtsChunkConcurrency(normalizedOptions?.maxConcurrency)
    this.#defaultRateLimitPauseMs = Math.max(0, Math.trunc(normalizedOptions?.defaultRateLimitPauseMs ?? DEFAULT_RATE_LIMIT_PAUSE_MS))
    this.#autoStart = normalizedOptions?.autoStart !== false
    this.#started = this.#autoStart
  }

  #getState(provider: TtsProvider): HostedTtsProviderChunkState {
    const existing = this.#states.get(provider)
    if (existing) return existing

    const state: HostedTtsProviderChunkState = {
      provider,
      maxLimit: this.#maxLimit,
      currentLimit: this.#maxLimit,
      active: 0,
      jobs: [],
      allJobs: [],
      pauseUntilMs: 0,
      successStreak: 0,
      stats: {
        startedChunks: 0,
        completedChunks: 0,
        failedChunks: 0,
        retryCount: 0,
        rateLimitCount: 0,
        maxActive: 0,
        queueWaitSamplesMs: [],
        activeLatencySamplesMs: [],
        pauseTimeMs: 0,
        limitChanges: []
      }
    }
    this.#states.set(provider, state)
    return state
  }

  #notifyRegistrationWaiters(): void {
    const waiters = this.#registrationWaiters.splice(0)
    for (const notify of waiters) {
      notify()
    }
  }

  #scheduleWake(state: HostedTtsProviderChunkState, waitMs: number): void {
    if (waitMs <= 0 || state.wakeTimer !== undefined) return
    state.wakeTimer = setTimeout(() => {
      state.wakeTimer = undefined
      this.#drain(state)
    }, waitMs)
  }

  #detachAbortListener(job: HostedTtsChunkJob): void {
    if (job.abortSignal && job.abortListener) {
      job.abortSignal.removeEventListener('abort', job.abortListener)
    }
    job.abortSignal = undefined
    job.abortListener = undefined
  }

  #removeSettledJobs(state: HostedTtsProviderChunkState): void {
    state.jobs = state.jobs.filter((job) => !job.settled || job.active > 0)
    if (!state.jobs.some(hasRemainingChunks) && state.wakeTimer !== undefined) {
      clearTimeout(state.wakeTimer)
      state.wakeTimer = undefined
    }
  }

  #cancelJob(state: HostedTtsProviderChunkState, job: HostedTtsChunkJob, reason: unknown): void {
    if (job.settled) {
      return
    }
    job.failed = true
    job.failureReason ??= reason
    this.#settleFailedJobIfInactive(state, job)
    this.#drain(state)
  }

  #selectJob(state: HostedTtsProviderChunkState): HostedTtsChunkJob | undefined {
    const baseEligible = state.jobs
      .filter((job) => hasRemainingChunks(job) && job.active === 0)
      .sort(compareJobPriority)
    if (baseEligible.length > 0) {
      return baseEligible[0]
    }

    return state.jobs
      .filter(hasRemainingChunks)
      .sort(compareJobPriority)[0]
  }

  #recordLimitChange(
    state: HostedTtsProviderChunkState,
    previousLimit: number,
    reason: HostedTtsSchedulerLimitChange['reason']
  ): void {
    if (previousLimit === state.currentLimit) {
      return
    }
    state.stats.limitChanges.push({
      atMs: Date.now(),
      provider: state.provider,
      previousLimit,
      nextLimit: state.currentLimit,
      reason
    })
  }

  #getAttributableJob(state: HostedTtsProviderChunkState): HostedTtsChunkJob | undefined {
    const activeJobs = state.allJobs
      .filter((job) => job.active > 0 && !job.settled)
      .sort((left, right) => right.lastSelectedAtMs - left.lastSelectedAtMs)
    return activeJobs[0]
  }

  #recordSuccess(provider: TtsProvider): void {
    const state = this.#getState(provider)
    if (state.currentLimit >= state.maxLimit) {
      state.successStreak = 0
      return
    }

    state.successStreak += 1
    if (state.successStreak >= Math.max(1, state.currentLimit)) {
      const previousLimit = state.currentLimit
      state.currentLimit = Math.min(state.maxLimit, state.currentLimit + 1)
      state.successStreak = 0
      this.#recordLimitChange(state, previousLimit, 'success-ramp')
      this.#drain(state)
    }
  }

  #settleJobIfComplete<T>(state: HostedTtsProviderChunkState, job: HostedTtsChunkJob<T>): void {
    if (
      job.settled
      || job.failed
      || job.active > 0
      || job.completedChunks < job.chunks.length
    ) {
      return
    }

    job.settled = true
    this.#detachAbortListener(job)
    job.resolve(job.results)
    this.#removeSettledJobs(state)
  }

  #settleFailedJobIfInactive(state: HostedTtsProviderChunkState, job: HostedTtsChunkJob): void {
    if (job.settled || !job.failed || job.active > 0) {
      return
    }

    job.settled = true
    this.#detachAbortListener(job)
    job.reject(job.failureReason ?? new Error('Hosted TTS chunk job failed'))
    this.#removeSettledJobs(state)
  }

  #startChunk<T>(state: HostedTtsProviderChunkState, job: HostedTtsChunkJob<T>): void {
    const chunkIndex = job.nextChunkIndex
    job.nextChunkIndex += 1
    job.startedChunks += 1
    job.active += 1
    job.lastSelectedAtMs = Date.now()

    state.active += 1
    state.stats.startedChunks += 1
    state.stats.maxActive = Math.max(state.stats.maxActive, state.active)

    const waitMs = Math.max(0, job.lastSelectedAtMs - job.registeredAtMs)
    job.queueWaitSamplesMs.push(waitMs)
    state.stats.queueWaitSamplesMs.push(waitMs)
    const activeStartedAtMs = Date.now()

    void (async () => {
      let succeeded = false
      try {
        job.results[chunkIndex] = await job.runChunk(job.chunks[chunkIndex] as string, chunkIndex)
        succeeded = true
        job.completedChunks += 1
        state.stats.completedChunks += 1
      } catch (error) {
        job.failed = true
        job.failureReason ??= error
        job.failedChunks += 1
        state.stats.failedChunks += 1
      } finally {
        const activeLatencyMs = Math.max(0, Date.now() - activeStartedAtMs)
        job.activeLatencySamplesMs.push(activeLatencyMs)
        state.stats.activeLatencySamplesMs.push(activeLatencyMs)
        job.active = Math.max(0, job.active - 1)
        state.active = Math.max(0, state.active - 1)

        if (succeeded && !job.failed) {
          this.#recordSuccess(job.provider)
        }
        this.#settleFailedJobIfInactive(state, job)
        this.#settleJobIfComplete(state, job)
        this.#drain(state)
      }
    })()
  }

  #drain(state: HostedTtsProviderChunkState): void {
    if (!this.#started) {
      return
    }

    this.#removeSettledJobs(state)

    const waitMs = state.pauseUntilMs - Date.now()
    if (waitMs > 0) {
      if (state.jobs.some(hasRemainingChunks)) {
        this.#scheduleWake(state, waitMs)
      }
      return
    }

    while (state.active < state.currentLimit) {
      const job = this.#selectJob(state)
      if (!job) {
        return
      }
      this.#startChunk(state, job)
    }
  }

  async runChunks<T>(
    provider: TtsProvider,
    chunks: readonly string[],
    runChunk: (chunk: string, index: number) => Promise<T>,
    options: HostedTtsRunChunksOptions = {}
  ): Promise<T[]> {
    options.abortSignal?.throwIfAborted()
    if (chunks.length === 0) {
      return []
    }

    const state = this.#getState(provider)
    const internalId = this.#nextJobId
    this.#nextJobId += 1
    const jobContext = options.job ?? {}
    const job: HostedTtsChunkJob<T> = {
      ...jobContext,
      internalId,
      jobId: jobContext.jobId ?? `${provider}-${internalId}`,
      provider,
      originalOrder: jobContext.originalOrder ?? internalId,
      chunks,
      runChunk,
      results: new Array<T>(chunks.length),
      registeredAtMs: Date.now(),
      nextChunkIndex: 0,
      active: 0,
      startedChunks: 0,
      completedChunks: 0,
      failedChunks: 0,
      retryCount: 0,
      rateLimitCount: 0,
      queueWaitSamplesMs: [],
      activeLatencySamplesMs: [],
      lastSelectedAtMs: 0,
      failed: false,
      settled: false,
      abortSignal: options.abortSignal,
      resolve: () => undefined,
      reject: () => undefined
    }

    state.jobs.push(job)
    state.allJobs.push(job)
    this.#registeredJobCount += 1
    this.#notifyRegistrationWaiters()

    const promise = new Promise<T[]>((resolve, reject) => {
      job.resolve = resolve
      job.reject = reject
    })

    const abortSignal = options.abortSignal
    if (abortSignal) {
      const abortListener = (): void => this.#cancelJob(
        state,
        job,
        abortSignal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
      )
      job.abortListener = abortListener
      abortSignal.addEventListener('abort', abortListener, { once: true })
      if (abortSignal.aborted) {
        abortListener()
      }
    }

    this.#drain(state)
    return await promise
  }

  notifyRetry(provider: TtsProvider): void {
    const state = this.#getState(provider)
    state.stats.retryCount += 1
    const job = this.#getAttributableJob(state)
    if (job) {
      job.retryCount += 1
    }
  }

  notifyRateLimit(
    provider: TtsProvider,
    feedback: HostedTtsChunkRateLimitFeedback = {}
  ): void {
    const state = this.#getState(provider)
    const previousLimit = state.currentLimit
    state.currentLimit = Math.max(1, Math.floor(state.currentLimit / 2))
    state.successStreak = 0
    state.stats.rateLimitCount += 1
    const job = this.#getAttributableJob(state)
    if (job) {
      job.rateLimitCount += 1
    }
    this.#recordLimitChange(state, previousLimit, 'rate-limit')

    const pauseMs = feedback.retryAfterMs !== undefined
      ? feedback.retryAfterMs
      : feedback.delayMs !== undefined && feedback.delayMs > 0
        ? feedback.delayMs
        : this.#defaultRateLimitPauseMs
    const now = Date.now()
    const nextPauseUntilMs = now + Math.max(0, pauseMs)
    const previousPauseUntilMs = state.pauseUntilMs
    state.pauseUntilMs = Math.max(state.pauseUntilMs, nextPauseUntilMs)
    state.stats.pauseTimeMs += Math.max(0, state.pauseUntilMs - Math.max(now, previousPauseUntilMs))
    this.#drain(state)
  }

  getProviderSnapshot(provider: TtsProvider): HostedTtsChunkSchedulerSnapshot {
    const state = this.#getState(provider)
    return {
      provider,
      maxLimit: state.maxLimit,
      currentLimit: state.currentLimit,
      active: state.active,
      queued: state.jobs.reduce(
        (sum, job) => hasRemainingChunks(job)
          ? sum + Math.max(0, job.chunks.length - job.nextChunkIndex)
          : sum,
        0
      ),
      pauseUntilMs: state.pauseUntilMs,
      successStreak: state.successStreak
    }
  }

  getTelemetry(): HostedTtsSchedulerTelemetry {
    const providers: HostedTtsSchedulerProviderSummary[] = []
    const jobs: HostedTtsSchedulerJobSummary[] = []

    for (const state of this.#states.values()) {
      providers.push({
        provider: state.provider,
        maxLimit: state.maxLimit,
        currentLimit: state.currentLimit,
        startedChunks: state.stats.startedChunks,
        completedChunks: state.stats.completedChunks,
        failedChunks: state.stats.failedChunks,
        retryCount: state.stats.retryCount,
        rateLimitCount: state.stats.rateLimitCount,
        maxActive: state.stats.maxActive,
        queueWait: summarizeMetric(state.stats.queueWaitSamplesMs),
        activeLatency: summarizeMetric(state.stats.activeLatencySamplesMs),
        pauseTimeMs: Math.round(state.stats.pauseTimeMs),
        limitChanges: state.stats.limitChanges.slice()
      })

      for (const job of state.allJobs) {
        jobs.push(this.#summarizeJob(job))
      }
    }

    return {
      providers: providers.sort((a, b) => a.provider.localeCompare(b.provider)),
      jobs: jobs.sort((a, b) => (a.originalOrder ?? 0) - (b.originalOrder ?? 0))
    }
  }

  #summarizeJob(job: HostedTtsChunkJob): HostedTtsSchedulerJobSummary {
    return {
      provider: job.provider,
      chunkCount: job.chunks.length,
      startedChunks: job.startedChunks,
      completedChunks: job.completedChunks,
      failedChunks: job.failedChunks,
      retryCount: job.retryCount,
      rateLimitCount: job.rateLimitCount,
      queueWait: summarizeMetric(job.queueWaitSamplesMs),
      activeLatency: summarizeMetric(job.activeLatencySamplesMs),
      ...(job.jobId ? { jobId: job.jobId } : {}),
      ...(job.label ? { label: job.label } : {}),
      ...(typeof job.inputIndex === 'number' ? { inputIndex: job.inputIndex } : {}),
      ...(typeof job.targetIndex === 'number' ? { targetIndex: job.targetIndex } : {}),
      ...(typeof job.segmentIndex === 'number' ? { segmentIndex: job.segmentIndex } : {}),
      ...(typeof job.originalOrder === 'number' ? { originalOrder: job.originalOrder } : {})
    }
  }

  start(): void {
    if (this.#started) {
      return
    }
    this.#started = true
    this.#autoStart = true
    for (const state of this.#states.values()) {
      this.#drain(state)
    }
  }

  isStarted(): boolean {
    return this.#started
  }

  getRegisteredJobCount(): number {
    return this.#registeredJobCount
  }

  async waitForRegisteredJobs(count: number, timeoutMs?: number | undefined): Promise<boolean> {
    const deadlineMs = timeoutMs === undefined ? undefined : Date.now() + Math.max(0, timeoutMs)
    while (this.#registeredJobCount < count) {
      const remainingMs = deadlineMs === undefined ? undefined : deadlineMs - Date.now()
      if (remainingMs !== undefined && remainingMs <= 0) {
        return false
      }

      await new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout> | undefined
        const done = (): void => {
          if (timer) {
            clearTimeout(timer)
          }
          const index = this.#registrationWaiters.indexOf(done)
          if (index >= 0) {
            this.#registrationWaiters.splice(index, 1)
          }
          resolve()
        }
        if (remainingMs !== undefined) {
          timer = setTimeout(done, remainingMs)
        }
        this.#registrationWaiters.push(done)
      })
    }

    return true
  }
}

export const createHostedTtsChunkScheduler = (
  optionsOrConcurrency?: HostedTtsChunkSchedulerOptions | number | undefined
): HostedTtsChunkScheduler =>
  new HostedTtsBatchCoordinatorImpl(
    typeof optionsOrConcurrency === 'number'
      ? { maxConcurrency: optionsOrConcurrency, autoStart: true }
      : { ...optionsOrConcurrency, autoStart: optionsOrConcurrency?.autoStart ?? true }
  )

export const createHostedTtsBatchCoordinator = (
  optionsOrConcurrency?: HostedTtsChunkSchedulerOptions | number | undefined
): HostedTtsBatchCoordinator =>
  new HostedTtsBatchCoordinatorImpl(
    typeof optionsOrConcurrency === 'number'
      ? { maxConcurrency: optionsOrConcurrency, autoStart: false }
      : { ...optionsOrConcurrency, autoStart: optionsOrConcurrency?.autoStart ?? false }
  )
