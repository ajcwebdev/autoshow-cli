import { basename } from 'node:path'
import type { AggregatedPriceEstimate, EffectiveSttProviderConcurrency, Step2ProviderSelectionOrigin, PreparedSttMedia, ProviderFailure, StepTimingCost, SttBatchCoordinator, SttBatchCostTiming, SttBatchDerivedState, SttExtractionOptions, SttProviderState, SttProviderSuccess, SttTarget } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { isRecord } from '~/utils/rest-client'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { logManifestLocation } from '~/cli/commands/command-shared/write-manifest-log/write-manifest-log'
import { describeSttBatchProviderSlotLimits, SttPartialCompletionError } from '../batch'
import { writePipelineItemRecords } from '../../command-shared/pipeline-manifest'
import { buildMetadataErrorEntries, buildMissingProviders, buildProviderStates, resolveCompletionStatus, summarizeSttProviderStates, toRequestedProvidersPreservingStored } from '../stt-batch/stt-run-state'
import { filterEstimatedSttCosts, resolveSttEstimatedCosts } from '../stt-costs'
import { logSttProviderFailures, logSttProviderSkips, logSttRunStatus } from '../stt-logging'
import { buildProviderModelLabel, buildTimingProviderModelLabel } from '../stt-prompt'
import { formatProviderFailure } from '../stt-provider-failures'
import { formatSttTargetLabel } from '../stt-targets'
import { YOUTUBE_CAPTIONS_SERVICE } from '~/cli/commands/text/url/url-services/youtube-captions/youtube-captions'
import { formatProviderStateIssue, resolveRecordedSttStep2 } from './recorded-step2'

export const computeSttBatchDerivedState = ({
  requestedTargets,
  successes,
  failuresByIndex,
  providerStateMap,
  preservedStates
}: {
  requestedTargets: SttTarget[]
  successes: Array<SttProviderSuccess | undefined>
  failuresByIndex: Map<number, ProviderFailure>
  providerStateMap: Map<string, SttProviderState>
  preservedStates?: ReadonlyMap<string, SttProviderState> | undefined
}): SttBatchDerivedState => {
  const successfulProviders = successes.filter((entry): entry is SttProviderSuccess => entry !== undefined)
  const failures = [...failuresByIndex.values()].sort((left, right) => left.index - right.index)
  const providerStates = buildProviderStates(requestedTargets, successes, failuresByIndex, providerStateMap, preservedStates)
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

type StepSection = { steps?: unknown, [key: string]: unknown }

const stepKey = (step: Record<string, unknown>): string =>
  `${String(step['provider'] ?? step['service'])}:${String(step['model'])}`

const nested = (record: Record<string, unknown> | undefined, ...path: string[]): unknown =>
  path.reduce<unknown>((value, key) => isRecord(value) ? value[key] : undefined, record)

// Targets a resume pass did not dispatch keep their recorded steps (including steps for retired models,
// which a fresh estimate could no longer reproduce); only dispatched targets get fresh steps, and the total
// is re-summed so it covers both.
const keepHistoricalSteps = <T extends StepSection>(
  fresh: T,
  stored: unknown,
  historicalKeys: ReadonlySet<string>,
  totalField: 'totalCost' | 'totalProcessingTimeMs',
  valueField: 'cost' | 'processingTimeMs'
): T => {
  if (historicalKeys.size === 0 || !isRecord(stored) || !Array.isArray(stored['steps']) || !Array.isArray(fresh.steps)) {
    return fresh
  }
  const storedSteps = stored['steps'].filter(isRecord)
  const steps = (fresh.steps as unknown[]).map((step) => {
    if (!isRecord(step) || step['step'] !== 'stt' || !historicalKeys.has(stepKey(step))) return step
    return storedSteps.find((candidate) => candidate['step'] === 'stt' && stepKey(candidate) === stepKey(step)) ?? step
  })
  const total = steps.reduce<number>((sum, step) => sum + (isRecord(step) && typeof step[valueField] === 'number' ? step[valueField] : 0), 0)
  return { ...fresh, steps, [totalField]: total }
}

// A provider's recorded selection origin is part of its identity; resume flags must not erase it.
const mergeStoredResolvedStep2 = (
  fresh: ReturnType<typeof resolveRecordedSttStep2>,
  stored: unknown
): ReturnType<typeof resolveRecordedSttStep2> => {
  const storedProviders = isRecord(stored) && Array.isArray(stored['providers']) ? stored['providers'].filter(isRecord) : []
  if (storedProviders.length === 0 || fresh.route !== 'stt') return fresh
  return {
    ...fresh,
    providers: fresh.providers.map((provider) => {
      const previous = storedProviders.find((entry) => entry['service'] === provider.service && entry['model'] === provider.model)
      return previous && typeof previous['origin'] === 'string' && provider.origin === undefined
        ? { ...provider, origin: previous['origin'] as Step2ProviderSelectionOrigin }
        : provider
    })
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
  derived,
  existingItemRecord,
  historicalKeys = new Set<string>()
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
  existingItemRecord?: Record<string, unknown> | undefined
  historicalKeys?: ReadonlySet<string> | undefined
}): Promise<SttBatchCostTiming> => {
  const { successfulProviders, applicableTargets, providerStates, completionStatus, missingProviders, metadataErrors } = derived
  const keep = <T extends StepSection>(fresh: T, path: string[], totalField: 'totalCost' | 'totalProcessingTimeMs', valueField: 'cost' | 'processingTimeMs'): T =>
    keepHistoricalSteps(fresh, nested(existingItemRecord, ...path), historicalKeys, totalField, valueField)

  const estimated = keep(filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, applicableTargets, prepared.durationSeconds, prepared.step1Metadata.url)), ['cost', 'estimated'], 'totalCost', 'cost')
  const observedEstimate = keep(filterEstimatedSttCosts(resolveSttEstimatedCosts(undefined, applicableTargets, prepared.durationSeconds, prepared.step1Metadata.url)), ['cost', 'observedEstimate'], 'totalCost', 'cost')
  const actual = keep(computeActualCosts({
    step1: prepared.step1Metadata,
    step2: successfulProviders.map((entry) => entry.metadata),
    audioDurationSeconds: prepared.durationSeconds
  }), ['cost', 'actual'], 'totalCost', 'cost')
  const cost = {
    estimated,
    observedEstimate,
    actual,
    aggregate: {
      estimatedTotalCost: estimated.totalCost,
      actualTotalCost: actual.totalCost
    }
  }
  const estimatedTiming = keep(computeEstimatedProcessingTimes({
    sttTargets: applicableTargets.map((entry) => ({ service: entry.service, model: entry.model })),
    audioDurationSeconds: prepared.durationSeconds
  }), ['timing', 'estimated'], 'totalProcessingTimeMs', 'processingTimeMs')
  const actualTiming = keep(computeActualProcessingTimes({
    audioDurationSeconds: prepared.durationSeconds,
    step2: successfulProviders.map((entry) => entry.metadata)
  }), ['timing', 'actual'], 'totalProcessingTimeMs', 'processingTimeMs')
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
    resolvedStep2: mergeStoredResolvedStep2(resolveRecordedSttStep2(requestedTargets, options), nested(existingItemRecord, 'resolvedStep2')),
    completionStatus,
    requestedProviders: toRequestedProvidersPreservingStored(requestedTargets, options, existingItemRecord, historicalKeys),
    providerStates,
    missingProviders,
    cost,
    timing,
    ...(metadataErrors.length > 0 ? { errors: metadataErrors } : {})
  }, null, 2)
  await writePipelineItemRecords(outputDir, 'extract', 'single', [JSON.parse(metadataJson)], { extractRoute: 'media' })
  logManifestLocation(outputDir, 'extract')
  l.debug(`Canonical manifest item metadata:\n${metadataJson}`, { category: 'artifact' })

  return { cost, timing }
}

export const reportSttBatchOutcome = ({
  captionFiles = {},
  outputDir,
  requestedTargets,
  prepared,
  processStart,
  acquisitionTimeMs,
  cost,
  promptSource,
  derived
}: {
  captionFiles?: Record<string, string>
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
    logSttProviderSkips( skippedProviderStates)
    const artifactFiles: Record<string, string> = {
      ...captionFiles,
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

  logSttRunStatus( {
    completionStatus,
    requested: requestedTargets.length,
    succeeded: providerStateSummary.succeeded,
    failed: providerStateSummary.failed,
    missing: missingProviders.length,
    skipped: providerStateSummary.skipped
  })
  logSttProviderFailures( failures)
  logSttProviderSkips( skippedProviderStates)
  l.warn('Output directory preserved for retry/backfill', { category: 'artifact' })
  l.write('warn', `Retry output retained at ${outputDir}`, {
    category: 'artifact',
    metadata: { retryOutputDir: outputDir }
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
