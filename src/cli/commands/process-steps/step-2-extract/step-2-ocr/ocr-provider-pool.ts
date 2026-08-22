import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'
import type { IndexedOcrTarget, OcrPoolLedger, OcrTarget, RunOcrPagePoolOptions, TargetSchedulerConcurrency } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { resolveHostedOcrLaneKey } from './ocr-utils/hosted-ocr-scheduler'
import { createOcrPoolState, finalizeOcrPoolLedger, markOcrPoolTerminalPages } from './ocr-page-pool-state'
import { runOcrPoolWorkers } from './ocr-page-pool-workers'
import { buildIndexedOcrTargetsToRun, getHostedOcrExecutionPriority, isLocalOcrTarget } from './ocr-pool-scheduling'

export { isLocalOcrTarget }

export const runOcrProviderTargetPools = async (
  requestedTargets: OcrTarget[],
  targetsToRun: OcrTarget[],
  concurrency: TargetSchedulerConcurrency,
  worker: (index: number, target: OcrTarget) => Promise<void>
): Promise<void> => {
  const indexedTargets = buildIndexedOcrTargetsToRun(requestedTargets, targetsToRun)
  const scheduled = await runProviderTargetScheduler<IndexedOcrTarget, void>({
    entries: indexedTargets.map((entry) => ({
      index: entry.index,
      target: entry,
      priority: isLocalOcrTarget(entry.target) ? 0 : getHostedOcrExecutionPriority(entry.target)
    })),
    concurrency,
    getPool: (entry) => isLocalOcrTarget(entry.target) ? 'local' : 'hosted',
    runTarget: async (_index, entry) => await worker(entry.index, entry.target)
  })
  if (scheduled.failures.length > 0) {
    throw InfraError(scheduled.failures.map(({ target, message }) =>
      `${target.target.service}/${target.target.model}: ${message}`
    ).join('; '), { stage: 'ocr:pool' })
  }
}

export const defaultOcrPoolLaneKey = (target: OcrTarget): string => {
  if (target.service === 'tesseract') return 'local:tesseract'
  return resolveHostedOcrLaneKey(target.service)
}

export const runOcrPagePool = async (
  options: RunOcrPagePoolOptions
): Promise<OcrPoolLedger> => {
  const state = createOcrPoolState(options)
  await runOcrPoolWorkers(state, options)
  markOcrPoolTerminalPages(state)
  const ledger = finalizeOcrPoolLedger(state)
  if (options.onCheckpoint) await options.onCheckpoint(structuredClone(ledger))
  return structuredClone(ledger)
}
