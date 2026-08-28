import { basename } from 'node:path'
import type { AggregatedPriceEstimate, EffectiveSttProviderConcurrency, PreparedSttMedia, ProviderFailure, StepTimingCost, SttBatchCoordinator, SttBatchCostTiming, SttBatchDerivedState, SttExtractionOptions, SttProviderState, SttProviderSuccess, SttTarget } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { logManifestLocation } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { describeSttBatchProviderSlotLimits, SttPartialCompletionError } from '../batch'
import { writePipelineItemRecords } from '../../../pipeline-manifest'
import { buildMetadataErrorEntries, buildMissingProviders, buildProviderStates, resolveCompletionStatus, summarizeSttProviderStates, toRequestedProvider } from '../stt-batch/stt-run-state'
import { filterEstimatedSttCosts, resolveSttEstimatedCosts } from '../stt-costs'
import { logSttProviderFailures, logSttProviderSkips, logSttRunStatus } from '../stt-logging'
import { buildProviderModelLabel, buildTimingProviderModelLabel } from '../stt-prompt'
import { formatProviderFailure } from '../stt-provider-failures'
import { formatSttTargetLabel } from '../stt-targets'
import { YOUTUBE_CAPTIONS_SERVICE } from '../youtube-captions'
import { formatProviderStateIssue, resolveRecordedSttStep2 } from './recorded-step2'

export const computeSttBatchDerivedState = ({
  requestedTargets,
  successes,
  failuresByIndex,
  providerStateMap
}: {
  requestedTargets: SttTarget[]
  successes: Array<SttProviderSuccess | undefined>
  failuresByIndex: Map<number, ProviderFailure>
  providerStateMap: Map<string, SttProviderState>
}): SttBatchDerivedState => {
  const successfulProviders = successes.filter((entry): entry is SttProviderSuccess => entry !== undefined)
  const failures = [...failuresByIndex.values()].sort((left, right) => left.index - right.index)
  const providerStates = buildProviderStates(requestedTargets, successes, failuresByIndex, providerStateMap)
  const completionStatus = resolveCompletionStatus(providerStates)
  const providerStateSummary = summarizeSttProviderStates(providerStates)
  const applicableTargets = requestedTargets.filter((_, index) => providerStates[index]?.status !== 'skipped')
  const skippedProviderStates = providerStates.filter((state) => state.status === 'skipped')
  const incompleteProviderStates = providerStates.filter((state) => state.status === 'failed' || state.status === 'missing')
  const missingProviders = buildMissingProviders(providerStates, requestedTargets)
  const metadataErrors = buildMetadataErrorEntries(providerStates)
  const providerIssueMessages = incompleteProviderStates.map(formatProviderStateIssue)

  return {
    successfulProviders,
    failures,
    providerStates,
    completionStatus,
    providerStateSummary,
    applicableTargets,
    skippedProviderStates,
    missingProviders,
    metadataErrors,
    providerIssueMessages
  }
}

export const finalizeSttBatchCostTiming = async ({
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
}: {
  outputDir: string
  requestedTargets: SttTarget[]
  options: SttExtractionOptions
  prepared: PreparedSttMedia
  preflightEstimate?: AggregatedPriceEstimate | undefined
  processStart: number
  providerConcurrency: EffectiveSttProviderConcurrency
  coordinatedAcrossBatch: boolean
  batchCoordinator: SttBatchCoordinator | undefined
  derived: SttBatchDerivedState
}): Promise<SttBatchCostTiming> => {
  const { successfulProviders, applicableTargets, providerStates, completionStatus, missingProviders, metadataErrors } = derived

  const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, applicableTargets, prepared.durationSeconds, prepared.step1Metadata.url))
  const observedEstimate = filterEstimatedSttCosts(resolveSttEstimatedCosts(undefined, applicableTargets, prepared.durationSeconds, prepared.step1Metadata.url))
  const actual = computeActualCosts({
    step1: prepared.step1Metadata,
    step2: successfulProviders.map((entry) => entry.metadata),
    audioDurationSeconds: prepared.durationSeconds
  })
  const cost = {
    estimated,
    observedEstimate,
    actual,
    aggregate: {
      estimatedTotalCost: estimated.totalCost,
      actualTotalCost: actual.totalCost
    }
  }
  const estimatedTiming = computeEstimatedProcessingTimes({
    sttTargets: applicableTargets.map((entry) => ({ service: entry.service, model: entry.model })),
    audioDurationSeconds: prepared.durationSeconds
  })
  const actualTiming = computeActualProcessingTimes({
    audioDurationSeconds: prepared.durationSeconds,
    step2: successfulProviders.map((entry) => entry.metadata)
  })
  const schedulerSnapshot = batchCoordinator?.getSchedulerSnapshot()
  const timing = {
    estimated: estimatedTiming,
    actual: actualTiming,
    aggregate: {
      wallTimeMs: Date.now() - processStart,
      scheduler: {
        hostedProviderCount: providerConcurrency.hostedProviderCount,
        itemProviderConcurrency: providerConcurrency.effective,
        coordinatedAcrossBatch,
        ...(coordinatedAcrossBatch
          ? {
              providerSlots: describeSttBatchProviderSlotLimits(requestedTargets, options.batchConcurrency),
              ...(schedulerSnapshot ? { providerStats: schedulerSnapshot.providers } : {})
            }
          : {})
      },
      providers: successfulProviders.map((entry) => ({
        service: entry.metadata.transcriptionService,
        model: entry.metadata.transcriptionModel,
        processingTimeMs: entry.metadata.processingTime,
        ...(entry.metadata.timings ? { timings: entry.metadata.timings } : {})
      }))
    }
  }

  const metadataJson = JSON.stringify({
    step1: prepared.step1Metadata,
    step2: successfulProviders.map((entry) => entry.metadata),
    resolvedStep2: resolveRecordedSttStep2(requestedTargets, options),
    completionStatus,
    requestedProviders: requestedTargets.map(toRequestedProvider),
    providerStates,
    missingProviders,
    cost,
    timing,
    ...(metadataErrors.length > 0 ? { errors: metadataErrors } : {})
  }, null, 2)
  await writePipelineItemRecords(outputDir, 'extract', 'single', [JSON.parse(metadataJson)], { extractRoute: 'media' })
  logManifestLocation(outputDir, l, 'extract')
  l.debug(`Canonical manifest item metadata:\n${metadataJson}`, { category: 'artifact' })

  return { cost, timing }
}

export const reportSttBatchOutcome = ({
  outputDir,
  requestedTargets,
  prepared,
  processStart,
  acquisitionTimeMs,
  cost,
  promptSource,
  derived
}: {
  outputDir: string
  requestedTargets: SttTarget[]
  prepared: PreparedSttMedia
  processStart: number
  acquisitionTimeMs: number
  cost: SttBatchCostTiming['cost']
  promptSource: SttProviderSuccess | undefined
  derived: SttBatchDerivedState
}): string => {
  const { successfulProviders, failures, completionStatus, providerStateSummary, skippedProviderStates, missingProviders, providerIssueMessages } = derived
  const actual = cost.actual

  const actualSttSteps = actual.steps.filter((step) => step.step === 'stt')
  const stepSummaries: StepTimingCost[] = [
    {
      label: 'Download',
      processingTime: acquisitionTimeMs,
      cost: 0
    },
    ...successfulProviders.map((entry, index) => ({
      label: 'Transcribe',
      providerModel: buildTimingProviderModelLabel(entry.metadata),
      processingTime: entry.metadata.processingTime,
      cost: actualSttSteps[index]?.cost ?? 0
    }))
  ]

  if (completionStatus === 'full') {
    logSttProviderSkips(l, skippedProviderStates)
    const artifactFiles: Record<string, string> = {
      prompt: 'prompt.md',
      manifest: 'manifest.json'
    }
    artifactFiles['audio'] = basename(prepared.outputArtifacts.sourceMediaPath)
    if (successfulProviders.some((entry) => entry.metadata.transcriptionService === YOUTUBE_CAPTIONS_SERVICE)) {
      artifactFiles['captions'] = 'youtube-captions.vtt'
      artifactFiles['captionMetadata'] = 'youtube-captions.json'
    }
    for (const entry of successfulProviders) {
      const dir = entry.relativeDir as string
      const key = `${entry.metadata.transcriptionService}-${entry.metadata.transcriptionModel}`
      artifactFiles[`transcript-${key}`] = `${dir}/transcription.txt`
      artifactFiles[`result-${key}`] = `${dir}/result.json`
    }

    l.report.complete(outputDir, artifactFiles, {
      metrics: {
        providersRequested: requestedTargets.length,
        providersSucceeded: providerStateSummary.succeeded,
        providersFailed: 0,
        providersSkipped: providerStateSummary.skipped,
        partial: false,
        completionStatus,
        ...(promptSource
          ? { promptSource: buildProviderModelLabel(promptSource.metadata) }
          : {})
      },
      steps: stepSummaries,
      totalTimeMs: Date.now() - processStart,
      totalCost: actual.totalCost
    })

    return outputDir
  }

  logSttRunStatus(l, {
    completionStatus,
    requested: requestedTargets.length,
    succeeded: providerStateSummary.succeeded,
    failed: providerStateSummary.failed,
    missing: missingProviders.length,
    skipped: providerStateSummary.skipped
  })
  logSttProviderFailures(l, failures)
  logSttProviderSkips(l, skippedProviderStates)
  l.warn('Output directory preserved for retry/backfill', { category: 'artifact' })
  l.write('warn', 'Locations', {
    category: 'artifact',
    humanTable: createKeyValueTable([['retryOutputDir', outputDir]], 'artifact', 'path')
  })

  throw new SttPartialCompletionError(
    outputDir,
    completionStatus,
    missingProviders,
    completionStatus === 'failed'
      ? failures.length > 0
        ? `All applicable STT providers failed: ${failures.map(formatProviderFailure).join('; ')}`
        : providerIssueMessages.length > 0
          ? `No requested STT provider produced a transcript: ${providerIssueMessages.join('; ')}`
          : 'No requested STT provider produced a transcript.'
      : providerIssueMessages.length > 0
        ? `Missing STT provider outputs: ${providerIssueMessages.join('; ')}`
        : missingProviders.length > 0
          ? `Missing STT provider outputs: ${missingProviders.map(formatSttTargetLabel).join(', ')}`
          : 'Missing STT provider outputs.'
  )
}
