import { isRecord } from '~/utils/rest-client'
import type { HostedOcrSchedulerLaneTelemetry, HostedOcrSchedulerSection, HostedOcrSchedulerTargetTelemetry, WriteManifestMetadata } from '~/types'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { formatDuration } from '~/utils/app-logger/formatters'
import { buildProviderModelLabel } from './manifest-log-formatting'

export const HOSTED_OCR_SCHEDULER_COLUMNS = ['lane', 'status', 'cap', 'capSource', 'peak', 'retryPressure', 'pause', 'pagesPerMinute', 'targetShare'] as const


const parseTarget = (value: unknown): HostedOcrSchedulerTargetTelemetry | undefined => {
  if (!isRecord(value) || typeof value['targetKey'] !== 'string' || typeof value['service'] !== 'string' || typeof value['model'] !== 'string') {
    return undefined
  }
  return {
    targetKey: value['targetKey'],
    service: value['service'] as HostedOcrSchedulerTargetTelemetry['service'],
    model: value['model'],
    status: typeof value['status'] === 'string' ? value['status'] as HostedOcrSchedulerTargetTelemetry['status'] : 'succeeded',
    submittedPages: typeof value['submittedPages'] === 'number' ? value['submittedPages'] : 0,
    completedPages: typeof value['completedPages'] === 'number' ? value['completedPages'] : 0,
    failedPages: typeof value['failedPages'] === 'number' ? value['failedPages'] : 0,
    share: typeof value['share'] === 'number' ? value['share'] : 0,
    pagesPerMinute: typeof value['pagesPerMinute'] === 'number' ? value['pagesPerMinute'] : null,
    ...(typeof value['observedDurationMs'] === 'number' ? { observedDurationMs: value['observedDurationMs'] } : {}),
    ...(typeof value['projectedObservedDurationMs'] === 'number' ? { projectedObservedDurationMs: value['projectedObservedDurationMs'] } : {})
  }
}

const parseLane = (value: unknown): HostedOcrSchedulerLaneTelemetry | undefined => {
  if (!isRecord(value) || typeof value['laneKey'] !== 'string' || typeof value['service'] !== 'string') {
    return undefined
  }
  const targets = Array.isArray(value['targets'])
    ? value['targets'].map(parseTarget).filter((target): target is HostedOcrSchedulerTargetTelemetry => target !== undefined)
    : []
  return {
    laneKey: value['laneKey'],
    service: value['service'] as HostedOcrSchedulerLaneTelemetry['service'],
    scopeLabel: typeof value['scopeLabel'] === 'string' ? value['scopeLabel'] : 'env-api-key',
    status: typeof value['status'] === 'string' ? value['status'] as HostedOcrSchedulerLaneTelemetry['status'] : 'succeeded',
    mode: value['mode'] === 'fixed' ? 'fixed' : 'auto',
    initialCap: typeof value['initialCap'] === 'number' ? value['initialCap'] : 0,
    currentCap: typeof value['currentCap'] === 'number' ? value['currentCap'] : 0,
    maxCap: typeof value['maxCap'] === 'number' ? value['maxCap'] : 0,
    ...(value['capSource'] === 'fixed' || value['capSource'] === 'unprofiled' || value['capSource'] === 'profile'
      ? { capSource: value['capSource'] }
      : {}),
    ...(value['sourceConfidence'] === 'none' || value['sourceConfidence'] === 'sparse' || value['sourceConfidence'] === 'healthy'
      ? { sourceConfidence: value['sourceConfidence'] }
      : {}),
    ...(typeof value['profileSampleCount'] === 'number' ? { profileSampleCount: value['profileSampleCount'] } : {}),
    ...(typeof value['profileRaisedMaxCap'] === 'number' ? { profileRaisedMaxCap: value['profileRaisedMaxCap'] } : {}),
    ...(typeof value['profileDisqualificationReason'] === 'string' ? { profileDisqualificationReason: value['profileDisqualificationReason'] } : {}),
    activePeak: typeof value['activePeak'] === 'number' ? value['activePeak'] : 0,
    retryPressureCount: typeof value['retryPressureCount'] === 'number' ? value['retryPressureCount'] : 0,
    pauseTimeMs: typeof value['pauseTimeMs'] === 'number' ? value['pauseTimeMs'] : 0,
    submittedPages: typeof value['submittedPages'] === 'number' ? value['submittedPages'] : 0,
    completedPages: typeof value['completedPages'] === 'number' ? value['completedPages'] : 0,
    failedPages: typeof value['failedPages'] === 'number' ? value['failedPages'] : 0,
    pagesPerMinute: typeof value['pagesPerMinute'] === 'number' ? value['pagesPerMinute'] : null,
    ...(typeof value['observedDurationMs'] === 'number' ? { observedDurationMs: value['observedDurationMs'] } : {}),
    ...(typeof value['projectedObservedDurationMs'] === 'number' ? { projectedObservedDurationMs: value['projectedObservedDurationMs'] } : {}),
    targets
  }
}

const getSchedulerLanes = (metadata: WriteManifestMetadata): HostedOcrSchedulerLaneTelemetry[] => {
  const scheduler = metadata['hostedOcrScheduler']
  if (!isRecord(scheduler) || !Array.isArray(scheduler['lanes'])) {
    return []
  }
  return scheduler['lanes'].map(parseLane).filter((lane): lane is HostedOcrSchedulerLaneTelemetry => lane !== undefined)
}

const formatPagesPerMinute = (value: number | null): string =>
  value === null ? '' : `${value.toFixed(value >= 10 ? 1 : 2)} ppm`

const formatCapSource = (lane: HostedOcrSchedulerLaneTelemetry): string => {
  const source = lane.capSource ?? (lane.mode === 'fixed' ? 'fixed' : 'unprofiled')
  const confidence = lane.sourceConfidence && lane.sourceConfidence !== 'none'
    ? `/${lane.sourceConfidence}`
    : ''
  const sampleCount = typeof lane.profileSampleCount === 'number' && lane.profileSampleCount > 0
    ? ` x${lane.profileSampleCount}`
    : ''
  const raisedCap = typeof lane.profileRaisedMaxCap === 'number'
    ? ` ->${lane.profileRaisedMaxCap}`
    : ''
  const reason = typeof lane.profileDisqualificationReason === 'string'
    ? ` (${lane.profileDisqualificationReason})`
    : ''
  return `${source}${confidence}${sampleCount}${raisedCap}${reason}`
}

const formatTargetShare = (targets: HostedOcrSchedulerTargetTelemetry[]): string =>
  targets
    .filter((target) => target.completedPages > 0 || target.submittedPages > 0)
    .map((target) => {
      const pageStatus = target.status === 'succeeded'
        ? `${target.completedPages}/${target.submittedPages}`
        : `${target.status} ${target.completedPages}/${target.submittedPages}`
      return `${buildProviderModelLabel(target.service, target.model)} ${pageStatus} ${(target.share * 100).toFixed(0)}%`
    })
    .join(', ')

export const buildHostedOcrSchedulerSummary = (
  metadata: WriteManifestMetadata
): HostedOcrSchedulerSection | undefined => {
  const rows = getSchedulerLanes(metadata).map((lane) => ({
    lane: lane.laneKey,
    status: lane.status,
    cap: `${lane.currentCap}/${lane.maxCap}`,
    capSource: formatCapSource(lane),
    peak: lane.activePeak,
    retryPressure: lane.retryPressureCount,
    pause: lane.pauseTimeMs > 0 ? formatDuration(lane.pauseTimeMs) : '',
    pagesPerMinute: formatPagesPerMinute(lane.pagesPerMinute),
    targetShare: formatTargetShare(lane.targets)
  }))

  if (rows.length === 0) {
    return undefined
  }

  return {
    columns: HOSTED_OCR_SCHEDULER_COLUMNS,
    rows,
    humanTable: createHumanTable(rows, HOSTED_OCR_SCHEDULER_COLUMNS)
  }
}
