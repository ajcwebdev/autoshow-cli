import { rm } from 'node:fs/promises'
import type { StandaloneTtsCommandOptions, TtsTarget } from '~/types'
import { createGenerationOutputDir } from '~/cli/commands/command-shared/generation-command-utils'
import { attachExistingTtsDirectoryBatch } from '~/cli/commands/setup-and-utilities/resume/generation/tts-batch-resume'
import { collectTextInputFiles } from '~/cli/commands/text/write/text-input-utils'
import { logBatchItemStatus } from '~/cli/commands/sources/download/download-targets/download-batch/download-batch-summary'
import { InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { materializeTtsDialoguePlanArtifact } from './script-to-audio/item-dialogue-plan-artifact'
import { createTtsBatchAccumulators, createTtsBatchPlanItems, getInputStem } from './tts-batch-plan'
import { createTtsBatchLifecycleCoordinator } from './tts-batch-lifecycle'
import { prepareTtsBatchExecution, prepareTtsDirectoryBatch } from './tts-batch-preparation'
import { dispatchTtsDirectoryBatch } from './tts-batch-dispatch'
import { projectTtsBatchCompletion, publishTtsBatchCompletion, reportTtsBatchCompletionItems } from './tts-batch-completion'

export const runTtsDirectoryBatch = async (
  inputPath: string,
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[],
  maxCents: number | undefined
): Promise<void> => {
  const inputFiles = await collectTextInputFiles(inputPath)
  if (inputFiles.length === 0) {
    l.warn(`No .md or .txt files found in ${inputPath}`, { category: 'pipeline', metadata: { inputPath } })
    return
  }

  if (await attachExistingTtsDirectoryBatch(inputPath, inputFiles, ttsOptions, targets, maxCents)) return

  const createdAt = new Date().toISOString()

  const prepared = await prepareTtsDirectoryBatch(inputPath, inputFiles, ttsOptions, targets, maxCents, createdAt)
  const { preparedInputs, concurrency, estimateReport } = prepared
  targets = prepared.targets

  if (ttsOptions.price) {
    l.report.price({
      steps: estimateReport.estimates.flatMap(estimate => estimate.steps),
      totalEstimatedCost: estimateReport.totalEstimatedCost
    })
    return
  }

  const execution = await prepareTtsBatchExecution(ttsOptions, targets)
  ttsOptions = execution.ttsOptions
  targets = execution.targets
  const batchDir = await createGenerationOutputDir(getInputStem(inputPath))
  const dialoguePlanArtifacts = await Promise.all(preparedInputs.map(async (prepared) =>
    await materializeTtsDialoguePlanArtifact(batchDir, prepared.dialoguePlan)
  ))
  const batchSource = {
    sourceKind: 'directory',
    sourceUrl: inputPath,
    title: getInputStem(inputPath),
    selectedCount: preparedInputs.length
  }
  const plans = await createTtsBatchPlanItems(batchDir, preparedInputs, targets)
  const accumulators = createTtsBatchAccumulators(plans)
  const lifecycleCoordinator = createTtsBatchLifecycleCoordinator({
    batchDir,
    createdAt,
    preparedInputs,
    dialoguePlanArtifacts,
    targets,
    accumulators,
    source: batchSource
  })
  l.write('info', `Manifest: ${batchDir}/manifest.json`, {
    category: 'artifact',
    metadata: { artifact: 'manifest', path: `${batchDir}/manifest.json` }
  })

  if (concurrency > 1) {
    l.write('info', `Processing ${preparedInputs.length} TTS inputs with local/file concurrency ${concurrency}`, {
      category: 'pipeline',
      metadata: { inputCount: preparedInputs.length, concurrency }
    })
  }

  const batchStartedAt = Date.now()

  for (const plan of plans) {
    logBatchItemStatus('info', plan.prepared.inputPath, 'processing')
  }

  const schedulerTelemetry = await dispatchTtsDirectoryBatch(
    plans, accumulators, batchDir, ttsOptions, targets, execution.executionReadiness, estimateReport, lifecycleCoordinator
  )
  const completion = projectTtsBatchCompletion(preparedInputs, targets, accumulators)
  reportTtsBatchCompletionItems(completion)
  const actualBatchWallTimeMs = Date.now() - batchStartedAt
  await publishTtsBatchCompletion(batchDir, batchSource, targets, completion, actualBatchWallTimeMs, schedulerTelemetry)

  await Promise.all(plans.map(async (plan, index) => {
    const accumulator = accumulators[index]
    if (accumulator && accumulator.errors.length === 0 && accumulator.metadata.length === targets.length) {
      await rm(plan.workspaceDir, { recursive: true, force: true })
    }
  }))

  if (completion.ok === 0 && completion.fail > 0) {
    throw InfraError(`TTS batch processing failed for ${completion.fail} item(s)`, { stage: 'tts:batch' })
  }
}
