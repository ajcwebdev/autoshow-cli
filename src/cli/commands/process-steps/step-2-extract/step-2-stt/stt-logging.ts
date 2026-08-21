import { createHumanTable, createKeyValueTable, createSingleRowTable } from '~/utils/app-logger/human-table/human-table'
import { defineTableLog } from '~/utils/app-logger/table-log-definition'
import type { AudioSegmentDescriptor, EffectiveSttProviderConcurrency, HumanLogTable, LogLevel, ProviderFailure, SplitPolicyTarget, SttAcquireSummary, SttAsyncJobLifecycle, ProviderCompletionStatus, SttProviderConcurrencySummary, SttProviderSlotSummary, SttProviderState, SttRunStatusSummary, SttSegmentLifecycle, SttSplitDecision, SttSplitDecisionReason, SttSplitRetryReason, TableLogger } from '~/types'
import { formatSttTargetLabel } from './stt-targets'
const formatBytes = (bytes: number | undefined): string => {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < (1024 * 1024 * 1024)) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatSeconds = (seconds: number | undefined): string => {
  if (seconds === undefined) return ''
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`
}

const formatMinutes = (minutes: number | undefined): string => {
  if (minutes === undefined) return ''
  const rounded = Number.isInteger(minutes) ? String(minutes) : String(Number(minutes.toFixed(3)))
  return `${rounded}m`
}

const describeSplitReason = (reason: SttSplitDecisionReason | { kind: SttSplitRetryReason }): string => {
  if (reason.kind === 'explicit') {
    return 'explicit'
  }

  return reason.kind
}

const getSplitReasonCap = (reason: SttSplitDecisionReason | { kind: SttSplitRetryReason }): string => {
  if (reason.kind === 'attachment_cap' && 'attachmentCapBytes' in reason) {
    return formatBytes(reason.attachmentCapBytes)
  }
  if (reason.kind === 'duration_cap' && 'maxDurationSeconds' in reason) {
    return formatSeconds(reason.maxDurationSeconds)
  }
  if (reason.kind === 'request_budget' && 'requestBudgetSeconds' in reason) {
    return formatSeconds(reason.requestBudgetSeconds)
  }
  return ''
}

const getSplitReasonInputSize = (reason: SttSplitDecisionReason): string =>
  reason.kind === 'attachment_cap' ? formatBytes(reason.audioFileSizeBytes) : ''

const getSplitReasonInputDuration = (reason: SttSplitDecisionReason): string =>
  reason.kind === 'duration_cap' || reason.kind === 'request_budget'
    ? formatSeconds(reason.audioDurationSeconds)
    : ''

type SttDiarizationConfigSummary = {
  provider: string
  model?: string | undefined
  enabled?: boolean | undefined
  speakerCount?: number | undefined
  maxSpeakers?: number | undefined
  detail?: string | undefined
}

const buildSttDiarizationConfigTableValue = (
  summary: SttDiarizationConfigSummary
): HumanLogTable =>
  createKeyValueTable([
    ['provider', summary.provider],
    ...(summary.model ? [['model', summary.model] as const] : []),
    ...(summary.enabled !== undefined ? [['enabled', summary.enabled] as const] : []),
    ...(summary.speakerCount !== undefined ? [['speakerCount', summary.speakerCount] as const] : []),
    ...(summary.maxSpeakers !== undefined ? [['maxSpeakers', summary.maxSpeakers] as const] : []),
    ...(summary.detail ? [['detail', summary.detail] as const] : [])
  ])

export const { buildTable: buildSttDiarizationConfigTable, log: logSttDiarizationConfig } = defineTableLog<SttDiarizationConfigSummary>({
  title: 'STT Diarization',
  category: 'pipeline',
  buildTable: buildSttDiarizationConfigTableValue,
  level: 'info',
  metadata: summary => summary
})

export const buildSttSplitDecisionTable = (
  target: SplitPolicyTarget,
  decision: Pick<SttSplitDecision, 'reasons' | 'segmentDurationMinutes'>,
  options: {
    trigger?: 'auto' | 'retry' | 'explicit' | undefined
    retryReason?: SttSplitRetryReason | undefined
    audioFileSizeBytes?: number | undefined
    audioDurationSeconds?: number | undefined
  } = {}
): HumanLogTable => {
  const reasons = decision.reasons.length > 0
    ? decision.reasons
    : options.retryReason
      ? [{ kind: options.retryReason }]
      : [{ kind: 'explicit' as const }]

  return createHumanTable(
    reasons.map((reason) => ({
      provider: target.service,
      model: target.model,
      trigger: options.trigger ?? (reason.kind === 'explicit' ? 'explicit' : 'auto'),
      reason: describeSplitReason(reason),
      cap: getSplitReasonCap(reason),
      inputSize: reason.kind === 'attachment_cap'
        ? getSplitReasonInputSize(reason as SttSplitDecisionReason)
        : formatBytes(options.audioFileSizeBytes),
      inputDuration: reason.kind === 'duration_cap' || reason.kind === 'request_budget'
        ? getSplitReasonInputDuration(reason as SttSplitDecisionReason)
        : formatSeconds(options.audioDurationSeconds),
      segmentDuration: formatMinutes(decision.segmentDurationMinutes)
    })),
    ['provider', 'model', 'trigger', 'reason', 'cap', 'inputSize', 'inputDuration', 'segmentDuration']
  )
}

export const logSttSplitDecision = (
  logger: TableLogger,
  target: SplitPolicyTarget,
  decision: Pick<SttSplitDecision, 'reasons' | 'segmentDurationMinutes'>,
  options: {
    trigger?: 'auto' | 'retry' | 'explicit' | undefined
    retryReason?: SttSplitRetryReason | undefined
    audioPath?: string | undefined
    audioFileSizeBytes?: number | undefined
    audioDurationSeconds?: number | undefined
    level?: LogLevel | undefined
  } = {}
): void => {
  logger.write(options.level ?? 'warn', 'STT Split', {
    category: 'pipeline',
    humanTable: buildSttSplitDecisionTable(target, decision, options),
    metadata: {
      target,
      decision,
      trigger: options.trigger,
      retryReason: options.retryReason,
      audioPath: options.audioPath,
      audioFileSizeBytes: options.audioFileSizeBytes,
      audioDurationSeconds: options.audioDurationSeconds
    }
  })
}

type SttSplitSummary = {
  input: string
  segmentDurationMinutes: number
  totalDurationSeconds: number
  totalSegments: number
}

const buildSttSplitSummaryTableValue = (
  summary: SttSplitSummary
): HumanLogTable =>
  createKeyValueTable([
    ['input', summary.input],
    ['segmentDuration', formatMinutes(summary.segmentDurationMinutes)],
    ['totalDuration', formatSeconds(summary.totalDurationSeconds)],
    ['totalSegments', summary.totalSegments]
  ])

export const buildSttSplitSegmentsTable = (
  segments: readonly AudioSegmentDescriptor[]
): HumanLogTable =>
  createHumanTable(
    segments.map((segment) => ({
      segment: `${segment.segmentNumber}/${segment.totalSegments}`,
      start: formatSeconds(segment.startSeconds),
      duration: formatSeconds(segment.durationSeconds),
      path: segment.path
    })),
    ['segment', 'start', 'duration', 'path']
  )

export const { log: logSttSplitSummary } = defineTableLog<SttSplitSummary>({
  title: 'STT Split Plan',
  category: 'pipeline',
  buildTable: buildSttSplitSummaryTableValue,
  level: 'info',
  metadata: summary => summary
})

const sttSplitSegmentsLog = defineTableLog<readonly AudioSegmentDescriptor[]>({
  title: 'STT Split Segments',
  category: 'artifact',
  buildTable: buildSttSplitSegmentsTable,
  level: 'success',
  metadata: segments => ({ segments })
})

export const logSttSplitSegments = sttSplitSegmentsLog.log

type SttTranscriptOutputSummary = {
  provider: string
  path: string
  characters: number
  speakers?: number | undefined
}

const buildSttTranscriptOutputTableValue = (
  summary: SttTranscriptOutputSummary
): HumanLogTable =>
  createKeyValueTable([
    ['provider', summary.provider],
    ['path', summary.path],
    ['characters', summary.characters],
    ...(summary.speakers !== undefined ? [['speakers', summary.speakers] as const] : [])
  ])

export const { buildTable: buildSttTranscriptOutputTable, log: logSttTranscriptOutput } = defineTableLog<SttTranscriptOutputSummary>({
  title: 'Transcript Output',
  category: 'artifact',
  buildTable: buildSttTranscriptOutputTableValue,
  level: 'info',
  metadata: summary => summary
})

export const buildSttCleanupArtifactsTable = (
  rows: ReadonlyArray<{ artifact: string, path: string }>
): HumanLogTable =>
  createHumanTable(rows, ['artifact', 'path'])

type SttCleanupFailureSummary = {
  provider: string
  artifact: string
  id: string
  detail: string
}

const buildSttCleanupFailureTableValue = (
  summary: SttCleanupFailureSummary
): HumanLogTable =>
  createHumanTable([summary], ['provider', 'artifact', 'id', 'detail'])

export const { log: logSttCleanupFailure } = defineTableLog<SttCleanupFailureSummary>({
  title: 'STT Cleanup',
  category: 'artifact',
  buildTable: buildSttCleanupFailureTableValue,
  level: 'warn',
  metadata: summary => summary
})

export const buildSttProviderSpeakerCountHintsTable = (
  rows: ReadonlyArray<{ provider: string, speakerCount: number, support: 'honored' | 'ignored' }>
): HumanLogTable =>
  createHumanTable(rows, ['provider', 'speakerCount', 'support'])

export const logSttProviderSpeakerCountHints = (
  logger: TableLogger,
  rows: ReadonlyArray<{ provider: string, speakerCount: number, support: 'honored' | 'ignored' }>
): void => {
  if (rows.length === 0) {
    return
  }

  logger.write('warn', 'Provider Speaker Count Hints', {
    category: 'pipeline',
    humanTable: buildSttProviderSpeakerCountHintsTable(rows),
    metadata: { rows }
  })
}

type SttRecoveryPassSummary = {
  pass: number
  maxPasses: number
  failures: number
  providers: string
}

const buildSttRecoveryPassTableValue = (
  summary: SttRecoveryPassSummary
): HumanLogTable =>
  createHumanTable([summary], ['pass', 'maxPasses', 'failures', 'providers'])

export const { log: logSttRecoveryPass } = defineTableLog<SttRecoveryPassSummary>({
  title: 'STT Recovery Pass',
  category: 'pipeline',
  buildTable: buildSttRecoveryPassTableValue,
  level: 'warn',
  metadata: summary => summary
})

const buildSttAcquireRows = (
  summary: SttAcquireSummary
): Array<{ item: string, sourceMedia: string, sourceMediaMs: string | number, elapsedMs: number }> => [{
  item: summary.item,
  sourceMedia: summary.sourceMedia,
  sourceMediaMs: summary.sourceMediaMs ?? '',
  elapsedMs: summary.elapsedMs
}]

const buildSttAcquireTableValue = (
  summary: SttAcquireSummary
): HumanLogTable =>
  createHumanTable(buildSttAcquireRows(summary), ['item', 'sourceMedia', 'sourceMediaMs', 'elapsedMs'])

export const { log: logSttAcquireSummary } = defineTableLog<SttAcquireSummary>({
  title: 'STT Acquire',
  category: 'artifact',
  buildTable: buildSttAcquireTableValue,
  level: 'info',
  metadata: summary => summary
})

const buildSttAsyncJobRows = (
  lifecycle: SttAsyncJobLifecycle
): Array<{ provider: string, action: string, remoteId: string, state: string }> => [{
  provider: lifecycle.provider,
  action: lifecycle.action,
  remoteId: lifecycle.remoteId,
  state: lifecycle.state
}]

const buildSttAsyncJobTableValue = (
  lifecycle: SttAsyncJobLifecycle
): HumanLogTable =>
  createHumanTable(buildSttAsyncJobRows(lifecycle), ['provider', 'action', 'remoteId', 'state'])

export const { log: logSttAsyncJobLifecycle } = defineTableLog<SttAsyncJobLifecycle>({
  title: 'Async STT Job',
  category: 'pipeline',
  buildTable: buildSttAsyncJobTableValue,
  level: 'info',
  metadata: lifecycle => lifecycle
})

const buildSttSegmentLifecycleRows = (
  lifecycle: SttSegmentLifecycle
): Array<{
  provider: string
  action: string
  segment: string
  model: string
  processingTimeMs: number | ''
  detail: string
}> => [{
  provider: lifecycle.provider,
  action: lifecycle.action,
  segment: lifecycle.segmentNumber !== undefined && lifecycle.totalSegments !== undefined
    ? `${lifecycle.segmentNumber}/${lifecycle.totalSegments}`
    : '',
  model: lifecycle.model ?? '',
  processingTimeMs: lifecycle.processingTimeMs ?? '',
  detail: lifecycle.detail ?? ''
}]

const buildSttSegmentLifecycleTableValue = (
  lifecycle: SttSegmentLifecycle
): HumanLogTable =>
  createHumanTable(
    buildSttSegmentLifecycleRows(lifecycle),
    ['provider', 'action', 'segment', 'model', 'processingTimeMs', 'detail']
  )

export const { log: logSttSegmentLifecycle } = defineTableLog<SttSegmentLifecycle>({
  title: 'STT Segment',
  category: 'pipeline',
  buildTable: buildSttSegmentLifecycleTableValue,
  level: lifecycle => lifecycle.action === 'completed' ? 'success' : 'info',
  metadata: lifecycle => lifecycle
})

const buildSttRunStatusRows = (
  summary: SttRunStatusSummary
): Array<{
  completionStatus: ProviderCompletionStatus
  requested: number
  succeeded: number
  failed: number
  missing: number
  skipped: number
}> => [{
  completionStatus: summary.completionStatus,
  requested: summary.requested,
  succeeded: summary.succeeded,
  failed: summary.failed,
  missing: summary.missing,
  skipped: summary.skipped
}]

const buildSttRunStatusTableValue = (
  summary: SttRunStatusSummary
): HumanLogTable =>
  createHumanTable(
    buildSttRunStatusRows(summary),
    ['completionStatus', 'requested', 'succeeded', 'failed', 'missing', 'skipped']
  )

export const { log: logSttRunStatus } = defineTableLog<SttRunStatusSummary>({
  title: 'Run Status',
  category: 'pipeline',
  buildTable: buildSttRunStatusTableValue,
  level: 'warn',
  metadata: summary => summary
})

export const buildSttProviderConcurrencyTable = (
  summary: SttProviderConcurrencySummary
): HumanLogTable =>
  createSingleRowTable({
    mode: summary.mode,
    requested: summary.requested,
    effective: summary.effective,
    batch: summary.batchConcurrency,
    providers: summary.hostedProviders
  }, [
    'mode',
    'requested',
    'effective',
    'batch',
    'providers'
  ])

export const buildSttProviderSlotsTable = (
  providerSlots: readonly SttProviderSlotSummary[]
): HumanLogTable =>
  createHumanTable(
    providerSlots.map((slot) => ({
      provider: slot.provider,
      kind: slot.kind,
      launch: slot.launchSlots,
      poll: slot.pollSlots ?? ''
    })),
    ['provider', 'kind', 'launch', 'poll']
  )

export const logSttProviderConcurrency = (
  logger: TableLogger,
  resolution: EffectiveSttProviderConcurrency,
  batchConcurrency: number,
  coordinatedAcrossBatch: boolean,
  providerSlots: string,
  providerSlotDetails: readonly SttProviderSlotSummary[]
): void => {
  const summary: SttProviderConcurrencySummary = {
    mode: coordinatedAcrossBatch ? 'batch_scheduler' : 'cloud_provider_concurrency',
    requested: resolution.requested,
    effective: resolution.effective,
    batchConcurrency,
    hostedProviders: resolution.hostedProviderCount,
    providerSlots
  }

  const metadata = {
    ...summary,
    providerSlotDetails
  }

  const message = coordinatedAcrossBatch ? 'STT Batch Scheduler' : 'STT Provider Concurrency'

  logger.write('info', message, {
    category: 'pipeline',
    humanTable: buildSttProviderConcurrencyTable(summary),
    metadata
  })

  logger.write('info', 'STT Provider Slots', {
    category: 'pipeline',
    humanTable: buildSttProviderSlotsTable(providerSlotDetails),
    metadata: {
      providerSlots,
      providerSlotDetails
    }
  })
}

const summarizeProviderFailureReason = (
  failure: Pick<ProviderFailure, 'stage' | 'status'>
): string => {
  if (typeof failure.status === 'number') {
    return `status ${failure.status}`
  }
  if (failure.stage) {
    return failure.stage
  }
  return 'failed'
}

const buildSttProviderFailureTable = (
  failures: readonly ProviderFailure[]
): HumanLogTable => {
  const table = createHumanTable(
    failures.map((failure) => ({
      provider: formatSttTargetLabel(failure),
      stage: failure.stage ?? '',
      status: failure.status ?? '',
      reason: summarizeProviderFailureReason(failure)
    })),
    ['provider', 'stage', 'status', 'reason']
  )
  return {
    ...table,
    details: [
      ...(table.details ?? []),
      ...failures.map((failure) => ({
        label: `${formatSttTargetLabel(failure)} detail`,
        value: failure.message
      }))
    ]
  }
}

export const logSttProviderFailures = (
  logger: TableLogger,
  failures: readonly ProviderFailure[],
  level: LogLevel = 'warn'
): void => {
  if (failures.length === 0) {
    return
  }

  logger.write(level, 'Provider Failures', {
    category: 'pipeline',
    humanTable: buildSttProviderFailureTable(failures),
    metadata: {
      failures: failures.map((failure) => ({
        provider: formatSttTargetLabel(failure),
        stage: failure.stage,
        status: failure.status,
        detail: failure.message
      }))
    }
  })
}

const buildSttProviderSkipTable = (
  skippedProviders: ReadonlyArray<Pick<SttProviderState, 'service' | 'model' | 'lastError'>>
): HumanLogTable => {
  const table = createHumanTable(
    skippedProviders.map((state) => ({
      provider: formatSttTargetLabel(state),
      stage: state.lastError?.stage ?? '',
      status: state.lastError?.status ?? '',
      reason: state.lastError
        ? summarizeProviderFailureReason({
          stage: state.lastError.stage,
          status: state.lastError.status
        })
        : 'skipped'
    })),
    ['provider', 'stage', 'status', 'reason']
  )
  return {
    ...table,
    details: [
      ...(table.details ?? []),
      ...skippedProviders.map((state) => ({
        label: `${formatSttTargetLabel(state)} detail`,
        value: state.lastError?.message ?? 'skipped'
      }))
    ]
  }
}

export const logSttProviderSkips = (
  logger: TableLogger,
  skippedProviders: ReadonlyArray<Pick<SttProviderState, 'service' | 'model' | 'lastError'>>,
  level: LogLevel = 'warn'
): void => {
  if (skippedProviders.length === 0) {
    return
  }

  logger.write(level, 'Provider Skips', {
    category: 'pipeline',
    humanTable: buildSttProviderSkipTable(skippedProviders),
    metadata: {
      skipped: skippedProviders.map((state) => ({
        provider: formatSttTargetLabel(state),
        stage: state.lastError?.stage,
        status: state.lastError?.status,
        detail: state.lastError?.message ?? 'skipped'
      }))
    }
  })
}
