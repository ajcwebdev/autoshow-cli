import type {
  ClassState,
  HostedConcurrencyAdmission,
  HostedConcurrencyAdmissionToken,
  HostedConcurrencyCoordinator,
  HostedConcurrencyCoordinatorOptions,
  HostedConcurrencyMode,
  HostedConcurrencyPressureDecision,
  HostedConcurrencyPressureEvent,
  HostedConcurrencyRampTransition,
  HostedConcurrencyTelemetry,
  HostedConcurrencyWorkClass,
  LaneState,
  ProviderLaneCompletionStatus,
  ProviderLaneIdentity,
  ProviderLanePressureFeedback,
  RecoveryState,
  TokenState,
  Waiter
} from '~/types'
import { InternalError } from '~/utils/error-handler'
import { normalizePositiveInt } from '~/utils/value-helpers'
import { resolveHostedRecoveryBackoff } from './hosted-concurrency-recovery-policy'
import { projectHostedConcurrencyLane } from './hosted-concurrency-telemetry'
import { resolveHostedLaneRamp, resolveHostedReleaseOutcome, selectHostedLaneWaiter } from './hosted-lane-transition-policy'
import { createProviderLaneIdentity, DEFAULT_PROVIDER_LANE_SCOPE_LABEL } from './provider-lane-contract'

export { recoverHostedConcurrencyRequest, runHostedConcurrencyRequest } from './hosted-concurrency-request'
export { classifyHostedRateLimitPressure } from './hosted-rate-limit-pressure'

const DEFAULT_HOSTED_CONCURRENCY_MODE: HostedConcurrencyMode = 'ramp'
const HOSTED_CONCURRENCY_RAMP_INTERVAL_MS = 5_000
const HOSTED_CONCURRENCY_RECOVERY_BUDGET_MS = 5 * 60_000

const EVENT_HISTORY_LIMIT = 100

const recoveryKeyFor = (laneKey: string, workId: string, unitIndex: number): string =>
  `${laneKey}\u0000${workId}\u0000${unitIndex}`

const lanePrefix = (laneKey: string): string => `${laneKey}\u0000`

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')

const trimHistory = <T>(items: T[]): void => {
  if (items.length > EVENT_HISTORY_LIMIT) {
    items.splice(0, items.length - EVENT_HISTORY_LIMIT)
  }
}

class HostedConcurrencyCoordinatorImpl implements HostedConcurrencyCoordinator {
  readonly mode: HostedConcurrencyMode
  readonly #rampIntervalMs: number
  readonly #recoveryBudgetMs: number
  readonly #now: () => number
  readonly #random: () => number
  readonly #setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  readonly #clearTimer: (timer: ReturnType<typeof setTimeout>) => void
  readonly #lanes = new Map<string, LaneState>()
  readonly #tokens = new WeakMap<HostedConcurrencyAdmissionToken, TokenState>()
  readonly #recoveryByWork = new Map<string, RecoveryState>()
  #disposed = false
  #disposeReason: unknown

  constructor(options: HostedConcurrencyCoordinatorOptions = {}) {
    this.mode = options.mode ?? DEFAULT_HOSTED_CONCURRENCY_MODE
    this.#rampIntervalMs = Math.max(1, Math.floor(options.rampIntervalMs ?? HOSTED_CONCURRENCY_RAMP_INTERVAL_MS))
    this.#recoveryBudgetMs = Math.max(1, Math.floor(options.recoveryBudgetMs ?? HOSTED_CONCURRENCY_RECOVERY_BUDGET_MS))
    this.#now = options.now ?? Date.now
    this.#random = options.random ?? Math.random
    this.#setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs))
    this.#clearTimer = options.clearTimer ?? clearTimeout
  }

  async acquire(admission: HostedConcurrencyAdmission): Promise<HostedConcurrencyAdmissionToken> {
    admission.abortSignal?.throwIfAborted()
    if (this.#disposed) {
      throw this.#disposeReason ?? new DOMException('Hosted concurrency coordinator was disposed.', 'AbortError')
    }

    const lane = this.#getLane(admission)
    const classState = this.#getClassState(lane, admission.workClass, admission.configuredLimit)
    const recoveryKey = recoveryKeyFor(lane.lane.laneKey, admission.workId, admission.unitIndex)

    return await new Promise<HostedConcurrencyAdmissionToken>((resolve, reject) => {
      const waiter: Waiter = {
        admission,
        lane,
        classState,
        queuedAtMs: this.#now(),
        recoveryKey,
        resolve,
        reject
      }
      lane.waiters.push(waiter)
      lane.queuedPeak = Math.max(lane.queuedPeak, lane.waiters.length)

      if (admission.abortSignal) {
        const abortListener = (): void => {
          const index = lane.waiters.indexOf(waiter)
          if (index < 0) return
          lane.waiters.splice(index, 1)
          this.#detachAbort(waiter)
          reject(abortReason(admission.abortSignal as AbortSignal))
          this.#drain(lane)
        }
        waiter.abortListener = abortListener
        admission.abortSignal.addEventListener('abort', abortListener, { once: true })
        if (admission.abortSignal.aborted) {
          abortListener()
          return
        }
      }

      this.#drain(lane)
    })
  }

  release(token: HostedConcurrencyAdmissionToken, status: ProviderLaneCompletionStatus = 'succeeded'): void {
    const tokenState = this.#tokens.get(token)
    if (!tokenState || tokenState.released) return
    tokenState.released = true

    const { lane, classState } = tokenState
    lane.active = Math.max(0, lane.active - 1)
    classState.active = Math.max(0, classState.active - 1)
    if (status === 'succeeded') lane.completed += 1
    else if (status === 'canceled') lane.canceled += 1
    else lane.failed += 1

    const outcome = resolveHostedReleaseOutcome(tokenState, token.recoveryProbe, status)
    if (outcome.clearProbe) lane.recoveryProbeActive = false
    if (outcome.discardRecovery) {
      this.#recoveryByWork.delete(tokenState.recoveryKey)
      if (outcome.recordFailure) lane.recoveryFailures += 1
      this.#finishRecoveryIfDrained(lane)
    }
    if (outcome.finishRecovery) {
      this.#clearLaneRecovery(lane)
      lane.recovering = false
      lane.rampingAfterRecovery = lane.currentLimit < lane.configuredLimit
      this.#finishPause(lane)
      lane.pauseUntilMs = 0
      lane.nextRampAtMs = lane.rampingAfterRecovery && lane.waiters.length > 0
        ? this.#now() + this.#rampIntervalMs
        : undefined
    }

    this.#drain(lane)
  }

  async run<T>(
    admission: HostedConcurrencyAdmission,
    task: (token: HostedConcurrencyAdmissionToken) => Promise<T>
  ): Promise<T> {
    const token = await this.acquire(admission)
    try {
      const result = await task(token)
      this.release(token, 'succeeded')
      return result
    } catch (error) {
      this.release(token, admission.abortSignal?.aborted === true ? 'canceled' : 'failed')
      throw error
    }
  }

  reportRateLimit(
    token: HostedConcurrencyAdmissionToken,
    feedback: ProviderLanePressureFeedback
  ): HostedConcurrencyPressureDecision {
    const tokenState = this.#tokens.get(token)
    if (!tokenState || tokenState.released || tokenState.pressureReported) {
      return {
        retry: false,
        delayMs: 0,
        elapsedMs: 0,
        remainingBudgetMs: 0,
        pressureAttempt: 0,
        reason: 'recovery-budget-exhausted'
      }
    }
    tokenState.pressureReported = true

    const lane = tokenState.lane
    const now = this.#now()
    const recovery = this.#recoveryByWork.get(tokenState.recoveryKey) ?? {
      firstPressureAtMs: now,
      pressureAttempt: 0
    }
    recovery.pressureAttempt += 1
    this.#recoveryByWork.set(tokenState.recoveryKey, recovery)

    const { delayMs, elapsedMs, remainingBudgetMs } = resolveHostedRecoveryBackoff(
      recovery, feedback, now, this.#recoveryBudgetMs, this.#random()
    )

    this.#beginRateLimitRecovery(lane, token, feedback, now, delayMs)

    if (delayMs > remainingBudgetMs) {
      this.#exhaustRateLimitRecovery(lane, tokenState)
      this.#drain(lane)
      return {
        retry: false,
        delayMs,
        elapsedMs,
        remainingBudgetMs,
        pressureAttempt: recovery.pressureAttempt,
        reason: 'recovery-budget-exhausted'
      }
    }

    if (lane.pauseStartedAtMs === undefined) {
      lane.pauseStartedAtMs = now
    }
    lane.pauseUntilMs = Math.max(lane.pauseUntilMs, now + delayMs)
    tokenState.recoveryRetryApproved = true
    this.#drain(lane)
    return {
      retry: true,
      delayMs,
      elapsedMs,
      remainingBudgetMs,
      pressureAttempt: recovery.pressureAttempt
    }
  }

  #beginRateLimitRecovery(
    lane: LaneState,
    token: HostedConcurrencyAdmissionToken,
    feedback: ProviderLanePressureFeedback,
    now: number,
    delayMs: number
  ): void {
    const previousLimit = lane.currentLimit
    lane.currentLimit = Math.max(1, Math.floor(lane.currentLimit / 2))
    lane.recovering = true
    lane.rampingAfterRecovery = false
    lane.nextRampAtMs = undefined
    this.#recordTransition(lane, previousLimit, lane.currentLimit, 'rate-limit')

    const pressureEvent: HostedConcurrencyPressureEvent = {
      atMs: now,
      workId: token.workId,
      unitIndex: token.unitIndex,
      workClass: token.workClass,
      ...(typeof feedback.status === 'number' ? { status: feedback.status } : {}),
      reason: feedback.reason,
      ...(typeof feedback.retryAfterMs === 'number' ? { retryAfterMs: feedback.retryAfterMs } : {}),
      backoffMs: delayMs,
      previousLimit,
      nextLimit: lane.currentLimit
    }
    lane.pressureEvents.push(pressureEvent)
    trimHistory(lane.pressureEvents)

  }

  #exhaustRateLimitRecovery(lane: LaneState, tokenState: TokenState): void {
    lane.recoveryFailures += 1
    tokenState.recoveryFailureRecorded = true
    tokenState.recoveryRetryApproved = false
    this.#recoveryByWork.delete(tokenState.recoveryKey)
    if (![...this.#recoveryByWork.keys()].some((key) => key.startsWith(lanePrefix(lane.lane.laneKey)))) {
      lane.recovering = false
      lane.rampingAfterRecovery = lane.currentLimit < lane.configuredLimit
    }
  }

  snapshot(): HostedConcurrencyTelemetry {
    return {
      version: 1,
      mode: this.mode,
      lanes: [...this.#lanes.values()]
        .map((lane) => projectHostedConcurrencyLane(lane, this.#now()))
        .sort((left, right) => left.lane.laneKey.localeCompare(right.lane.laneKey))
    }
  }

  dispose(reason: unknown = new DOMException('Hosted concurrency coordinator was disposed.', 'AbortError')): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#disposeReason = reason
    for (const lane of this.#lanes.values()) {
      if (lane.wakeTimer !== undefined) {
        this.#clearTimer(lane.wakeTimer)
        lane.wakeTimer = undefined
        lane.wakeAtMs = undefined
      }
      const waiters = lane.waiters.splice(0)
      for (const waiter of waiters) {
        this.#detachAbort(waiter)
        waiter.reject(reason)
      }
    }
  }

  #resolveIdentity(admission: HostedConcurrencyAdmission): ProviderLaneIdentity {
    if (!admission.lane) {
      return createProviderLaneIdentity(
        admission.provider,
        admission.accountLabel,
        DEFAULT_PROVIDER_LANE_SCOPE_LABEL
      )
    }
    if (admission.lane.service !== admission.provider) {
      throw InternalError(`Hosted concurrency lane provider ${admission.lane.service} does not match admission provider ${admission.provider}.`, { stage: 'concurrency:lane', retryable: false })
    }
    const lane = createProviderLaneIdentity(
      admission.provider,
      admission.lane.scopeLabel,
      DEFAULT_PROVIDER_LANE_SCOPE_LABEL
    )
    if (lane.laneKey !== admission.lane.laneKey) {
      throw InternalError('Hosted concurrency lane key does not match its provider and account label.', { stage: 'concurrency:lane', retryable: false })
    }
    return lane
  }

  #getLane(admission: HostedConcurrencyAdmission): LaneState {
    const identity = this.#resolveIdentity(admission)
    const configuredLimit = normalizePositiveInt(admission.configuredLimit)
    const existing = this.#lanes.get(identity.laneKey)
    if (existing) {
      if (configuredLimit > existing.configuredLimit) {
        existing.configuredLimit = configuredLimit
        if (this.mode === 'immediate' && !existing.recovering && !existing.rampingAfterRecovery) {
          const previousLimit = existing.currentLimit
          existing.currentLimit = configuredLimit
          this.#recordTransition(existing, previousLimit, existing.currentLimit, 'registered-cap')
        }
      }
      return existing
    }

    const lane: LaneState = {
      lane: identity,
      configuredLimit,
      currentLimit: this.mode === 'ramp' ? 1 : configuredLimit,
      active: 0,
      activePeak: 0,
      queuedPeak: 0,
      admitted: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
      waiters: [],
      classes: new Map(),
      rampTransitions: [],
      pressureEvents: [],
      recovering: false,
      recoveryProbeActive: false,
      rampingAfterRecovery: false,
      pauseUntilMs: 0,
      pauseDurationMs: 0,
      recoveryProbes: 0,
      recoveryFailures: 0
    }
    this.#lanes.set(identity.laneKey, lane)
    return lane
  }

  #getClassState(lane: LaneState, workClass: HostedConcurrencyWorkClass, limit: number): ClassState {
    const configuredLimit = normalizePositiveInt(limit)
    const existing = lane.classes.get(workClass)
    if (existing) {
      existing.configuredLimit = Math.max(existing.configuredLimit, configuredLimit)
      return existing
    }
    const state: ClassState = { configuredLimit, active: 0, activePeak: 0 }
    lane.classes.set(workClass, state)
    return state
  }

  #drain(lane: LaneState): void {
    if (this.#disposed) return
    const now = this.#now()
    if (lane.pauseUntilMs > now) {
      this.#scheduleWake(lane, lane.pauseUntilMs)
      return
    }
    this.#finishPause(lane)

    while (lane.active < lane.currentLimit) {
      const waiterIndex = selectHostedLaneWaiter(lane, this.#recoveryByWork)
      if (waiterIndex < 0) break
      const [waiter] = lane.waiters.splice(waiterIndex, 1)
      if (!waiter) break
      this.#admit(waiter)
      if (lane.recovering) break
    }

    const decision = resolveHostedLaneRamp(lane, now, this.#rampIntervalMs)
    switch (decision.kind) {
      case 'idle':
        lane.nextRampAtMs = undefined
        this.#clearWake(lane)
        return
      case 'unchanged':
        return
      case 'wake':
        lane.nextRampAtMs = decision.atMs
        this.#scheduleWake(lane, decision.atMs)
        return
      case 'ramp': {
        const previousLimit = lane.currentLimit
        lane.currentLimit = decision.limit
        this.#recordTransition(lane, previousLimit, lane.currentLimit, decision.reason)
        lane.rampingAfterRecovery = decision.rampingAfterRecovery
        lane.nextRampAtMs = decision.nextRampAtMs
        this.#drain(lane)
      }
    }
  }

  #admit(waiter: Waiter): void {
    const { lane, classState, admission } = waiter
    this.#detachAbort(waiter)
    const recoveryProbe = lane.recovering && this.#recoveryByWork.has(waiter.recoveryKey)
    lane.active += 1
    lane.activePeak = Math.max(lane.activePeak, lane.active)
    lane.admitted += 1
    classState.active += 1
    classState.activePeak = Math.max(classState.activePeak, classState.active)
    if (recoveryProbe) {
      lane.recoveryProbeActive = true
      lane.recoveryProbes += 1
    }
    const token: HostedConcurrencyAdmissionToken = Object.freeze({
      lane: lane.lane,
      workId: admission.workId,
      unitIndex: admission.unitIndex,
      context: admission.context ?? {},
      workClass: admission.workClass,
      configuredLimit: normalizePositiveInt(admission.configuredLimit),
      admittedAtMs: this.#now(),
      recoveryProbe
    })
    this.#tokens.set(token, {
      lane,
      classState,
      recoveryKey: waiter.recoveryKey,
      released: false,
      pressureReported: false,
      recoveryRetryApproved: false,
      recoveryFailureRecorded: false
    })
    waiter.resolve(token)
  }

  #recordTransition(
    lane: LaneState,
    previousLimit: number,
    nextLimit: number,
    reason: HostedConcurrencyRampTransition['reason']
  ): void {
    if (previousLimit === nextLimit) return
    lane.rampTransitions.push({
      atMs: this.#now(),
      previousLimit,
      nextLimit,
      reason
    })
    trimHistory(lane.rampTransitions)
  }

  #scheduleWake(lane: LaneState, atMs: number): void {
    if (lane.wakeTimer !== undefined && (lane.wakeAtMs ?? Number.POSITIVE_INFINITY) <= atMs) return
    this.#clearWake(lane)
    lane.wakeAtMs = atMs
    lane.wakeTimer = this.#setTimer(() => {
      lane.wakeTimer = undefined
      lane.wakeAtMs = undefined
      this.#drain(lane)
    }, Math.max(0, atMs - this.#now()))
  }

  #clearWake(lane: LaneState): void {
    if (lane.wakeTimer !== undefined) {
      this.#clearTimer(lane.wakeTimer)
      lane.wakeTimer = undefined
      lane.wakeAtMs = undefined
    }
  }

  #finishPause(lane: LaneState): void {
    if (lane.pauseStartedAtMs === undefined) return
    const now = this.#now()
    lane.pauseDurationMs += Math.max(0, Math.min(now, lane.pauseUntilMs) - lane.pauseStartedAtMs)
    lane.pauseStartedAtMs = undefined
    lane.pauseUntilMs = 0
  }

  #clearLaneRecovery(lane: LaneState): void {
    const prefix = lanePrefix(lane.lane.laneKey)
    for (const key of this.#recoveryByWork.keys()) {
      if (key.startsWith(prefix)) this.#recoveryByWork.delete(key)
    }
  }

  #finishRecoveryIfDrained(lane: LaneState): void {
    if ([...this.#recoveryByWork.keys()].some((key) => key.startsWith(lanePrefix(lane.lane.laneKey)))) return
    lane.recovering = false
    lane.rampingAfterRecovery = lane.currentLimit < lane.configuredLimit
    this.#finishPause(lane)
    lane.pauseUntilMs = 0
  }

  #detachAbort(waiter: Waiter): void {
    if (waiter.admission.abortSignal && waiter.abortListener) {
      waiter.admission.abortSignal.removeEventListener('abort', waiter.abortListener)
      waiter.abortListener = undefined
    }
  }


}

export const createHostedConcurrencyCoordinator = (
  options: HostedConcurrencyCoordinatorOptions = {}
): HostedConcurrencyCoordinator => new HostedConcurrencyCoordinatorImpl(options)
