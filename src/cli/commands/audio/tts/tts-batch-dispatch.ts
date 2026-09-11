import { basename, join } from 'node:path'
import type { AggregatedPriceEstimate, HostedTtsSchedulerTelemetry, TtsBatchEstimateReport, TtsBatchItemAccumulator, TtsBatchLifecycleCoordinator, TtsBatchPlanItem, TtsExecutionReadinessObservation, TtsOptions, TtsTarget } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { createHostedTtsChunkScheduler } from './tts-utils/hosted-tts-chunk-scheduler'
import { getTtsArtifactFileName } from './tts-targets'
import { getTtsBatchAudioFileName } from './tts-batch-plan'
import { buildTtsEstimateForInput } from './tts-batch-estimates'
import { synthesizePreparedTtsInputForTargets } from './tts-single-run'

const countExpectedHostedChunkJobs = (
  plans: TtsBatchPlanItem[],
  hostedTargets: TtsTarget[]
): number =>
  plans.reduce((sum, plan) =>
    sum + hostedTargets.reduce((targetSum, target) => {
      if (
        plan.prepared.dialogueRequested
        && (target.multiSpeakerStrategy ?? 'segment-and-concat') === 'segment-and-concat'
      ) {
        return targetSum + Math.max(1, plan.prepared.dialogueTurnCount ?? 1)
      }
      return targetSum + 1
    }, 0)
  , 0)

const logHostedTtsSchedulerSummary = (
  telemetry: HostedTtsSchedulerTelemetry | undefined
): void => {
  if (!telemetry || telemetry.providers.length === 0) {
    return
  }

  l.write('info', `Hosted TTS scheduler handled ${telemetry.providers.length} providers`, {
    category: 'runtime',
    metadata: telemetry
  })
}

const runTtsBatchPlanForTargets = async (
  plan: TtsBatchPlanItem,
  accumulator: TtsBatchItemAccumulator,
  batchDir: string,
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  allTargets: TtsTarget[],
  executionReadiness: readonly TtsExecutionReadinessObservation[],
  preflightEstimate: AggregatedPriceEstimate,
  lifecycleCoordinator: TtsBatchLifecycleCoordinator
): Promise<void> => {
  if (targets.length === 0) {
    return
  }

  try {
    const run = await synthesizePreparedTtsInputForTargets(
      plan.prepared,
      plan.workspaceDir,
      ttsOptions,
      targets,
      preflightEstimate,
      {
        artifactOutputDir: batchDir,
        artifactRoot: `items/${accumulator.itemStem}/providers`,
        executionReadiness,
        resolveReportedOutput: (target) => {
          const fileName = getTtsBatchAudioFileName(
            accumulator.itemStem,
            {
              ttsService: target.service,
              ttsModel: target.model,
              audioFileName: getTtsArtifactFileName(target, allTargets.length === 1)
            },
            allTargets.length === 1
          )
          return { path: join(batchDir, fileName), fileName }
        },
        beforeDispatch: async (preparedStates) => await lifecycleCoordinator.beforeDispatch(plan.index, preparedStates),
        onProviderState: async (state) => await lifecycleCoordinator.onProviderState(plan.index, state)
      }
    )
    const metadata = run.metadata
    run.cost.estimated = run.cost.observedEstimate
    accumulator.metadata.push(...metadata)
    accumulator.runs.push(run)
  } catch (error) {
    lifecycleCoordinator.abortPreparation(error)
    accumulator.errors.push(error instanceof Error ? error.message : String(error))
  }
}

export const dispatchTtsDirectoryBatch = async (
  plans: TtsBatchPlanItem[],
  accumulators: TtsBatchItemAccumulator[],
  batchDir: string,
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  executionReadiness: readonly TtsExecutionReadinessObservation[],
  estimateReport: TtsBatchEstimateReport,
  lifecycleCoordinator: TtsBatchLifecycleCoordinator
): Promise<HostedTtsSchedulerTelemetry | undefined> => {
  let schedulerTelemetry: HostedTtsSchedulerTelemetry | undefined
  const runPromises: Promise<void>[] = []
  const hostedCoordinator = targets.length > 0
    ? createHostedTtsChunkScheduler({
        maxConcurrency: ttsOptions.ttsChunkConcurrency,
        concurrencyMode: ttsOptions.concurrencyMode,
        hostedConcurrencyCoordinator: ttsOptions.hostedConcurrencyCoordinator,
        autoStart: false
      })
    : undefined
  if (hostedCoordinator) {
    const hostedOptions: TtsOptions = {
      ...ttsOptions,
      hostedTtsChunkScheduler: hostedCoordinator,
      ttsProviderConcurrency: Math.max(targets.length, ttsOptions.ttsProviderConcurrency ?? 1)
    }
    for (const plan of plans) {
      runPromises.push(
        runWithLogContext({ batchId: basename(batchDir), itemIndex: plan.index + 1, itemCount: plans.length }, async () =>
          await runTtsBatchPlanForTargets(
            plan,
            accumulators[plan.index] as TtsBatchItemAccumulator,
            batchDir,
            hostedOptions,
            targets,
            targets,
            executionReadiness,
            estimateReport.estimates[plan.index] ?? await buildTtsEstimateForInput(plan.prepared, ttsOptions),
            lifecycleCoordinator
          )
        )
      )
    }
  }

  if (hostedCoordinator) {
    const expectedHostedJobs = countExpectedHostedChunkJobs(plans, targets)
    const registeredAllJobs = expectedHostedJobs === 0
      ? true
      : await hostedCoordinator.waitForRegisteredJobs(expectedHostedJobs, 1_000)
    if (!registeredAllJobs) {
      l.debug(`Hosted TTS scheduler registered ${hostedCoordinator.getRegisteredJobCount()}/${expectedHostedJobs} expected chunk jobs before release`, {
        category: 'pipeline',
        metadata: { registeredJobs: hostedCoordinator.getRegisteredJobCount(), expectedHostedJobs }
      })
    }
    hostedCoordinator.start()
  }

  await Promise.all(runPromises)
  if (hostedCoordinator) {
    schedulerTelemetry = hostedCoordinator.getTelemetry()
    logHostedTtsSchedulerSummary(schedulerTelemetry)
  }

  return schedulerTelemetry
}
