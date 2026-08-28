import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'
import type { IndexedOcrTarget, OcrPoolClaim, OcrPoolLedger, OcrPoolState, OcrPoolWorkerOptions, OcrTarget } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { getOcrTargetKey } from './ocr-run-state'
import { claimOcrPoolPage, commitAcceptedOcrPoolResult, markOcrPoolTerminalPages, recordOcrPoolClaimFailure, rejectStaleOcrPoolResult, snapshotOcrPoolLedger } from './ocr-page-pool-state'
import { normalizePositiveInt } from '~/utils/value-helpers'
import { buildIndexedOcrTargetsToRun, getHostedOcrExecutionPriority, isLocalOcrTarget } from './ocr-pool-scheduling'

class OcrPoolWorkerCoordinator {
  readonly admittedKeys = new Set<string>()
  private stateGeneration = 0
  private readonly waiters = new Set<() => void>()
  private checkpointWrite = Promise.resolve()

  constructor(
    private readonly state: OcrPoolState,
    private readonly options: OcrPoolWorkerOptions
  ) {}

  notifyStateChange(): void {
    this.stateGeneration += 1
    for (const resolve of this.waiters) resolve()
    this.waiters.clear()
  }

  async waitForStateChange(generation: number): Promise<void> {
    if (generation !== this.stateGeneration) return
    await new Promise<void>((resolve) => this.waiters.add(resolve))
  }

  async persistLedger(ledger: OcrPoolLedger = snapshotOcrPoolLedger(this.state)): Promise<void> {
    if (!this.options.onCheckpoint) return
    const snapshot = structuredClone(ledger)
    this.checkpointWrite = this.checkpointWrite.then(async () => await this.options.onCheckpoint?.(snapshot))
    await this.checkpointWrite
  }

  private async executeClaim(claim: OcrPoolClaim): Promise<void> {
    await this.persistLedger()
    let processed
    try {
      processed = await this.options.processPage({
        pageNumber: claim.page.pageNumber,
        target: claim.target,
        attempt: claim.attempt.attempt,
        claimId: claim.attempt.claimId,
        artifactDir: claim.attempt.artifactDir
      })
    } catch (error) {
      const classified = this.options.classifyFailure(error, claim.target)
      recordOcrPoolClaimFailure(this.state, claim, classified, this.state.now())
      markOcrPoolTerminalPages(this.state)
      this.notifyStateChange()
      await this.persistLedger()
      return
    }
    const finishedAtMs = this.state.now()
    if (claim.page.status !== 'claimed' || claim.page.claim?.claimId !== claim.attempt.claimId || claim.page.accepted) {
      rejectStaleOcrPoolResult(this.state, claim, processed, finishedAtMs)
    } else {
      commitAcceptedOcrPoolResult(this.state, claim, processed, finishedAtMs)
    }
    this.notifyStateChange()
    await this.persistLedger()
  }

  private async runWorker(target: OcrTarget): Promise<void> {
    while (true) {
      const generation = this.stateGeneration
      const claim = claimOcrPoolPage(this.state, target, this.admittedKeys)
      if (claim) {
        this.notifyStateChange()
        await this.executeClaim(claim)
        continue
      }
      const targetState = this.state.targetStates.get(getOcrTargetKey(target))
      const lane = targetState ? this.state.laneStates.get(targetState.laneKey) : undefined
      if (!targetState || !lane || targetState.status === 'retired' || lane.status === 'retired') return
      if (!this.state.ledger.pages.some((page) => page.status === 'claimed')) return
      await this.waitForStateChange(generation)
    }
  }

  async runTarget(target: OcrTarget): Promise<void> {
    const targetKey = getOcrTargetKey(target)
    this.admittedKeys.add(targetKey)
    this.notifyStateChange()
    await Promise.resolve()
    try {
      const concurrency = normalizePositiveInt(this.options.getTargetConcurrency(target))
      await Promise.all(Array.from({ length: concurrency }, async () => await this.runWorker(target)))
    } finally {
      this.admittedKeys.delete(targetKey)
      this.notifyStateChange()
    }
  }
}

export const runOcrPoolWorkers = async (
  state: OcrPoolState,
  options: OcrPoolWorkerOptions
): Promise<void> => {
  const coordinator = new OcrPoolWorkerCoordinator(state, options)
  await coordinator.persistLedger()
  const scheduled = await runProviderTargetScheduler<IndexedOcrTarget, void>({
    entries: buildIndexedOcrTargetsToRun(options.requestedTargets, options.targetsToRun).map((entry) => ({
      index: entry.index,
      target: { index: entry.index, target: entry.target },
      priority: isLocalOcrTarget(entry.target) ? 0 : getHostedOcrExecutionPriority(entry.target)
    })),
    concurrency: { provider: options.providerConcurrency, local: options.localConcurrency },
    getPool: (entry) => isLocalOcrTarget(entry.target) ? 'local' : 'hosted',
    runTarget: async (_index, entry) => await coordinator.runTarget(entry.target)
  })
  if (scheduled.failures.length > 0) {
    throw InfraError(scheduled.failures.map((failure) => failure.message).join('; '), { stage: 'ocr:page-pool' })
  }
}
