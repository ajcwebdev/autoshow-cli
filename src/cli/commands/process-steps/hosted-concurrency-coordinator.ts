import type {
  ClassState,
  HostedConcurrencyAdmission,
  HostedConcurrencyAdmissionToken,
  HostedConcurrencyClassTelemetry,
  HostedConcurrencyCoordinator,
  HostedConcurrencyCoordinatorOptions,
  HostedConcurrencyLaneTelemetry,
  HostedConcurrencyMode,
  HostedConcurrencyPressureDecision,
  HostedConcurrencyPressureEvent,
  HostedConcurrencyRequestOptions,
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
import { createProviderLaneIdentity, DEFAULT_PROVIDER_LANE_SCOPE_LABEL } from './provider-lane-contract'
import { AppError, extractErrorMetadata, InternalError } from '~/utils/error-handler'

export const DEFAULT_HOSTED_CONCURRENCY_MODE: HostedConcurrencyMode = 'ramp'
export const HOSTED_CONCURRENCY_RAMP_INTERVAL_MS = 5_000
export const HOSTED_CONCURRENCY_RECOVERY_BUDGET_MS = 5 * 60_000

const RATE_LIMIT_BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000] as const
const EVENT_HISTORY_LIMIT = 100

const normalizeLimit = (value: number): number =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1

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

    if (tokenState.pressureReported && status !== 'succeeded') {
      lane.recoveryProbeActive = false
      if (!tokenState.recoveryRetryApproved) {
        this.#recoveryByWork.delete(tokenState.recoveryKey)
        if (!tokenState.recoveryFailureRecorded) lane.recoveryFailures += 1
        this.#finishRecoveryIfDrained(lane)
      }
    }

    if (token.recoveryProbe && !tokenState.pressureReported && status !== 'succeeded') {
      lane.recoveryProbeActive = false
      this.#recoveryByWork.delete(tokenState.recoveryKey)
      lane.recoveryFailures += 1
      this.#finishRecoveryIfDrained(lane)
    }

    if (token.recoveryProbe || (tokenState.pressureReported && status === 'succeeded')) {
      lane.recoveryProbeActive = false
      if (status === 'succeeded') {
        this.#clearLaneRecovery(lane)
        lane.recovering = false
        lane.rampingAfterRecovery = lane.currentLimit < lane.configuredLimit
        this.#finishPause(lane)
        lane.pauseUntilMs = 0
        lane.nextRampAtMs = lane.rampingAfterRecovery && lane.waiters.length > 0
          ? this.#now() + this.#rampIntervalMs
          : undefined
      }
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

    const backoffIndex = Math.min(recovery.pressureAttempt - 1, RATE_LIMIT_BACKOFF_MS.length - 1)
    const baseDelayMs: number = RATE_LIMIT_BACKOFF_MS[backoffIndex] ?? 30_000
    const random = Math.min(1, Math.max(0, this.#random()))
    const jitteredDelayMs = Math.round(baseDelayMs * (0.5 + random * 0.5))
    const requestedDelayMs = Math.max(
      0,
      feedback.delayMs ?? 0,
      feedback.retryAfterMs ?? 0
    )
    const delayMs = Math.max(jitteredDelayMs, requestedDelayMs)
    const elapsedMs = Math.max(0, now - recovery.firstPressureAtMs)
    const remainingBudgetMs = Math.max(0, this.#recoveryBudgetMs - elapsedMs)

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

    if (delayMs > remainingBudgetMs) {
      lane.recoveryFailures += 1
      tokenState.recoveryFailureRecorded = true
      tokenState.recoveryRetryApproved = false
      this.#recoveryByWork.delete(tokenState.recoveryKey)
      if (![...this.#recoveryByWork.keys()].some((key) => key.startsWith(lanePrefix(lane.lane.laneKey)))) {
        lane.recovering = false
        lane.rampingAfterRecovery = lane.currentLimit < lane.configuredLimit
      }
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

  snapshot(): HostedConcurrencyTelemetry {
    return {
      version: 1,
      mode: this.mode,
      lanes: [...this.#lanes.values()]
        .map((lane) => this.#snapshotLane(lane))
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
    const configuredLimit = normalizeLimit(admission.configuredLimit)
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
    const configuredLimit = normalizeLimit(limit)
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
      const waiterIndex = this.#selectWaiterIndex(lane)
      if (waiterIndex < 0) break
      const [waiter] = lane.waiters.splice(waiterIndex, 1)
      if (!waiter) break
      this.#admit(waiter)
      if (lane.recovering) break
    }

    if (lane.waiters.length === 0) {
      lane.nextRampAtMs = undefined
      this.#clearWake(lane)
      return
    }

    if (lane.recovering) {
      return
    }
    if (lane.currentLimit < lane.configuredLimit) {
      lane.nextRampAtMs ??= now + this.#rampIntervalMs
      if (lane.nextRampAtMs <= now) {
        const previousLimit = lane.currentLimit
        lane.currentLimit = Math.min(lane.configuredLimit, lane.currentLimit + 1)
        this.#recordTransition(
          lane,
          previousLimit,
          lane.currentLimit,
          lane.rampingAfterRecovery ? 'recovery-ramp' : 'startup-ramp'
        )
        if (lane.currentLimit >= lane.configuredLimit) {
          lane.rampingAfterRecovery = false
          lane.nextRampAtMs = undefined
        } else {
          lane.nextRampAtMs = now + this.#rampIntervalMs
        }
        this.#drain(lane)
        return
      }
      this.#scheduleWake(lane, lane.nextRampAtMs)
    }
  }

  #selectWaiterIndex(lane: LaneState): number {
    if (lane.recovering) {
      if (lane.recoveryProbeActive) return -1
      return lane.waiters.findIndex((waiter) =>
        this.#recoveryByWork.has(waiter.recoveryKey)
        && waiter.classState.active < waiter.classState.configuredLimit
      )
    }
    return lane.waiters.findIndex((waiter) => waiter.classState.active < waiter.classState.configuredLimit)
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
      configuredLimit: normalizeLimit(admission.configuredLimit),
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

  #snapshotLane(lane: LaneState): HostedConcurrencyLaneTelemetry {
    const now = this.#now()
    const livePauseMs = lane.pauseStartedAtMs === undefined
      ? 0
      : Math.max(0, Math.min(now, lane.pauseUntilMs) - lane.pauseStartedAtMs)
    const classes: HostedConcurrencyClassTelemetry[] = [...lane.classes.entries()]
      .map(([workClass, state]) => ({
        workClass,
        configuredLimit: state.configuredLimit,
        active: state.active,
        activePeak: state.activePeak,
        queued: lane.waiters.filter((waiter) => waiter.admission.workClass === workClass).length
      }))
      .sort((left, right) => left.workClass.localeCompare(right.workClass))
    return {
      lane: lane.lane,
      configuredLimit: lane.configuredLimit,
      currentLimit: lane.currentLimit,
      active: lane.active,
      activePeak: lane.activePeak,
      queuedWork: lane.waiters.length,
      queuedPeak: lane.queuedPeak,
      admitted: lane.admitted,
      completed: lane.completed,
      failed: lane.failed,
      canceled: lane.canceled,
      rampTransitions: lane.rampTransitions.slice(),
      pressureEvents: lane.pressureEvents.slice(),
      pauseDurationMs: Math.round(lane.pauseDurationMs + livePauseMs),
      recoveryProbes: lane.recoveryProbes,
      recoveryFailures: lane.recoveryFailures,
      classes
    }
  }
}

export const createHostedConcurrencyCoordinator = (
  options: HostedConcurrencyCoordinatorOptions = {}
): HostedConcurrencyCoordinator => new HostedConcurrencyCoordinatorImpl(options)

// Walks the cause chain for a duck-typed diagnostic field. AppError carries such fields
// in `metadata` rather than as own properties, so both are consulted (own property first)
// — otherwise a structured AppProviderError would be invisible to pressure classification
// that a hand-assembled plain error still matched.
const readNestedErrorValue = (error: unknown, key: string): unknown => {
  const seen = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if (key in current) return (current as Record<string, unknown>)[key]
    if (current instanceof AppError && key in current.metadata) return current.metadata[key]
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return undefined
}

const readHeader = (headers: unknown, name: string): string | undefined => {
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  if (headers && typeof headers === 'object' && 'get' in headers && typeof headers.get === 'function') {
    const value = (headers.get as (key: string) => unknown)(name)
    return typeof value === 'string' ? value : undefined
  }
  if (!headers || typeof headers !== 'object') return undefined
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  const value = entry?.[1]
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string')
  if (typeof value === 'number') return String(value)
  return typeof value === 'string' ? value : undefined
}

const toHeaders = (headers: unknown): Headers | undefined => {
  if (headers instanceof Headers) return headers
  if (!headers || typeof headers !== 'object') return undefined
  const normalized = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' || typeof item === 'number') normalized.append(key, String(item))
      }
    } else if (typeof value === 'string' || typeof value === 'number') {
      normalized.append(key, String(value))
    }
  }
  return [...normalized.keys()].length > 0 ? normalized : undefined
}

// Message-matching by design: the upstream source is provider rate-limit prose, which
// varies per vendor and is often the only signal when a 429 status is absent. Structured
// fields (status, category, code) are consulted first, including AppError metadata.
export const classifyHostedRateLimitPressure = (
  error: unknown
): ProviderLanePressureFeedback | undefined => {
  const status = readNestedErrorValue(error, 'status')
  const category = readNestedErrorValue(error, 'category')
  const code = readNestedErrorValue(error, 'code')
  const messages: string[] = []
  const seen = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if (current instanceof Error) messages.push(current.message)
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  const message = messages.join(' ').toLowerCase()
  const classificationText = `${typeof category === 'string' ? category : ''} ${typeof code === 'string' ? code : ''} ${message}`.toLowerCase()
  if (/billing|payment required|insufficient (?:balance|credit)|quota[_\s-]*(?:exhaust|exceed|deplet)|exceed(?:ed|s|ing)? (?:your )?(?:current )?quota|quota[_\s-]*limit[_\s-]*(?:reached|exhaust)|check your plan|authentication|unauthorized|validation/.test(classificationText)) {
    return undefined
  }
  const explicitlyRateLimited = status === 429
    || (typeof category === 'string' && /rate.?limit|too.?many.?requests|concurrenc/i.test(category))
    || (typeof code === 'string' && /rate.?limit|too.?many.?requests|concurrenc/i.test(code))
    || /rate[-\s]?limit|too many requests|provider concurrency|concurrency limit/.test(message)
  if (!explicitlyRateLimited) return undefined
  const headers = readNestedErrorValue(error, 'headers')
  let retryAfterMs: number | undefined
  const rawRetryAfter = readHeader(headers, 'retry-after')
  if (rawRetryAfter !== undefined) {
    const seconds = Number(rawRetryAfter)
    if (Number.isFinite(seconds)) retryAfterMs = Math.max(0, seconds * 1_000)
    else {
      const atMs = Date.parse(rawRetryAfter)
      if (Number.isFinite(atMs)) retryAfterMs = Math.max(0, atMs - Date.now())
    }
  }
  return {
    reason: typeof category === 'string' ? category : 'rate-limit',
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof retryAfterMs === 'number' ? { retryAfterMs } : {})
  }
}

const toErrorCause = (error: unknown): Error =>
  error instanceof Error ? error : new Error(error === undefined ? 'Unknown hosted request failure' : String(error))

const throwHostedRecoveryExhausted = (
  error: unknown,
  pressure: ProviderLanePressureFeedback,
  decision: HostedConcurrencyPressureDecision,
  token: HostedConcurrencyAdmissionToken
): never => {
  const metadata = extractErrorMetadata(error)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : pressure.status
  const headers = toHeaders(metadata['headers'])
  const stage = typeof metadata['stage'] === 'string' ? metadata['stage'] : undefined
  throw new AppError(`Hosted request rate-limit recovery exhausted after ${decision.pressureAttempt} pressure event(s) and ${decision.elapsedMs}ms.`, {
    kind: 'retry_exhausted',
    cause: toErrorCause(error),
    ...(typeof status === 'number' ? { status } : {}),
    ...(headers ? { headers } : {}),
    ...(stage ? { stage } : {}),
    retryable: true,
    metadata: {
      ...metadata,
      pressureAttempt: decision.pressureAttempt,
      elapsedMs: decision.elapsedMs,
      remainingBudgetMs: decision.remainingBudgetMs,
      requiredDelayMs: decision.delayMs,
      hostedConcurrencyLane: token.lane,
      hostedConcurrencyWorkClass: token.workClass,
      hostedConcurrencyWorkId: token.workId,
      hostedConcurrencyUnitIndex: token.unitIndex
    }
  })
}

export const recoverHostedConcurrencyRequest = async (options: {
  coordinator: HostedConcurrencyCoordinator
  admission: HostedConcurrencyAdmission
  token: HostedConcurrencyAdmissionToken
  error: unknown
  pressure?: ProviderLanePressureFeedback | undefined
}): Promise<HostedConcurrencyAdmissionToken> => {
  const pressure = options.pressure ?? classifyHostedRateLimitPressure(options.error)
  if (!pressure) throw options.error
  const decision = options.coordinator.reportRateLimit(options.token, pressure)
  options.coordinator.release(options.token, 'failed')
  if (!decision.retry) {
    throwHostedRecoveryExhausted(options.error, pressure, decision, options.token)
  }
  return await options.coordinator.acquire(options.admission)
}

export const runHostedConcurrencyRequest = async <T>(
  options: HostedConcurrencyRequestOptions,
  task: (token: HostedConcurrencyAdmissionToken) => Promise<T>
): Promise<T> => {
  const classifyPressure = options.classifyPressure ?? classifyHostedRateLimitPressure
  let token = await options.coordinator.acquire(options.admission)
  while (true) {
    try {
      const result = await task(token)
      options.coordinator.release(token, 'succeeded')
      return result
    } catch (error) {
      const pressure = classifyPressure(error)
      if (!pressure) {
        options.coordinator.release(token, options.admission.abortSignal?.aborted === true ? 'canceled' : 'failed')
        throw error
      }
      token = await recoverHostedConcurrencyRequest({
        coordinator: options.coordinator,
        admission: options.admission,
        token,
        error,
        pressure
      })
    }
  }
}
