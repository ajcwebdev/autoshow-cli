import type { PreparedTtsInput, StandaloneTtsCommandOptions, TtsBatchEstimateReport, TtsExecutionReadinessObservation, TtsTarget } from '~/types'
import { configureModelCostFilter } from '~/cli/commands/pricing-orchestration/model-cost-filter'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { validateTtsRenderInputsForTargets } from './run-tts'
import { collectTtsTargets, mergeTtsExecutionReadinessObservations, validateTtsTargetsForExecution } from './tts-targets'
import { materializeStandaloneMistralReference } from '../voice/voice-assets/standalone-mistral-reference'
import { hasMistralProtectedReferences } from '../voice/voice-assets/mistral-protected-reference-binding'
import { createBatchItemTtsSourceIdentity, createGenericTtsDialoguePlan, createSingleTurnTtsDialoguePlan } from './script-to-audio/generic-dialogue-plan'
import { buildTtsEstimateForInput, enforceTtsBatchBudget, reportTtsBatchEstimates } from './tts-batch-estimates'
import { prepareTtsInput } from './tts-single-run'

export interface PreparedTtsDirectoryBatch {
  preparedInputs: PreparedTtsInput[]
  targets: TtsTarget[]
  concurrency: number
  estimateReport: TtsBatchEstimateReport
}

export const prepareTtsDirectoryBatch = async (
  inputPath: string,
  inputFiles: string[],
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[],
  maxCents: number | undefined,
  createdAt: string
): Promise<PreparedTtsDirectoryBatch> => {
  const preparedInputs = await Promise.all(inputFiles.map(async (file, index) => {
    const prepared = await prepareTtsInput(file, ttsOptions, createdAt)
    const sourceIdentity = await createBatchItemTtsSourceIdentity(inputPath, index, prepared.sourceBytes)
    return {
      ...prepared,
      sourceIdentity,
      dialoguePlan: prepared.dialogueRequested
        ? createGenericTtsDialoguePlan(sourceIdentity, prepared.text, ttsOptions, createdAt)
        : createSingleTurnTtsDialoguePlan(sourceIdentity, prepared.text, createdAt)
    }
  }))
  const concurrency = Math.max(1, ttsOptions.batchConcurrency ?? DEFAULT_CLI_CONCURRENCY)
  if (ttsOptions.maxModelCents !== undefined) {
    const unfilteredEstimates: TtsBatchEstimateReport['estimates'] = []
    for (const prepared of preparedInputs) {
      unfilteredEstimates.push(await buildTtsEstimateForInput(prepared, ttsOptions, targets))
    }
    configureModelCostFilter(ttsOptions, unfilteredEstimates)
    targets = collectTtsTargets(ttsOptions)
  }
  for (const prepared of preparedInputs) validateTtsRenderInputsForTargets(targets, prepared.text, ttsOptions, prepared)
  const shouldLogEstimates = ttsOptions.price || maxCents !== undefined || ttsOptions.maxModelCents !== undefined
  const estimateReport = await reportTtsBatchEstimates(preparedInputs, ttsOptions, targets, shouldLogEstimates, concurrency)
  enforceTtsBatchBudget(estimateReport.totalEstimatedCost, maxCents, ttsOptions.allowOverBudget)
  return { preparedInputs, targets, concurrency, estimateReport }
}

export const prepareTtsBatchExecution = async (
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[]
): Promise<{ ttsOptions: StandaloneTtsCommandOptions, targets: TtsTarget[], executionReadiness: TtsExecutionReadinessObservation[] }> => {
  let executionReadiness = await validateTtsTargetsForExecution(targets)
  const hasProtectedMistralReference = hasMistralProtectedReferences(ttsOptions)
  if (executionReadiness.every((entry) => entry.status === 'ready')) {
    ttsOptions = await materializeStandaloneMistralReference(ttsOptions)
    if (hasProtectedMistralReference) {
      targets = collectTtsTargets(ttsOptions)
      executionReadiness = mergeTtsExecutionReadinessObservations(
        executionReadiness,
        await validateTtsTargetsForExecution(targets)
      )
    }
  }
  return { ttsOptions, targets, executionReadiness }
}
