import * as l from '~/utils/app-logger/app-logger'
import type { EffectiveSttProviderConcurrency, SttExtractionOptions, SttTarget } from '~/types'
import { getSttEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { buildSpeakerCountHintWarning } from '../command-shared/extract-routing/inactive-flag-warnings'
import { buildSttProviderSlotSummaries, describeSttBatchProviderSlotLimits } from './batch'
import { getSttEngineCapabilities } from './orchestrator'
import { formatSttTargetLabel } from './stt-targets'
import {
  logSttProviderConcurrency,
  logSttProviderSpeakerCountHints
} from './stt-logging'

const emittedInfoMessages = new Set<string>()
const emittedWarnMessages = new Set<string>()

const emitInfoOnce = (key: string, emit: () => void): void => {
  if (emittedInfoMessages.has(key)) {
    return
  }

  emittedInfoMessages.add(key)
  emit()
}

const emitWarnOnce = (key: string, emit: () => void): void => {
  if (emittedWarnMessages.has(key)) {
    return
  }

  emittedWarnMessages.add(key)
  emit()
}

export const resolveEffectiveSttProviderConcurrency = (
  options: Pick<SttExtractionOptions, 'batchConcurrency' | 'sttProviderConcurrency'>,
  targets: Pick<SttTarget, 'local'>[]
): EffectiveSttProviderConcurrency => {
  const requested = Math.max(1, options.sttProviderConcurrency)
  const hostedProviderCount = targets.filter((target) => !target.local).length

  return {
    requested,
    effective: requested,
    hostedProviderCount
  }
}

export const logSpeakerCountHintSummary = (
  targets: SttTarget[],
  requestedSpeakerCount: number | undefined,
  requestedDiarization?: boolean
): void => {
  if (requestedDiarization !== undefined) {
    const ignored = targets.filter(target => !getSttEngineCapabilities(target.service, target.model).supportsDiarizationToggle)
    if (ignored.length) {
      const message = 'Diarization toggle is unsupported and ignored for: ' + ignored.map(formatSttTargetLabel).join(', ') + '. Use --no-caption-speakers during local export to hide labels.'
      emitWarnOnce(message, () => l.warn(message, { category: 'pipeline' }))
    }
  }
  for (const target of targets) {
    const capabilities = getSttEngineCapabilities(target.service, target.model)
    if (target.diarizationOptions?.enabled !== true) continue
    const message = capabilities.diarizationValidation === 'provisional'
      ? `${formatSttTargetLabel(target)} diarization uses the common provider API contract and has not been validated for this model.`
      : capabilities.nativeWordTiming === 'without-diarization'
        ? `${formatSttTargetLabel(target)} returns segment timing with diarization enabled. Use --no-diarization for native word timing; caption word mode estimates boundaries from segments.`
        : undefined
    if (message) emitWarnOnce(message, () => l.warn(message, { category: 'pipeline' }))
  }
  const warning = buildSpeakerCountHintWarning(
    targets,
    requestedSpeakerCount,
    (target) => getSttEngineCapabilities(target.service, target.model).supportsSpeakerCountHint && target.diarizationOptions?.enabled !== false,
    formatSttTargetLabel
  )
  if (warning) {
    emitWarnOnce(warning, () => {
      logSttProviderSpeakerCountHints(
        targets.map((target) => ({
          provider: formatSttTargetLabel(target),
          speakerCount: requestedSpeakerCount as number,
          support: getSttEngineCapabilities(target.service, target.model).supportsSpeakerCountHint && target.diarizationOptions?.enabled !== false ? 'honored' : 'ignored'
        }))
      )
    })
  }
}

export const logEffectiveProviderConcurrency = (
  resolution: EffectiveSttProviderConcurrency,
  batchConcurrency: number,
  coordinatedAcrossBatch: boolean,
  targets: SttTarget[]
): void => {
  if (resolution.hostedProviderCount <= 1) {
    return
  }

  const providerSlots = describeSttBatchProviderSlotLimits(targets, batchConcurrency)
  const providerSlotDetails = buildSttProviderSlotSummaries(targets, batchConcurrency)
  const dedupeKey = [
    coordinatedAcrossBatch ? 'batch_scheduler' : 'cloud_provider_concurrency',
    resolution.requested,
    resolution.effective,
    batchConcurrency,
    resolution.hostedProviderCount,
    providerSlots
  ].join(':')

  emitInfoOnce(dedupeKey, () => {
    logSttProviderConcurrency(
      resolution,
      batchConcurrency,
      coordinatedAcrossBatch,
      providerSlots,
      providerSlotDetails
    )
  })
}

export const prioritizeCloudSttTargetIndices = (targets: SttTarget[]): number[] =>
  targets
    .map((target, index) => ({ target, index }))
    .filter((entry) => !entry.target.local)
    .sort((left, right) => {
      const leftAssemblyPriority = left.target.service === 'assemblyai' ? 1 : 0
      const rightAssemblyPriority = right.target.service === 'assemblyai' ? 1 : 0
      if (leftAssemblyPriority !== rightAssemblyPriority) {
        return rightAssemblyPriority - leftAssemblyPriority
      }

      const leftEstimate = getSttEstimation(left.target.service, left.target.model).msPerSecond
      const rightEstimate = getSttEstimation(right.target.service, right.target.model).msPerSecond
      if (leftEstimate !== rightEstimate) {
        return rightEstimate - leftEstimate
      }

      return left.index - right.index
    })
    .map((entry) => entry.index)
