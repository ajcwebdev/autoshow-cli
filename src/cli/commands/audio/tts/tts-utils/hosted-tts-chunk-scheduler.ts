import { drainProviderLane, extendProviderLanePause, LaneDrainLoop, LaneWakeTimer, reduceProviderLaneLimit, trimProviderLaneHistory } from '~/cli/commands/command-shared/provider-lane-drain'
import type {
  HostedConcurrencyAdmissionToken,
  HostedConcurrencyCoordinator,
  HostedTtsBatchCoordinator,
  HostedTtsChunkAdmissionToken,
  HostedTtsChunkJob,
  HostedTtsChunkRateLimitFeedback,
  HostedTtsChunkScheduler,
  HostedTtsChunkSchedulerOptions,
  HostedTtsChunkSchedulerSnapshot,
  HostedTtsProviderChunkState,
  HostedTtsRunChunksOptions,
  HostedTtsSchedulerLimitChange,
  HostedTtsSchedulerTelemetry,
  ProviderLaneCompletionStatus,
  TtsProvider
} from '~/types'
import { DEFAULT_TTS_CHUNK_CONCURRENCY } from '~/utils/concurrency-defaults'
import { createProviderLaneIdentity, DEFAULT_PROVIDER_LANE_SCOPE_LABEL } from '~/cli/commands/command-shared/provider-lane-contract'
import { createHostedConcurrencyCoordinator, recoverHostedConcurrencyRequest } from '~/cli/commands/command-shared/hosted-concurrency-coordinator'
import { beginHostedTtsChunk, buildHostedTtsCoreAdmission, createHostedTtsChunkJob, hasRemainingHostedTtsChunks, settleHostedTtsFailedJobIfInactive, settleHostedTtsJobIfComplete } from './hosted-tts-job-lifecycle'
import { projectHostedTtsProviderSnapshot, projectHostedTtsSchedulerTelemetry } from './hosted-tts-scheduler-telemetry'

const DEFAULT_RATE_LIMIT_PAUSE_MS = 2_000
const HOSTED_TTS_DEFAULT_SCOPE_LABEL = DEFAULT_PROVIDER_LANE_SCOPE_LABEL

export const normalizeHostedTtsChunkConcurrency = (concurrency: number | undefined): number => {
  if (typeof concurrency !== 'number' || !Number.isFinite(concurrency)) {
    return DEFAULT_TTS_CHUNK_CONCURRENCY
  }
  return Math.max(1, Math.trunc(concurrency))
}

const compareJobPriority = (
  left: HostedTtsChunkJob,
  right: HostedTtsChunkJob
): number => {
  return (left.originalOrder ?? left.internalId) - (right.originalOrder ?? right.internalId)
}

class HostedTtsBatchCoordinatorImpl implements HostedTtsBatchCoordinator {
  readonly #maxLimit: number
  readonly #maxActiveChunksPerJob: number | undefined
  readonly #defaultRateLimitPauseMs: number
  readonly #states = new Map<string, HostedTtsProviderChunkState>()
  readonly #admissionJobs = new WeakMap<HostedTtsChunkAdmissionToken, HostedTtsChunkJob>()
  readonly #registrationWaiters: Array<() => void> = []
  readonly #hostedConcurrencyCoordinator: HostedConcurrencyCoordinator
  readonly #coreAdmissions = new WeakMap<HostedTtsChunkAdmissionToken, HostedConcurrencyAdmissionToken>()
  readonly #drainLoopOwner = new LaneDrainLoop<HostedTtsProviderChunkState>()
  readonly #wake = new LaneWakeTimer<HostedTtsProviderChunkState>({ now: Date.now, setTimer: setTimeout, clearTimer: clearTimeout })
  #autoStart: boolean
  #started: boolean
  #nextJobId = 1
  #registeredJobCount = 0

  constructor(options: HostedTtsChunkSchedulerOptions = {}) {
    this.#maxLimit = normalizeHostedTtsChunkConcurrency(options.maxConcurrency)
    this.#maxActiveChunksPerJob = typeof options.maxActiveChunksPerJob === 'number'
      ? Math.max(1, Math.trunc(options.maxActiveChunksPerJob))
      : undefined
    this.#defaultRateLimitPauseMs = Math.max(0, Math.trunc(options.defaultRateLimitPauseMs ?? DEFAULT_RATE_LIMIT_PAUSE_MS))
    this.#autoStart = options.autoStart !== false
    this.#started = this.#autoStart
    this.#hostedConcurrencyCoordinator = options.hostedConcurrencyCoordinator
      ?? createHostedConcurrencyCoordinator({ mode: options.concurrencyMode ?? 'immediate' })
  }

  #getState(provider: TtsProvider, scopeLabel?: string | undefined): HostedTtsProviderChunkState {
    const lane = createProviderLaneIdentity(provider, scopeLabel, HOSTED_TTS_DEFAULT_SCOPE_LABEL)
    const existing = this.#states.get(lane.laneKey)
    if (existing) return existing

    const providerLimit = this.#maxLimit
    const state: HostedTtsProviderChunkState = {
      lane,
      provider,
      maxLimit: providerLimit,
      currentLimit: providerLimit,
      active: 0,
      jobs: [],
      allJobs: [],
      pauseUntilMs: 0,
      successStreak: 0,
      dispatchSequence: 0,
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
    this.#states.set(lane.laneKey, state)
    return state
  }

  #notifyRegistrationWaiters(): void {
    const waiters = this.#registrationWaiters.splice(0)
    for (const notify of waiters) {
      notify()
    }
  }

  #scheduleWake(state: HostedTtsProviderChunkState, waitMs: number): void {
    if (waitMs > 0) this.#wake.schedule(state, Date.now() + waitMs, () => this.#drain(state))
  }

  #removeSettledJobs(state: HostedTtsProviderChunkState): void {
    state.jobs = state.jobs.filter((job) => !job.settled || job.active > 0)
    if (!state.jobs.some(hasRemainingHostedTtsChunks)) this.#wake.clear(state)
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
    const runnable = state.jobs.filter(hasRemainingHostedTtsChunks)
    if (runnable.length === 0) {
      return undefined
    }

    const maxActiveChunksPerJob = this.#maxActiveChunksPerJob
    const eligible = maxActiveChunksPerJob === undefined
      ? runnable
      : runnable.filter((job) => job.active < maxActiveChunksPerJob)
    if (eligible.length === 0) {
      return undefined
    }

    const selected = eligible.slice().sort(compareJobPriority)[0]
    if (!selected) {
      return undefined
    }

    state.dispatchSequence += 1
    selected.dispatchDebt = 0
    selected.lastDispatchSequence = state.dispatchSequence
    return selected
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
      laneKey: state.lane.laneKey,
      previousLimit,
      nextLimit: state.currentLimit,
      reason
    })
    trimProviderLaneHistory(state.stats.limitChanges)
  }

  #recordSuccess(state: HostedTtsProviderChunkState): void {
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
    if (settleHostedTtsJobIfComplete(job)) this.#removeSettledJobs(state)
  }

  #settleFailedJobIfInactive(state: HostedTtsProviderChunkState, job: HostedTtsChunkJob): void {
    if (settleHostedTtsFailedJobIfInactive(job)) this.#removeSettledJobs(state)
  }

  #startChunk<T>(state: HostedTtsProviderChunkState, job: HostedTtsChunkJob<T>): Promise<void> {
    const { admission, activeStartedAtMs } = beginHostedTtsChunk(state, job)
    this.#admissionJobs.set(admission, job)

    return new Promise<void>((resolveEntered) => {
      let entered = false
      const markEntered = (): void => {
        if (entered) return
        entered = true
        resolveEntered()
      }

      void this.#executeChunk(state, job, admission, activeStartedAtMs, markEntered)
    })
  }

  async #executeChunk<T>(
    state: HostedTtsProviderChunkState,
    job: HostedTtsChunkJob<T>,
    admission: HostedTtsChunkAdmissionToken,
    activeStartedAtMs: number,
    markEntered: () => void
  ): Promise<void> {
    let succeeded = false
    try {
      {
        const coreAdmission = await this.#hostedConcurrencyCoordinator.acquire(buildHostedTtsCoreAdmission(state, job, admission))
        this.#coreAdmissions.set(admission, coreAdmission)
      }
      const runPromise = job.runChunk(job.chunks[admission.chunkIndex] as string, admission.chunkIndex, admission)
      markEntered()
      job.results[admission.chunkIndex] = await runPromise
      this.#releaseCoreAdmission(admission, 'succeeded')
      succeeded = true
      job.completedChunks += 1
      state.stats.completedChunks += 1
    } catch (error) {
      markEntered()
      this.#releaseCoreAdmission(admission, job.abortSignal?.aborted === true ? 'canceled' : 'failed')
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
        this.#recordSuccess(state)
      }
      this.#settleFailedJobIfInactive(state, job)
      this.#settleJobIfComplete(state, job)
      this.#drain(state)
    }
  }

  #releaseCoreAdmission(admission: HostedTtsChunkAdmissionToken, status: ProviderLaneCompletionStatus): void {
    const coreAdmission = this.#coreAdmissions.get(admission)
    if (coreAdmission) this.#hostedConcurrencyCoordinator.release(coreAdmission, status)
    this.#coreAdmissions.delete(admission)
  }

  #drain(state: HostedTtsProviderChunkState): void {
    this.#drainLoopOwner.run(state, () => this.#drainLoop(state))
  }

  async #drainLoop(state: HostedTtsProviderChunkState): Promise<void> {
    if (!this.#started) {
      return
    }

    this.#removeSettledJobs(state)

    const waitMs = state.pauseUntilMs - Date.now()
    if (waitMs > 0) {
      if (state.jobs.some(hasRemainingHostedTtsChunks)) {
        this.#scheduleWake(state, waitMs)
      }
      return
    }

    await drainProviderLane({
      canAdmit: () => state.active < state.currentLimit,
      pick: () => this.#selectJob(state),
      start: job => this.#startChunk(state, job),
    })
  }

  async runChunks<T>(
    provider: TtsProvider,
    chunks: readonly string[],
    runChunk: (chunk: string, index: number, admission: HostedTtsChunkAdmissionToken) => Promise<T>,
    options: HostedTtsRunChunksOptions = {}
  ): Promise<T[]> {
    options.abortSignal?.throwIfAborted()
    if (chunks.length === 0) {
      return []
    }

    const state = this.#getState(provider, options.scopeLabel)
    const internalId = this.#nextJobId
    this.#nextJobId += 1
    const job = createHostedTtsChunkJob(state, internalId, chunks, runChunk, options)

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

  notifyRetry(admission: HostedTtsChunkAdmissionToken): void {
    const job = this.#admissionJobs.get(admission)
    if (!job) return
    const state = this.#states.get(job.lane.laneKey)
    if (!state) return
    state.stats.retryCount += 1
    job.retryCount += 1
  }

  usesSharedHostedRateLimitRecovery(): boolean {
    return true
  }

  notifyRateLimit(
    admission: HostedTtsChunkAdmissionToken,
    feedback: HostedTtsChunkRateLimitFeedback = {},
    error?: unknown
  ): Promise<boolean> {
    const job = this.#admissionJobs.get(admission)
    if (!job) return Promise.resolve(false)
    const state = this.#states.get(job.lane.laneKey)
    if (!state) return Promise.resolve(false)
    const coreAdmission = this.#coreAdmissions.get(admission)
    const previousLimit = state.currentLimit
    state.currentLimit = reduceProviderLaneLimit(state.currentLimit)
    state.successStreak = 0
    state.stats.rateLimitCount += 1
    job.rateLimitCount += 1
    this.#recordLimitChange(state, previousLimit, 'rate-limit')

    const pauseMs = feedback.retryAfterMs !== undefined
      ? feedback.retryAfterMs
      : feedback.delayMs !== undefined && feedback.delayMs > 0
        ? feedback.delayMs
        : this.#defaultRateLimitPauseMs
    const now = Date.now()
    const pause = extendProviderLanePause(state.pauseUntilMs, now, pauseMs)
    state.pauseUntilMs = pause.untilMs
    state.stats.pauseTimeMs += pause.addedMs
    this.#drain(state)
    if (coreAdmission && error !== undefined) {
      return recoverHostedConcurrencyRequest({
        coordinator: this.#hostedConcurrencyCoordinator,
        admission: buildHostedTtsCoreAdmission(state, job, admission),
        token: coreAdmission,
        error,
        pressure: {
          ...feedback,
          reason: feedback.reason ?? 'rate-limit',
          status: feedback.status ?? 429
        }
      }).then((replacement) => {
        this.#coreAdmissions.set(admission, replacement)
        return true
      }, (recoveryError: unknown) => {
        this.#coreAdmissions.delete(admission)
        throw recoveryError
      })
    }
    return Promise.resolve(false)
  }

  getProviderSnapshot(provider: TtsProvider, scopeLabel?: string | undefined): HostedTtsChunkSchedulerSnapshot {
    return projectHostedTtsProviderSnapshot(this.#getState(provider, scopeLabel), this.#hostedConcurrencyCoordinator, true)
  }

  getTelemetry(): HostedTtsSchedulerTelemetry {
    return projectHostedTtsSchedulerTelemetry(this.#states.values(), this.#hostedConcurrencyCoordinator, true)
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
  options: HostedTtsChunkSchedulerOptions = {}
): HostedTtsBatchCoordinator =>
  new HostedTtsBatchCoordinatorImpl({
    ...options,
    autoStart: options.autoStart ?? true
  })

export const bindHostedTtsChunkScheduler = (
  scheduler: HostedTtsChunkScheduler,
  binding: Pick<HostedTtsRunChunksOptions, 'job' | 'scopeLabel'>
): HostedTtsChunkScheduler => ({
  runChunks: async (provider, chunks, runChunk, options = {}) => await scheduler.runChunks(
    provider,
    chunks,
    runChunk,
    {
      ...options,
      job: {
        ...binding.job,
        ...options.job
      },
      scopeLabel: options.scopeLabel ?? binding.scopeLabel
    }
  ),
  notifyRateLimit: (admission, feedback, error) => scheduler.notifyRateLimit(admission, feedback, error),
  notifyRetry: (admission) => scheduler.notifyRetry(admission),
  usesSharedHostedRateLimitRecovery: () => scheduler.usesSharedHostedRateLimitRecovery(),
  getProviderSnapshot: (provider, scopeLabel) => scheduler.getProviderSnapshot(
    provider,
    scopeLabel ?? binding.scopeLabel
  ),
  getTelemetry: () => scheduler.getTelemetry()
})
