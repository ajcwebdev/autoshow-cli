import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'
import type { IndexedOcrTarget, OcrPoolLedger, OcrTarget, RunOcrPagePoolOptions, TargetSchedulerConcurrency } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { resolveHostedOcrLaneKey } from './ocr-utils/hosted-ocr-scheduler'
import { getOcrTargetKey } from './ocr-run-state'
import { createOcrPoolState, finalizeOcrPoolLedger, markOcrPoolTerminalPages } from './ocr-page-pool-state'
import { runOcrPoolWorkers } from './ocr-page-pool-workers'

export const isLocalOcrTarget = (
  target: Pick<OcrTarget, 'service'>
): target is Pick<OcrTarget, 'service'> & { service: 'tesseract' } =>
  target.service === 'tesseract'

const getHostedOcrExecutionPriority = (target: OcrTarget): number => {
  if (target.service === 'kimi') return 90
  if (target.service === 'deepinfra') return 85
  if (target.service === 'anthropic') return 80
  if (target.service === 'gemini') return 75
  if (target.service === 'openai') return 70
  if (target.service === 'mistral') return 60
  if (target.service === 'glm') return 55
  return 0
}

const buildIndexedOcrTargetsToRun = (
  requestedTargets: OcrTarget[],
  targetsToRun: OcrTarget[]
): IndexedOcrTarget[] => {
  const availableIndicesByKey = new Map<string, number[]>()
  requestedTargets.forEach((target, index) => {
    const key = getOcrTargetKey(target)
    const indices = availableIndicesByKey.get(key) ?? []
    indices.push(index)
    availableIndicesByKey.set(key, indices)
  })
  return targetsToRun.flatMap((target) => {
    const indices = availableIndicesByKey.get(getOcrTargetKey(target))
    const index = indices?.shift()
    return index === undefined ? [] : [{ index, target }]
  })
}

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
