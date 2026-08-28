import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExistingSttRun, ProviderFailure, SttBatchWorkerContext, SttMultiProviderBatchContext, SttProviderState, SttProviderSuccess, SttTarget } from '~/types'
import { readSinglePipelineItemRecord, writePipelineItemRecords } from '../../../pipeline-manifest'
import { runCoordinatedSttTargetPool } from '../batch'
import { getSttProviderArtifactDir, readExistingSttRun, toRequestedProvider } from '../stt-batch/stt-run-state'
import { createPromptRefreshController, selectPrimaryPromptProvider } from '../stt-prompt'
import { prioritizeCloudSttTargetIndices, resolveEffectiveSttProviderConcurrency, logEffectiveProviderConcurrency } from '../stt-provider-pool'
import { getSttTargetKey } from '../stt-targets'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { markSttTargetSkipped, runSttProviderTargetAtIndex } from './stt-batch-worker'
import { runSttRecoveryPasses } from './stt-batch-recovery'
import { computeSttBatchDerivedState, finalizeSttBatchCostTiming, reportSttBatchOutcome } from './stt-batch-finalize'


export const runMultiProviderSttBatch = async ({
  outputDir,
  requestedTargets,
  targetsToRunKeys,
  options,
  preflightEstimate,
  prepared,
  acquisitionTimeMs,
  processStart,
  runOptions,
  mistralPassController
}: SttMultiProviderBatchContext): Promise<string> => {
  const providersDir = join(outputDir, 'providers')
  await mkdir(providersDir, { recursive: true })
  const existingRun = runOptions.outputDir
    ? await readExistingSttRun(outputDir, requestedTargets)
    : {
        successes: new Array<SttProviderSuccess | undefined>(requestedTargets.length),
        providerStates: new Map<string, SttProviderState>()
      } satisfies ExistingSttRun
  const successes: Array<SttProviderSuccess | undefined> = existingRun.successes
  const failuresByIndex = new Map<number, ProviderFailure>()
  const providerStateMap = new Map(existingRun.providerStates)
  const existingItemRecord = await readSinglePipelineItemRecord(outputDir, {
    command: 'extract',
    extractRoute: 'media'
  })
  const targetsToRun = new Set(targetsToRunKeys)
  await writePipelineItemRecords(outputDir, 'extract', 'single', [{
    ...(existingItemRecord ?? {}),
    step1: prepared.step1Metadata,
    completionStatus: 'incomplete',
    requestedProviders: requestedTargets.map(toRequestedProvider),
    providerStates: requestedTargets.map((target) => {
      const existing = providerStateMap.get(getSttTargetKey(target))
      return {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: existing?.artifactDir ?? getSttProviderArtifactDir(target),
        status: targetsToRun.has(getSttTargetKey(target)) ? 'missing' : existing?.status ?? 'missing',
        attempts: existing?.attempts ?? 0,
        ...(existing?.error ? { error: existing.error } : {}),
        ...(existing?.metadata ? { metadata: existing.metadata } : {})
      }
    }),
    missingProviders: requestedTargets
      .filter((target) => targetsToRun.has(getSttTargetKey(target)))
      .map(toRequestedProvider)
  }], { extractRoute: 'media' })
  const providerConcurrency = resolveEffectiveSttProviderConcurrency(options, requestedTargets)
  const batchCoordinator = runOptions.batchCoordinator
  const coordinatedAcrossBatch = batchCoordinator !== undefined && options.batchConcurrency > 1
  logEffectiveProviderConcurrency(providerConcurrency, options.batchConcurrency, coordinatedAcrossBatch, requestedTargets)

  const promptRefresh = createPromptRefreshController({
    outputDir,
    preparedMedia: prepared,
    options,
    coordinatedAcrossBatch,
    successes
  })

  const workerContext: SttBatchWorkerContext = {
    outputDir,
    providersDir,
    requestedTargets,
    successes,
    failuresByIndex,
    providerStateMap,
    options,
    prepared,
    runOptions,
    batchCoordinator,
    mistralPassController,
    queuePromptRefresh: promptRefresh.queue
  }

  const localIndices = requestedTargets
    .map((target, index) => ({ target, index }))
    .filter((entry) => entry.target.local && targetsToRunKeys.has(getSttTargetKey(entry.target)))
    .map((entry) => entry.index)
  const cloudIndices = prioritizeCloudSttTargetIndices(requestedTargets)
    .filter((index) => targetsToRunKeys.has(getSttTargetKey(requestedTargets[index] as SttTarget)))

  await Promise.all([
    mapWithConcurrency(options.sttLocalConcurrency, localIndices, (index) => runSttProviderTargetAtIndex(workerContext, index)),
    batchCoordinator
      ? runCoordinatedSttTargetPool(
          cloudIndices,
          providerConcurrency.effective,
          requestedTargets,
          batchCoordinator,
          (index, reason) => markSttTargetSkipped(workerContext, index, reason),
          async (index, queueWaitMs) => await runSttProviderTargetAtIndex(workerContext, index, 'initial', queueWaitMs)
        )
      : mapWithConcurrency(providerConcurrency.effective, cloudIndices, (index) => runSttProviderTargetAtIndex(workerContext, index))
  ])

  if (!batchCoordinator) {
    await runSttRecoveryPasses(workerContext)
  }

  const derived = computeSttBatchDerivedState({ requestedTargets, successes, failuresByIndex, providerStateMap })

  promptRefresh.queue()
  await promptRefresh.flush()
  const promptSource = selectPrimaryPromptProvider(successes)

  const { cost } = await finalizeSttBatchCostTiming({
    outputDir,
    requestedTargets,
    options,
    prepared,
    preflightEstimate,
    processStart,
    providerConcurrency,
    coordinatedAcrossBatch,
    batchCoordinator,
    derived
  })

  return reportSttBatchOutcome({
    outputDir,
    requestedTargets,
    prepared,
    processStart,
    acquisitionTimeMs,
    cost,
    promptSource,
    derived
  })
}
