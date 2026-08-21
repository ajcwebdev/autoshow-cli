import type {
  HostedConcurrencyTelemetry,
  HostedOcrSchedulerGatingTarget,
  HostedOcrSchedulerLaneState,
  HostedOcrSchedulerLaneTelemetry,
  HostedOcrSchedulerStatus,
  HostedOcrSchedulerTargetStats,
  HostedOcrSchedulerTargetTelemetry,
  HostedOcrSchedulerTelemetry,
  HostedOcrTelemetryRoot
} from '~/types'
import { roundMetric } from '~/utils/value-helpers'

const pagesPerMinute = (
  pages: number,
  startedAtMs: number | undefined,
  finishedAtMs: number | undefined
): number | null => {
  if (
    pages <= 0
    || startedAtMs === undefined
    || finishedAtMs === undefined
    || finishedAtMs <= startedAtMs
  ) {
    return null
  }
  return roundMetric(pages / ((finishedAtMs - startedAtMs) / 60_000))
}

const observedDurationMs = (
  startedAtMs: number | undefined,
  finishedAtMs: number | undefined
): number | undefined => {
  if (
    startedAtMs === undefined
    || finishedAtMs === undefined
    || finishedAtMs < startedAtMs
  ) {
    return undefined
  }
  return Math.max(0, Math.round(finishedAtMs - startedAtMs))
}

const projectedObservedDurationMs = (
  submittedPages: number,
  completedPages: number,
  durationMs: number | undefined
): number | undefined => {
  if (durationMs === undefined) return undefined
  if (submittedPages <= 0 || completedPages <= 0) return durationMs
  return Math.max(
    durationMs,
    Math.round((durationMs * submittedPages) / completedPages)
  )
}

const schedulerStatus = (
  submittedPages: number,
  completedPages: number,
  failedPages: number,
  active = 0
): HostedOcrSchedulerStatus => {
  if (failedPages > 0) return 'failed'
  if (submittedPages > 0 && completedPages >= submittedPages) {
    return 'succeeded'
  }
  if (active > 0 || submittedPages > 0) {
    return completedPages > 0 ? 'incomplete' : 'running'
  }
  return 'pending'
}

const projectHostedOcrTargetTelemetry = (
  target: HostedOcrSchedulerTargetStats,
  totalCompletedPages: number
): HostedOcrSchedulerTargetTelemetry => {
  const durationMs = observedDurationMs(
    target.startedAtMs,
    target.finishedAtMs
  )
  const projectedMs = projectedObservedDurationMs(
    target.submittedPages,
    target.completedPages,
    durationMs
  )
  return {
    targetKey: target.targetKey,
    service: target.service,
    model: target.model,
    status: schedulerStatus(
      target.submittedPages,
      target.completedPages,
      target.failedPages
    ),
    submittedPages: target.submittedPages,
    completedPages: target.completedPages,
    failedPages: target.failedPages,
    share: totalCompletedPages > 0
      ? roundMetric(target.completedPages / totalCompletedPages)
      : 0,
    pagesPerMinute: pagesPerMinute(
      target.completedPages,
      target.startedAtMs,
      target.finishedAtMs
    ),
    ...(typeof durationMs === 'number'
      ? { observedDurationMs: durationMs }
      : {}),
    ...(typeof projectedMs === 'number'
      ? { projectedObservedDurationMs: projectedMs }
      : {})
  }
}

const projectHostedOcrLaneTelemetry = (
  lane: HostedOcrSchedulerLaneState,
  hostedConcurrency?: HostedConcurrencyTelemetry | undefined
): HostedOcrSchedulerLaneTelemetry => {
  const targets = [...lane.targets.values()].map((target) =>
    projectHostedOcrTargetTelemetry(target, lane.completedPages)
  )
  const durationMs = observedDurationMs(
    lane.startedAtMs,
    lane.finishedAtMs
  )
  const projectedMs = projectedObservedDurationMs(
    lane.submittedPages,
    lane.completedPages,
    durationMs
  )
  const hostedLane = hostedConcurrency?.lanes.find(
    (entry) => entry.lane.laneKey === lane.laneKey
  )
  return {
    lane: lane.lane,
    laneKey: lane.laneKey,
    service: lane.service,
    scopeLabel: lane.scopeLabel,
    status: schedulerStatus(
      lane.submittedPages,
      lane.completedPages,
      lane.failedPages,
      lane.active
    ),
    mode: lane.mode,
    initialCap: lane.initialCap,
    currentCap: hostedLane?.currentLimit ?? lane.currentCap,
    maxCap: lane.maxCap,
    capSource: lane.capSource,
    sourceConfidence: lane.sourceConfidence,
    ...(typeof lane.profileSampleCount === 'number'
      ? { profileSampleCount: lane.profileSampleCount }
      : {}),
    ...(typeof lane.profileRaisedMaxCap === 'number'
      ? { profileRaisedMaxCap: lane.profileRaisedMaxCap }
      : {}),
    ...(typeof lane.profileDisqualificationReason === 'string'
      ? {
          profileDisqualificationReason:
            lane.profileDisqualificationReason
        }
      : {}),
    activePeak:
      hostedLane?.classes.find(
        (entry) => entry.workClass === 'ocr-page'
      )?.activePeak
      ?? lane.activePeak,
    retryPressureCount:
      hostedLane?.pressureEvents.length
      ?? lane.retryPressureCount,
    ...(lane.retryEvents.length > 0
      ? { retryEvents: lane.retryEvents.slice() }
      : {}),
    pauseTimeMs:
      hostedLane?.pauseDurationMs
      ?? Math.round(lane.pauseTimeMs),
    submittedPages: lane.submittedPages,
    completedPages: lane.completedPages,
    failedPages: lane.failedPages,
    pagesPerMinute: pagesPerMinute(
      lane.completedPages,
      lane.startedAtMs,
      lane.finishedAtMs
    ),
    ...(typeof durationMs === 'number'
      ? { observedDurationMs: durationMs }
      : {}),
    ...(typeof projectedMs === 'number'
      ? { projectedObservedDurationMs: projectedMs }
      : {}),
    targets
  }
}

const likelyGatingTarget = (
  lanes: HostedOcrSchedulerLaneTelemetry[]
): HostedOcrSchedulerGatingTarget | undefined => {
  const gating = lanes
    .flatMap((lane) =>
      lane.targets.map((target) => ({ lane, target }))
    )
    .filter(({ target }) =>
      target.submittedPages > 0
      && (
        typeof target.projectedObservedDurationMs === 'number'
        || typeof target.observedDurationMs === 'number'
        || typeof target.pagesPerMinute === 'number'
      )
    )
    .sort((left, right) => {
      const leftProjected =
        left.target.projectedObservedDurationMs
        ?? left.target.observedDurationMs
        ?? 0
      const rightProjected =
        right.target.projectedObservedDurationMs
        ?? right.target.observedDurationMs
        ?? 0
      if (rightProjected !== leftProjected) {
        return rightProjected - leftProjected
      }
      const leftThroughput =
        left.target.pagesPerMinute
        ?? Number.POSITIVE_INFINITY
      const rightThroughput =
        right.target.pagesPerMinute
        ?? Number.POSITIVE_INFINITY
      return leftThroughput - rightThroughput
    })[0]
  if (!gating) return undefined
  return {
    laneKey: gating.lane.laneKey,
    targetKey: gating.target.targetKey,
    service: gating.target.service,
    model: gating.target.model,
    status: gating.target.status,
    submittedPages: gating.target.submittedPages,
    completedPages: gating.target.completedPages,
    failedPages: gating.target.failedPages,
    share: gating.target.share,
    pagesPerMinute: gating.target.pagesPerMinute,
    ...(typeof gating.target.observedDurationMs === 'number'
      ? { observedDurationMs: gating.target.observedDurationMs }
      : {}),
    ...(typeof gating.target.projectedObservedDurationMs === 'number'
      ? {
          projectedObservedDurationMs:
            gating.target.projectedObservedDurationMs
        }
      : {})
  }
}

const projectRoot = (
  root: HostedOcrTelemetryRoot,
  lanes: HostedOcrSchedulerLaneTelemetry[],
  documentPages = root.documentPages,
  documentCount = root.documentCount
): HostedOcrSchedulerTelemetry => {
  const gatingTarget = likelyGatingTarget(lanes)
  return {
    version: 1,
    lifetime: root.lifetime,
    mode: root.mode,
    ...(root.fixedCap !== undefined ? { fixedCap: root.fixedCap } : {}),
    documentPages,
    documentCount,
    lanes,
    ...(root.sharedHostedPolicy && root.hostedConcurrency
      ? { hostedConcurrency: root.hostedConcurrency }
      : {}),
    ...(gatingTarget ? { likelyGatingTarget: gatingTarget } : {})
  }
}

export const projectHostedOcrRunTelemetry = (
  root: HostedOcrTelemetryRoot,
  lanes: Iterable<HostedOcrSchedulerLaneState>
): HostedOcrSchedulerTelemetry =>
  projectRoot(
    root,
    [...lanes].map((lane) =>
      projectHostedOcrLaneTelemetry(lane, root.hostedConcurrency)
    )
  )

export const projectHostedOcrDocumentTelemetry = (
  root: HostedOcrTelemetryRoot,
  lanes: Iterable<HostedOcrSchedulerLaneState>,
  documentKey: string,
  documentPages: number
): HostedOcrSchedulerTelemetry => {
  const projectedLanes = [...lanes].flatMap((lane) => {
    const documentTargets = lane.documentTargets.get(documentKey)
    if (!documentTargets || documentTargets.size === 0) return []
    const values = [...documentTargets.values()]
    const totalCompletedPages = values.reduce(
      (sum, target) => sum + target.completedPages,
      0
    )
    const targets = values.map((target) =>
      projectHostedOcrTargetTelemetry(target, totalCompletedPages)
    )
    const submittedPages = targets.reduce(
      (sum, target) => sum + target.submittedPages,
      0
    )
    const completedPages = targets.reduce(
      (sum, target) => sum + target.completedPages,
      0
    )
    const failedPages = targets.reduce(
      (sum, target) => sum + target.failedPages,
      0
    )
    const starts = values.flatMap((target) =>
      target.startedAtMs === undefined ? [] : [target.startedAtMs]
    )
    const finishes = values.flatMap((target) =>
      target.finishedAtMs === undefined ? [] : [target.finishedAtMs]
    )
    const startedAtMs =
      starts.length > 0 ? Math.min(...starts) : undefined
    const finishedAtMs =
      finishes.length > 0 ? Math.max(...finishes) : undefined
    const durationMs = observedDurationMs(startedAtMs, finishedAtMs)
    const projectedMs = projectedObservedDurationMs(
      submittedPages,
      completedPages,
      durationMs
    )
    return [{
      ...projectHostedOcrLaneTelemetry(
        lane,
        root.hostedConcurrency
      ),
      status: schedulerStatus(
        submittedPages,
        completedPages,
        failedPages
      ),
      submittedPages,
      completedPages,
      failedPages,
      pagesPerMinute: pagesPerMinute(
        completedPages,
        startedAtMs,
        finishedAtMs
      ),
      observedDurationMs: durationMs,
      projectedObservedDurationMs: projectedMs,
      targets
    }]
  })
  return projectRoot(root, projectedLanes, documentPages, 1)
}
