import { dirname } from 'node:path'
import type {
  FailedQaRepairEvidence,
  GenerateWithQaRepairInput,
  GenerateWithQaRepairResult,
  PageQaEntry
} from '~/types'
import { isAppError, ValidationError } from '~/utils/error-handler'
import type { QaAttemptTotals, QaRepairRefusal, QaStagnationStop } from './comic-repair-attempt-types'

export const resultWithTotals = (
  status: GenerateWithQaRepairResult['status'],
  qaEntry: PageQaEntry | undefined,
  totals: QaAttemptTotals
): GenerateWithQaRepairResult => ({ status, qaEntry, ...totals })

export const failedQaRepairEvidenceFromError = (error: unknown): FailedQaRepairEvidence | undefined => {
  if (!isAppError(error)) return undefined
  const evidence = error.metadata['qaRepairFailure']
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return undefined
  const record = evidence as Record<string, unknown>
  if (record['status'] !== 'failed' || typeof record['outputDirectory'] !== 'string') return undefined
  return evidence as FailedQaRepairEvidence
}

export const throwQaRepairFailure = (input: GenerateWithQaRepairInput, qaEntry: PageQaEntry | undefined, totals: QaAttemptTotals, skippedRepair: QaRepairRefusal | undefined, rejectedRepair: QaRepairRefusal | undefined, stagnationStop: QaStagnationStop | undefined): never => {
  const detail = skippedRepair
    ? `kept the current image because repair ${skippedRepair.attempt} was blocked by the conservative worthiness gate: ${skippedRepair.reason}`
    : rejectedRepair
      ? `kept the original because repair ${rejectedRepair.attempt} was not a unanimous regression-free improvement: ${rejectedRepair.reason}`
      : stagnationStop?.reason === 'constraint-oscillation'
        ? `stopped after repair ${stagnationStop.attempt} because the hard-failure set oscillated without a strict-subset improvement (${stagnationStop.repeatedHardFailures.join(', ')})`
        : stagnationStop
    ? `stopped after repair ${stagnationStop.attempt} because ${stagnationStop.repeatedHardFailures.join(', ')} remained unresolved after a fresh canonical-reference restart`
    : `failed QA after ${input.maxRepairs} repairs`
  const failure: FailedQaRepairEvidence = {
    ...resultWithTotals('failed', qaEntry, totals),
    status: 'failed',
    outputDirectory: dirname(input.outputPath),
  }
  throw ValidationError(`${input.kind === 'panel' ? 'Panel' : 'Page'} ${input.itemNumber} ${detail}; no canonical output was promoted.`, {
    stage: input.kind === 'panel' ? 'comic:panel-qa' : 'comic:page-qa',
    metadata: { qaRepairFailure: failure },
  })
}
