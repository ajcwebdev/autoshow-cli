import type { ProviderFailureSummary, ProviderState, SttBatchAttemptDecision, SttBatchBlockedProviderReason, SttBatchCoordinatedTargetSelection, SttBatchProviderAvailability, SttBatchProviderProfile, SttBatchSchedulerSnapshot, SttTarget } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { getSttTargetKey } from '../stt-targets'
import { getSttBatchProviderProfile } from './stt-batch-policy'
import { cloneBlockedReason, resolveSttProviderFailure } from './stt-coordination-transitions'
import { runWithSttPollSlot, waitForSttAvailability, wakeWaiters } from './stt-coordination-waiters'
import { projectSttCoordinatorSnapshot } from './stt-coordination-telemetry'

export class SttBatchCoordinator {
  readonly #providerStates = new Map<string, ProviderState>()
  readonly #batchConcurrency: number

  constructor(options: { batchConcurrency?: number | undefined } = {}) {
    this.#batchConcurrency = Math.max(1, options.batchConcurrency ?? DEFAULT_CLI_CONCURRENCY)
  }

  #getState(target: Pick<SttTarget, 'service' | 'model'>): ProviderState {
    const key = getSttTargetKey(target)
    let state = this.#providerStates.get(key)
    if (!state) {
      state = {
        activeCount: 0,
        pollActiveCount: 0,
        waiters: [],
        pollWaiters: [],
        warmupComplete: false,
        consecutiveRetryableFailures: 0,
        stats: {
          launchedCount: 0,
          completedCount: 0,
          blockedCount: 0,
          degradedCount: 0,
          queueWaitMs: 0,
          pollCount: 0,
          backfillCount: 0
        }
      }
      this.#providerStates.set(key, state)
    }
    return state
  }

  #getProfile(target: Pick<SttTarget, 'service' | 'model' | 'local'>): SttBatchProviderProfile {
    return getSttBatchProviderProfile(target, this.#batchConcurrency)
  }

  #clearExpiredCooldown(state: ProviderState): void {
    if (state.cooldownUntil !== undefined && state.cooldownUntil <= Date.now()) {
      state.cooldownUntil = undefined
    }
  }

  #getEffectiveLaunchSlotLimit(
    target: Pick<SttTarget, 'service' | 'model' | 'local'>,
    state: ProviderState
  ): number {
    const launchSlotLimit = this.#getProfile(target).launchSlotLimit
    return state.warmupComplete
      ? launchSlotLimit
      : Math.min(1, launchSlotLimit)
  }

  peekProviderAvailability(target: SttTarget): SttBatchProviderAvailability {
    if (target.local) {
      return { action: 'run', activeCount: 0, slotLimit: 1 }
    }

    const state = this.#getState(target)
    this.#clearExpiredCooldown(state)
    const slotLimit = this.#getEffectiveLaunchSlotLimit(target, state)

    if (state.blockedReason) {
      return {
        action: 'skip',
        reason: cloneBlockedReason(state.blockedReason),
        activeCount: state.activeCount,
        slotLimit
      }
    }

    if (state.cooldownUntil !== undefined) {
      return {
        action: 'defer',
        activeCount: state.activeCount,
        slotLimit,
        cooldownMs: Math.max(0, state.cooldownUntil - Date.now())
      }
    }

    if (state.activeCount < slotLimit) {
      return {
        action: 'run',
        activeCount: state.activeCount,
        slotLimit
      }
    }

    return {
      action: 'defer',
      activeCount: state.activeCount,
      slotLimit
    }
  }

  tryReserveProvider(target: SttTarget): SttBatchAttemptDecision {
    const availability = this.peekProviderAvailability(target)
    if (availability.action !== 'run') {
      return availability.action === 'skip'
        ? { action: 'skip', reason: availability.reason }
        : { action: 'defer' }
    }

    const state = this.#getState(target)
    state.activeCount += 1
    state.stats.launchedCount += 1
    return { action: 'run' }
  }

  releaseProviderSlot(
    target: SttTarget,
    options: { warmupSuccess?: boolean | undefined } = {}
  ): void {
    if (target.local) {
      return
    }

    const state = this.#getState(target)
    if (state.activeCount > 0) {
      state.activeCount -= 1
    }

    if (options.warmupSuccess) {
      state.warmupComplete = true
      state.consecutiveRetryableFailures = 0
      state.cooldownUntil = undefined
    }

    wakeWaiters(state.waiters)
  }

  noteProviderQueueWait(target: SttTarget, queueWaitMs: number): void {
    if (target.local || queueWaitMs <= 0) {
      return
    }

    const state = this.#getState(target)
    state.stats.queueWaitMs += Math.max(0, Math.round(queueWaitMs))
  }

  noteBackfill(target: SttTarget): void {
    if (target.local) {
      return
    }

    const state = this.#getState(target)
    state.stats.backfillCount += 1
  }

  async withPollSlot<T>(
    target: SttTarget,
    fn: () => Promise<T>
  ): Promise<T> {
    if (target.local) {
      return await fn()
    }

    const profile = this.#getProfile(target)
    if (profile.kind !== 'async' || profile.pollSlotLimit <= 0) {
      return await fn()
    }

    const state = this.#getState(target)
    return await runWithSttPollSlot(state, profile.pollSlotLimit, fn)
  }

  async waitForAvailability(targets: SttTarget[]): Promise<void> {
    const uniqueTargets = targets.filter((target, index) =>
      targets.findIndex((candidate) =>
        candidate.service === target.service && candidate.model === target.model
      ) === index
    )

    if (uniqueTargets.length === 0) {
      return
    }

    let nearestCooldownMs: number | undefined
    for (const target of uniqueTargets) {
      const availability = this.peekProviderAvailability(target)
      if (availability.action !== 'defer') {
        return
      }

      if (availability.cooldownMs !== undefined) {
        nearestCooldownMs = nearestCooldownMs === undefined
          ? availability.cooldownMs
          : Math.min(nearestCooldownMs, availability.cooldownMs)
      }
    }

    await waitForSttAvailability(uniqueTargets.map(target => this.#getState(target)), nearestCooldownMs)
  }

  reportProviderSuccess(target: SttTarget): void {
    if (target.local) {
      return
    }

    const state = this.#getState(target)
    if (state.activeCount > 0) {
      state.activeCount -= 1
    }

    state.warmupComplete = true
    state.cooldownUntil = undefined
    state.consecutiveRetryableFailures = 0
    state.stats.completedCount += 1
    wakeWaiters(state.waiters)
  }

  reportProviderFailure(
    target: SttTarget,
    failure: ProviderFailureSummary,
    options: {
      blockedReason?: SttBatchBlockedProviderReason | undefined
      cooldownMs?: number | undefined
    } = {}
  ): void {
    if (target.local) {
      return
    }

    const state = this.#getState(target)
    if (state.activeCount > 0) {
      state.activeCount -= 1
    }

    Object.assign(state, resolveSttProviderFailure(target, state, failure, options, Date.now()))
    wakeWaiters(state.waiters)
  }

  getSchedulerSnapshot(): SttBatchSchedulerSnapshot {
    return projectSttCoordinatorSnapshot(this.#providerStates, this.#batchConcurrency)
  }
}

const selectCoordinatedTarget = async (
  indices: number[],
  pendingIndices: Set<number>,
  requestedTargets: SttTarget[],
  batchCoordinator: SttBatchCoordinator,
  onSkip: (index: number, reason: SttBatchBlockedProviderReason) => Promise<void>
): Promise<SttBatchCoordinatedTargetSelection | undefined> => {
  const waitStartedAt = Date.now()

  while (pendingIndices.size > 0) {
    const deferredTargets: SttTarget[] = []
    const runnableCandidates: Array<{
      index: number
      activeCount: number
      slotLimit: number
      priority: number
    }> = []
    let skippedAny = false

    for (const [priority, index] of indices.entries()) {
      if (!pendingIndices.has(index)) {
        continue
      }

      const target = requestedTargets[index] as SttTarget
      const availability = batchCoordinator.peekProviderAvailability(target)

      if (availability.action === 'skip') {
        pendingIndices.delete(index)
        skippedAny = true
        await onSkip(index, availability.reason)
        continue
      }

      if (availability.action === 'run') {
        runnableCandidates.push({
          index,
          activeCount: availability.activeCount,
          slotLimit: availability.slotLimit,
          priority
        })
        continue
      }

      deferredTargets.push(target)
    }

    if (runnableCandidates.length > 0) {
      runnableCandidates.sort((left, right) => {
        const leftUtilization = left.activeCount / left.slotLimit
        const rightUtilization = right.activeCount / right.slotLimit
        if (leftUtilization !== rightUtilization) {
          return leftUtilization - rightUtilization
        }

        if (left.activeCount !== right.activeCount) {
          return left.activeCount - right.activeCount
        }

        return left.priority - right.priority
      })

      for (const candidate of runnableCandidates) {
        const target = requestedTargets[candidate.index] as SttTarget
        const decision = batchCoordinator.tryReserveProvider(target)
        if (decision.action === 'run') {
          pendingIndices.delete(candidate.index)
          const queueWaitMs = Date.now() - waitStartedAt
          batchCoordinator.noteProviderQueueWait(target, queueWaitMs)
          return {
            index: candidate.index,
            queueWaitMs
          }
        }

        if (decision.action === 'skip') {
          pendingIndices.delete(candidate.index)
          skippedAny = true
          await onSkip(candidate.index, decision.reason)
        }
      }
    }

    if (skippedAny) {
      continue
    }

    if (deferredTargets.length === 0) {
      return undefined
    }

    await batchCoordinator.waitForAvailability(deferredTargets)
  }

  return undefined
}

export const runCoordinatedSttTargetPool = async (
  indices: number[],
  concurrency: number,
  requestedTargets: SttTarget[],
  batchCoordinator: SttBatchCoordinator,
  onSkip: (index: number, reason: SttBatchBlockedProviderReason) => Promise<void>,
  worker: (index: number, queueWaitMs: number) => Promise<void>
): Promise<void> => {
  const pendingIndices = new Set(indices)
  const normalizedConcurrency = Math.max(1, concurrency)

  const runWorker = async (): Promise<void> => {
    while (true) {
      const nextTarget = await selectCoordinatedTarget(
        indices,
        pendingIndices,
        requestedTargets,
        batchCoordinator,
        onSkip
      )

      if (!nextTarget) {
        return
      }

      await worker(nextTarget.index, nextTarget.queueWaitMs)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, indices.length) }, async () => {
      await runWorker()
    })
  )
}
