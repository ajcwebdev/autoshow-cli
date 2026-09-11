import type {
  GenerateWithQaRepairInput,
  PageQaEntry,
  PageQaRepairDecision
} from '~/types'
import { decidePageQaRepairDispatch } from './comic-page-qa'
import type { QaAttemptAction, QaRepairActionState, QaRestartReason } from './comic-repair-attempt-types'

export const resolveQaRepairAction = (blockingClassRestart: boolean, decision: PageQaRepairDecision): QaRepairActionState => {
  if (blockingClassRestart) return { action: 'restart', restartReason: 'blocking-class' }
  if (decision.action === 'restart') return { action: 'restart', restartReason: 'repeated-hard-failure' }
  return { action: 'edit', restartReason: undefined }
}

export const resolveQaRepairDispatchReason = (input: GenerateWithQaRepairInput, attempt: number, qaEntry: PageQaEntry | undefined, action: QaAttemptAction, restartReason: QaRestartReason | undefined): string | undefined => {
  if (attempt <= 0 || input.kind !== 'panel' || !qaEntry?.hardFailure || (action === 'restart' && restartReason === 'blocking-class')) return undefined
  const dispatch = decidePageQaRepairDispatch(qaEntry)
  return dispatch.action === 'skip' ? dispatch.reason : undefined
}

export const resolveRejectedQaRepair = (input: {
  qaEntry: PageQaEntry
  baselineQaEntry: PageQaEntry | undefined
  baselinePath: string | undefined
  decision: PageQaRepairDecision
  attempt: number
  maxRepairs: number
}): { action: 'stop' | 'restart' | 'reject'; qaEntry: PageQaEntry; reason: string } | undefined => {
  const { qaEntry, baselineQaEntry, decision, attempt, maxRepairs, baselinePath } = input
  const repairComparison = qaEntry.repairComparison
  if (repairComparison?.decision === undefined || repairComparison.decision === 'clear-winner') return undefined
  const reason = repairComparison.reason
  if (decision.action === 'stop') {
    return { action: 'stop', reason, qaEntry: baselineQaEntry ? { ...baselineQaEntry, repairComparison, repairPolicy: { action: 'stop', reason: decision.reason ?? 'repeated-hard-failure', repeatedHardFailures: decision.repeatedHardFailures } } : qaEntry }
  }
  return {
    action: attempt < maxRepairs && baselinePath ? 'restart' : 'reject',
    reason,
    qaEntry: baselineQaEntry ? { ...baselineQaEntry, repairComparison, repairPolicy: { action: 'retain-original', repeatedHardFailures: [], reason } } : qaEntry
  }
}
