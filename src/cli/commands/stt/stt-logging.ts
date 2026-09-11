import type { AudioSegmentDescriptor, EffectiveSttProviderConcurrency, LogLevel, ProviderFailure, SplitPolicyTarget, SttAcquireSummary, SttAsyncJobLifecycle, SttCleanupFailureSummary, SttDiarizationConfigSummary, SttProviderSlotSummary, SttProviderState, SttRecoveryPassSummary, SttRunStatusSummary, SttSegmentLifecycle, SttSplitDecision, SttSplitRetryReason, SttSplitSummary, SttTranscriptOutputSummary } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { formatSttTargetLabel } from './stt-targets'

const formatSeconds = (seconds: number | undefined): string => {
  if (seconds === undefined) return 'unknown duration'
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`
}

const formatMinutes = (minutes: number | undefined): string => {
  if (minutes === undefined) return 'unknown duration'
  const rounded = Number.isInteger(minutes) ? String(minutes) : String(Number(minutes.toFixed(3)))
  return `${rounded}m`
}

export const logSttDiarizationConfig = (summary: SttDiarizationConfigSummary): void => {
  const state = summary.enabled === undefined ? 'provider default' : summary.enabled ? 'enabled' : 'disabled'
  l.write('info', `STT diarization ${state} for ${summary.provider}`, {
    category: 'pipeline',
    metadata: summary
  })
}

export const logSttSplitDecision = (
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
  const reasons = decision.reasons.map(reason => reason.kind)
  if (reasons.length === 0) reasons.push(options.retryReason ?? 'explicit')
  l.write(options.level ?? 'warn', `Splitting STT input for ${formatSttTargetLabel(target)} into ${formatMinutes(decision.segmentDurationMinutes)} segments`, {
    category: 'pipeline',
    metadata: {
      target,
      decision,
      reasons,
      trigger: options.trigger,
      retryReason: options.retryReason,
      audioPath: options.audioPath,
      audioFileSizeBytes: options.audioFileSizeBytes,
      audioDurationSeconds: options.audioDurationSeconds
    }
  })
}

export const logSttSplitSummary = (summary: SttSplitSummary): void => {
  l.write('info', `STT split planned ${summary.totalSegments} segments over ${formatSeconds(summary.totalDurationSeconds)}`, {
    category: 'pipeline',
    metadata: summary
  })
}

export const logSttSplitSegments = (segments: readonly AudioSegmentDescriptor[]): void => {
  l.write('info', `Prepared ${segments.length} STT audio segments`, {
    category: 'artifact',
    metadata: { segments }
  })
}

export const logSttTranscriptOutput = (summary: SttTranscriptOutputSummary): void => {
  l.write('info', `Wrote ${summary.provider} transcript to ${summary.path}`, {
    category: 'artifact',
    metadata: summary
  })
}

export const logSttCleanupFailure = (summary: SttCleanupFailureSummary): void => {
  l.write('warn', `Could not clean up ${summary.provider} ${summary.artifact}: ${summary.detail}`, {
    category: 'artifact',
    metadata: summary
  })
}

export const logSttProviderSpeakerCountHints = (
  rows: ReadonlyArray<{ provider: string, speakerCount: number, support: 'honored' | 'ignored' }>
): void => {
  if (rows.length === 0) return
  const ignored = rows.filter(row => row.support === 'ignored').length
  l.write('warn', `Speaker-count hints configured for ${rows.length} providers; ${ignored} will ignore them`, {
    category: 'pipeline',
    metadata: { rows }
  })
}

export const logSttRecoveryPass = (summary: SttRecoveryPassSummary): void => {
  l.write('warn', `STT recovery pass ${summary.pass}/${summary.maxPasses} for ${summary.failures} failures`, {
    category: 'pipeline',
    metadata: summary
  })
}

export const logSttAcquireSummary = (summary: SttAcquireSummary): void => {
  l.write('info', `Acquired STT source media for ${summary.item} in ${summary.elapsedMs}ms`, {
    category: 'artifact',
    metadata: summary
  })
}

export const logSttAsyncJobLifecycle = (lifecycle: SttAsyncJobLifecycle): void => {
  l.write('info', `${lifecycle.provider} async STT job ${lifecycle.action}: ${lifecycle.state}`, {
    category: 'pipeline',
    metadata: lifecycle
  })
}

export const logSttSegmentLifecycle = (lifecycle: SttSegmentLifecycle): void => {
  const segment = lifecycle.segmentNumber !== undefined && lifecycle.totalSegments !== undefined
    ? ` ${lifecycle.segmentNumber}/${lifecycle.totalSegments}`
    : ''
  l.write('info', `${lifecycle.provider} STT segment${segment} ${lifecycle.action}`, {
    category: 'pipeline',
    metadata: lifecycle
  })
}

export const logSttRunStatus = (summary: SttRunStatusSummary): void => {
  l.write('warn', `STT run ${summary.completionStatus}: ${summary.succeeded}/${summary.requested} succeeded`, {
    category: 'pipeline',
    metadata: summary
  })
}

export const logSttProviderConcurrency = (
  resolution: EffectiveSttProviderConcurrency,
  batchConcurrency: number,
  coordinatedAcrossBatch: boolean,
  providerSlots: string,
  providerSlotDetails: readonly SttProviderSlotSummary[]
): void => {
  const mode = coordinatedAcrossBatch ? 'batch scheduler' : 'provider concurrency'
  l.write('info', `STT ${mode}: ${resolution.effective} effective slots across ${resolution.hostedProviderCount} hosted providers`, {
    category: 'pipeline',
    metadata: {
      mode: coordinatedAcrossBatch ? 'batch_scheduler' : 'cloud_provider_concurrency',
      requested: resolution.requested,
      effective: resolution.effective,
      batchConcurrency,
      hostedProviders: resolution.hostedProviderCount,
      providerSlots,
      providerSlotDetails
    }
  })
}

const summarizeProviderFailureReason = (failure: Pick<ProviderFailure, 'stage' | 'status'>): string => {
  if (typeof failure.status === 'number') return `status ${failure.status}`
  return failure.stage ?? 'failed'
}

export const logSttProviderFailures = (
  failures: readonly ProviderFailure[],
  level: LogLevel = 'warn'
): void => {
  if (failures.length === 0) return
  l.write(level, `${failures.length} STT providers failed`, {
    category: 'pipeline',
    metadata: { failures }
  })
  for (const failure of failures) {
    l.write(level, `${formatSttTargetLabel(failure)} ${summarizeProviderFailureReason(failure)}: ${failure.message}`, {
      category: 'pipeline',
      metadata: failure
    })
  }
}

export const logSttProviderSkips = (
  skippedProviders: ReadonlyArray<Pick<SttProviderState, 'service' | 'model' | 'error'>>,
  level: LogLevel = 'warn'
): void => {
  if (skippedProviders.length === 0) return
  l.write(level, `${skippedProviders.length} STT providers skipped`, {
    category: 'pipeline',
    metadata: { skippedProviders }
  })
  for (const state of skippedProviders) {
    l.write(level, `${formatSttTargetLabel(state)} skipped: ${state.error?.message ?? 'unavailable'}`, {
      category: 'pipeline',
      metadata: state
    })
  }
}
