import type {
  HostedOcrScheduler,
  HostedOcrSchedulerAdmission,
  HostedOcrSchedulerCapSource,
  HostedOcrSchedulerLaneState,
  HostedOcrSchedulerLaneTelemetry,
  HostedOcrSchedulerOptions,
  HostedOcrSchedulerProfileConfidence,
  HostedOcrSchedulerRetryPressure,
  HostedOcrSchedulerRetryPressureHandler,
  HostedOcrSchedulerRunControls,
  HostedOcrSchedulerStatus,
  HostedOcrSchedulerTargetStats,
  HostedOcrSchedulerTelemetry,
  HostedOcrSchedulerTargetTelemetry,
  HostedOcrService,
  HostedConcurrencyAdmissionToken,
  HostedConcurrencyCoordinator,
  OcrConcurrencyMode,
  QueuedHostedOcrJob
} from '~/types'
import { createProviderLaneIdentity } from '~/cli/commands/process-steps/provider-lane-contract'
import { createHostedConcurrencyCoordinator, recoverHostedConcurrencyRequest } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import {
  findHostedOcrThroughputProfile,
  resolveHostedOcrPageCountBand
} from './hosted-ocr-throughput-profiles'

export const HOSTED_OCR_AUTO_INITIAL_CAP = 10
export const HOSTED_OCR_AUTO_MAX_CAP_CEILING = 32
export const HOSTED_OCR_LARGE_DOCUMENT_THRESHOLD = 200
export const HOSTED_OCR_PROFILE_MAX_CAP_CEILING = 48
export const HOSTED_OCR_DEFAULT_SCOPE_LABEL = 'env-api-key'
const HOSTED_OCR_RETRY_EVENT_LIMIT = 50
const KIMI_PROFILE_HIGH_CAP_THRESHOLD = 13
const KIMI_PROFILE_HIGH_CAP_MIN_CLEAN_SAMPLES = 3

const clamp = (min: number, max: number, value: number): number =>
  Math.min(max, Math.max(min, value))

const normalizePositiveInteger = (
  value: number | undefined,
  fallback: number
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.max(1, Math.floor(value))
}

const roundMetric = (value: number): number => {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

const profileConfidenceRank = (confidence: HostedOcrSchedulerProfileConfidence): number => {
  if (confidence === 'healthy') return 2
  if (confidence === 'sparse') return 1
  return 0
}

export const resolveHostedOcrAutoMaxCap = (pageCount: number): number => {
  const pages = normalizePositiveInteger(pageCount, 1)
  return clamp(
    HOSTED_OCR_AUTO_INITIAL_CAP,
    HOSTED_OCR_AUTO_MAX_CAP_CEILING,
    Math.ceil(Math.sqrt(pages))
  )
}

export const resolveHostedOcrEstimateCap = (
  pageCount: number,
  mode: OcrConcurrencyMode,
  fixedCap?: number | undefined
): number => {
  if (mode === 'fixed') {
    return normalizePositiveInteger(fixedCap, HOSTED_OCR_AUTO_INITIAL_CAP)
  }
  const maxCap = resolveHostedOcrAutoMaxCap(pageCount)
  if (normalizePositiveInteger(pageCount, 1) >= HOSTED_OCR_LARGE_DOCUMENT_THRESHOLD) {
    return maxCap
  }
  return Math.max(
    HOSTED_OCR_AUTO_INITIAL_CAP,
    Math.round((HOSTED_OCR_AUTO_INITIAL_CAP + maxCap) / 2)
  )
}

export const resolveHostedOcrLaneKey = (
  service: HostedOcrService,
  scopeLabel = HOSTED_OCR_DEFAULT_SCOPE_LABEL
): string => createProviderLaneIdentity(service, scopeLabel, HOSTED_OCR_DEFAULT_SCOPE_LABEL).laneKey

const resolveTargetKey = (admission: HostedOcrSchedulerAdmission): string =>
  admission.targetKey ?? `${admission.service}:${admission.model}`

const resolveQueueKey = (admission: HostedOcrSchedulerAdmission, targetKey: string): string =>
  admission.documentKey
    ? `${admission.documentKey}:${targetKey}`
    : targetKey

const normalizeAdmissionPageCount = (admission: HostedOcrSchedulerAdmission): number =>
  normalizePositiveInteger(admission.pageCount, 1)

const getErrorStatus = (error: unknown): number | undefined => {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if ('status' in current && typeof (current as { status?: unknown }).status === 'number') {
      return (current as { status: number }).status
    }
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return undefined
}

const isTimeoutLike = (error: unknown): boolean => {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if (current instanceof DOMException && current.name === 'TimeoutError') {
      return true
    }
    if (current instanceof Error) {
      if (current.name === 'TimeoutError' || /timeout|timed out/i.test(current.message)) {
        return true
      }
    }
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return false
}

const shouldBackoffForError = (error: unknown): boolean => {
  const status = getErrorStatus(error)
  return status === 429
}

const isRateLimitPressure = (pressure: HostedOcrSchedulerRetryPressure): boolean => {
  if (pressure.status === 429) return true
  const reason = pressure.reason.toLowerCase()
  return /rate[-\s]?limit|too many requests|provider concurrency/.test(reason)
    && !/billing|insufficient (?:balance|credit)|quota exhaust|authentication|unauthorized/.test(reason)
}

const getCleanSampleCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0

const pagesPerMinute = (
  pages: number,
  startedAtMs: number | undefined,
  finishedAtMs: number | undefined
): number | null => {
  if (pages <= 0 || startedAtMs === undefined || finishedAtMs === undefined || finishedAtMs <= startedAtMs) {
    return null
  }
  return roundMetric(pages / ((finishedAtMs - startedAtMs) / 60_000))
}

const observedDurationMs = (
  startedAtMs: number | undefined,
  finishedAtMs: number | undefined
): number | undefined => {
  if (startedAtMs === undefined || finishedAtMs === undefined || finishedAtMs < startedAtMs) {
    return undefined
  }
  return Math.max(0, Math.round(finishedAtMs - startedAtMs))
}

const projectedObservedDurationMs = (
  submittedPages: number,
  completedPages: number,
  durationMs: number | undefined
): number | undefined => {
  if (durationMs === undefined) {
    return undefined
  }
  if (submittedPages <= 0 || completedPages <= 0) {
    return durationMs
  }
  return Math.max(durationMs, Math.round((durationMs * submittedPages) / completedPages))
}

const resolveSchedulerStatus = (
  submittedPages: number,
  completedPages: number,
  failedPages: number,
  active = 0
): HostedOcrSchedulerStatus => {
  if (failedPages > 0) {
    return 'failed'
  }
  if (submittedPages > 0 && completedPages >= submittedPages) {
    return 'succeeded'
  }
  if (active > 0 || submittedPages > 0) {
    return completedPages > 0 ? 'incomplete' : 'running'
  }
  return 'pending'
}

class HostedOcrSchedulerImpl implements HostedOcrScheduler {
  private readonly mode: OcrConcurrencyMode
  private readonly lifetime: 'document' | 'run'
  private documentPages: number
  private documentCount: number
  private nextDocumentId = 1
  private readonly fixedCap: number | undefined
  private readonly profilePath: string | undefined
  private readonly lanes = new Map<string, HostedOcrSchedulerLaneState>()
  private readonly hostedConcurrencyCoordinator: HostedConcurrencyCoordinator
  private readonly sharedHostedPolicy: boolean

  constructor(options: HostedOcrSchedulerOptions) {
    this.mode = options.mode
    this.lifetime = options.lifetime ?? 'document'
    this.documentPages = options.pageCount > 0 ? normalizePositiveInteger(options.pageCount, 1) : 0
    this.documentCount = this.documentPages > 0 ? 1 : 0
    this.fixedCap = options.mode === 'fixed'
      ? normalizePositiveInteger(options.fixedCap, HOSTED_OCR_AUTO_INITIAL_CAP)
      : undefined
    this.profilePath = options.profilePath
    this.sharedHostedPolicy = options.concurrencyMode !== undefined || options.hostedConcurrencyCoordinator !== undefined
    this.hostedConcurrencyCoordinator = options.hostedConcurrencyCoordinator
      ?? createHostedConcurrencyCoordinator({ mode: options.concurrencyMode ?? 'immediate' })
  }

  run = async <T>(
    admission: HostedOcrSchedulerAdmission,
    task: (controls: HostedOcrSchedulerRunControls) => Promise<T>
  ): Promise<T> => {
    const targetKey = resolveTargetKey(admission)
    const queueKey = resolveQueueKey(admission, targetKey)
    const lane = this.getLane(admission, targetKey)
    const pageCount = normalizeAdmissionPageCount(admission)
    const target = this.getTarget(lane, admission, targetKey)
    const documentTarget = this.getDocumentTarget(lane, admission, targetKey)
    target.submittedPages += pageCount
    if (documentTarget) documentTarget.submittedPages += pageCount
    lane.submittedPages += pageCount

    return await new Promise<T>((resolve, reject) => {
      const queue = lane.queues.get(queueKey) ?? []
      queue.push({
        admission: {
          ...admission,
          service: admission.service,
          model: admission.model
        },
        targetKey,
        ...(admission.documentKey ? { documentKey: admission.documentKey } : {}),
        pageCount,
        task,
        resolve: resolve as (value: unknown) => void,
        reject
      })
      lane.queues.set(queueKey, queue)
      if (!lane.targetOrder.includes(queueKey)) {
        lane.targetOrder.push(queueKey)
      }
      this.pumpLane(lane)
    })
  }

  snapshot = (): HostedOcrSchedulerTelemetry => {
    const lanes = [...this.lanes.values()].map((lane) => this.snapshotLane(lane))
    const likelyGatingTarget = lanes
      .flatMap((lane) => lane.targets.map((target) => ({ lane, target })))
      .filter((entry) =>
        entry.target.submittedPages > 0
        && (
          typeof entry.target.projectedObservedDurationMs === 'number'
          || typeof entry.target.observedDurationMs === 'number'
          || typeof entry.target.pagesPerMinute === 'number'
        )
      )
      .sort((left, right) => {
        const leftProjected = left.target.projectedObservedDurationMs ?? left.target.observedDurationMs ?? 0
        const rightProjected = right.target.projectedObservedDurationMs ?? right.target.observedDurationMs ?? 0
        if (rightProjected !== leftProjected) {
          return rightProjected - leftProjected
        }
        const leftThroughput = left.target.pagesPerMinute ?? Number.POSITIVE_INFINITY
        const rightThroughput = right.target.pagesPerMinute ?? Number.POSITIVE_INFINITY
        return leftThroughput - rightThroughput
      })[0]

    return {
      version: 1,
      lifetime: this.lifetime,
      mode: this.mode,
      ...(this.fixedCap !== undefined ? { fixedCap: this.fixedCap } : {}),
      documentPages: this.documentPages,
      documentCount: this.documentCount,
      lanes,
      ...(this.sharedHostedPolicy ? { hostedConcurrency: this.hostedConcurrencyCoordinator.snapshot() } : {}),
      ...(likelyGatingTarget
        ? {
            likelyGatingTarget: {
              laneKey: likelyGatingTarget.lane.laneKey,
              targetKey: likelyGatingTarget.target.targetKey,
              service: likelyGatingTarget.target.service,
              model: likelyGatingTarget.target.model,
              status: likelyGatingTarget.target.status,
              submittedPages: likelyGatingTarget.target.submittedPages,
              completedPages: likelyGatingTarget.target.completedPages,
              failedPages: likelyGatingTarget.target.failedPages,
              share: likelyGatingTarget.target.share,
              pagesPerMinute: likelyGatingTarget.target.pagesPerMinute,
              ...(typeof likelyGatingTarget.target.observedDurationMs === 'number'
                ? { observedDurationMs: likelyGatingTarget.target.observedDurationMs }
                : {}),
              ...(typeof likelyGatingTarget.target.projectedObservedDurationMs === 'number'
                ? { projectedObservedDurationMs: likelyGatingTarget.target.projectedObservedDurationMs }
                : {})
            }
          }
        : {})
    }
  }

  getMaxConcurrency = (admission: HostedOcrSchedulerAdmission): number => {
    const laneIdentity = this.resolveLaneIdentity(admission)
    if (this.mode === 'fixed') {
      return this.fixedCap ?? HOSTED_OCR_AUTO_INITIAL_CAP
    }
    const scopeLabel = laneIdentity.scopeLabel
    const laneKey = laneIdentity.laneKey
    const existingLane = this.lanes.get(laneKey)
    if (existingLane) {
      if (existingLane.service === 'kimi' && existingLane.retryPressureCount > 0) {
        return existingLane.maxCap
      }
      const targetKey = resolveTargetKey(admission)
      const laneTargetCount = this.resolveProspectiveLaneTargetCount(existingLane, targetKey)
      return Math.max(existingLane.maxCap, this.resolveLaneCaps(admission, scopeLabel, laneTargetCount).maxCap)
    }
    return this.resolveLaneCaps(admission, scopeLabel, 1).maxCap
  }

  recordRetryPressure = (
    admission: HostedOcrSchedulerAdmission,
    pressure: HostedOcrSchedulerRetryPressure
  ): void => {
    const targetKey = resolveTargetKey(admission)
    this.recordLaneRetryPressure(this.getLane(admission, targetKey), pressure, { admission, targetKey })
  }

  createDocumentScope = (pageCount: number): HostedOcrScheduler => {
    const documentKey = `document-${this.nextDocumentId}`
    this.nextDocumentId += 1
    const documentPageCount = normalizePositiveInteger(pageCount, 1)
    this.documentPages += documentPageCount
    this.documentCount += 1
    const bindAdmission = (admission: HostedOcrSchedulerAdmission): HostedOcrSchedulerAdmission => ({
      ...admission,
      documentKey,
      documentPageCount
    })
    return {
      run: async (admission, task) => await this.run(bindAdmission(admission), task),
      snapshot: () => this.snapshotDocument(documentKey, documentPageCount),
      getMaxConcurrency: (admission) => this.getMaxConcurrency(bindAdmission(admission)),
      recordRetryPressure: (admission, pressure) => this.recordRetryPressure(bindAdmission(admission), pressure),
      createDocumentScope: this.createDocumentScope,
      getLifetime: this.getLifetime
    }
  }

  getLifetime = (): 'document' | 'run' => this.lifetime

  private resolveLaneIdentity(admission: HostedOcrSchedulerAdmission) {
    if (admission.lane) {
      if (admission.lane.service !== admission.service) {
        throw new Error(`Hosted OCR lane service ${admission.lane.service} does not match admission service ${admission.service}.`)
      }
      const identity = createProviderLaneIdentity(
        admission.service,
        admission.lane.scopeLabel,
        HOSTED_OCR_DEFAULT_SCOPE_LABEL
      )
      if (admission.lane.laneKey !== identity.laneKey) {
        throw new Error('Hosted OCR lane key does not match its service and scope label.')
      }
      return identity
    }
    const identity = createProviderLaneIdentity(
      admission.service,
      admission.scopeLabel,
      HOSTED_OCR_DEFAULT_SCOPE_LABEL
    )
    if (admission.laneKey && admission.laneKey !== identity.laneKey) {
      throw new Error('Hosted OCR lane key does not match its service and scope label.')
    }
    return identity
  }

  private getLane(admission: HostedOcrSchedulerAdmission, targetKey: string): HostedOcrSchedulerLaneState {
    const laneIdentity = this.resolveLaneIdentity(admission)
    const scopeLabel = laneIdentity.scopeLabel
    const laneKey = laneIdentity.laneKey
    const existing = this.lanes.get(laneKey)
    if (existing) {
      this.refreshLaneProfileCap(existing, admission, targetKey)
      return existing
    }

    const capResolution = this.resolveLaneCaps(admission, scopeLabel, 1)
    const maxCap = capResolution.maxCap
    const resolvedInitialCap = this.mode === 'fixed'
      ? maxCap
      : this.documentPages >= HOSTED_OCR_LARGE_DOCUMENT_THRESHOLD
        ? resolveHostedOcrEstimateCap(this.documentPages, 'auto')
        : HOSTED_OCR_AUTO_INITIAL_CAP
    const initialCap = this.sharedHostedPolicy && this.hostedConcurrencyCoordinator.mode === 'ramp'
      ? 1
      : resolvedInitialCap
    const lane: HostedOcrSchedulerLaneState = {
      lane: laneIdentity,
      laneKey,
      service: admission.service,
      scopeLabel,
      mode: this.mode,
      initialCap,
      currentCap: this.sharedHostedPolicy ? Math.max(resolvedInitialCap, maxCap) : initialCap,
      maxCap: Math.max(resolvedInitialCap, maxCap),
      capSource: capResolution.capSource,
      sourceConfidence: capResolution.sourceConfidence,
      ...(typeof capResolution.profileSampleCount === 'number' ? { profileSampleCount: capResolution.profileSampleCount } : {}),
      ...(typeof capResolution.profileRaisedMaxCap === 'number' ? { profileRaisedMaxCap: capResolution.profileRaisedMaxCap } : {}),
      ...(typeof capResolution.profileDisqualificationReason === 'string' ? { profileDisqualificationReason: capResolution.profileDisqualificationReason } : {}),
      active: 0,
      activePeak: 0,
      cleanSuccessPages: 0,
      cleanFastRampEnabled: true,
      retryPressureCount: 0,
      retryEvents: [],
      pauseUntilMs: 0,
      pauseTimeMs: 0,
      submittedPages: 0,
      completedPages: 0,
      failedPages: 0,
      targetOrder: [],
      roundRobinCursor: 0,
      queues: new Map(),
      targets: new Map(),
      documentTargets: new Map()
    }
    this.lanes.set(laneKey, lane)
    return lane
  }

  private resolveProspectiveLaneTargetCount(lane: HostedOcrSchedulerLaneState, targetKey: string): number {
    return Math.max(1, lane.targets.size + (lane.targets.has(targetKey) ? 0 : 1))
  }

  private refreshLaneProfileCap(lane: HostedOcrSchedulerLaneState, admission: HostedOcrSchedulerAdmission, targetKey: string): void {
    if (this.mode === 'fixed') {
      return
    }
    const capResolution = this.resolveLaneCaps(
      admission,
      lane.scopeLabel,
      this.resolveProspectiveLaneTargetCount(lane, targetKey)
    )
    if (lane.service === 'kimi' && lane.retryPressureCount > 0) {
      return
    }
    if (capResolution.maxCap <= lane.maxCap) {
      if (
        lane.capSource !== 'profile'
        && profileConfidenceRank(capResolution.sourceConfidence) >= profileConfidenceRank(lane.sourceConfidence)
      ) {
        lane.sourceConfidence = capResolution.sourceConfidence
        lane.profileSampleCount = capResolution.profileSampleCount
        lane.profileDisqualificationReason = capResolution.profileDisqualificationReason
      }
      return
    }
    lane.maxCap = capResolution.maxCap
    lane.capSource = capResolution.capSource
    lane.sourceConfidence = capResolution.sourceConfidence
    lane.profileSampleCount = capResolution.profileSampleCount
    lane.profileRaisedMaxCap = capResolution.profileRaisedMaxCap
    lane.profileDisqualificationReason = capResolution.profileDisqualificationReason
  }

  private resolveLaneCaps(
    admission: HostedOcrSchedulerAdmission,
    scopeLabel: string,
    laneTargetCount: number
  ): {
    maxCap: number
    capSource: HostedOcrSchedulerCapSource
    sourceConfidence: HostedOcrSchedulerProfileConfidence
    profileSampleCount?: number | undefined
    profileRaisedMaxCap?: number | undefined
    profileDisqualificationReason?: string | undefined
  } {
    if (this.mode === 'fixed') {
      return {
        maxCap: this.fixedCap ?? HOSTED_OCR_AUTO_INITIAL_CAP,
        capSource: 'fixed',
        sourceConfidence: 'none'
      }
    }

    const runPages = Math.max(1, this.documentPages)
    const profilePages = normalizePositiveInteger(admission.documentPageCount, runPages)
    const baseMaxCap = resolveHostedOcrAutoMaxCap(runPages)
    const profileEstimate = findHostedOcrThroughputProfile({
      provider: admission.service,
      model: admission.model,
      pageCount: profilePages,
      ocrConcurrencyMode: 'auto',
      scopeClass: scopeLabel,
      laneTargetCount,
      profilePath: this.profilePath
    })
    const profile = profileEstimate?.profile
    const exactProfileMatch = profile
      && profile.model === admission.model
      && profile.scopeClass === scopeLabel
      && profile.pageCountBand === resolveHostedOcrPageCountBand(profilePages)
      && (profile.laneTargetCount === undefined || profile.laneTargetCount === laneTargetCount)
    const profileRaisedMaxCap = exactProfileMatch && typeof profile.raisedMaxCap === 'number'
      ? clamp(baseMaxCap, HOSTED_OCR_PROFILE_MAX_CAP_CEILING, profile.raisedMaxCap)
      : undefined
    const profileDisqualificationReason = profileEstimate && !(
      typeof profileRaisedMaxCap === 'number'
      && profileRaisedMaxCap > baseMaxCap
      && profileEstimate.confidence === 'healthy'
    )
      ? profile?.disqualificationReason
        ?? (!exactProfileMatch
          ? 'profile-not-exact-match'
          : profileEstimate.confidence !== 'healthy'
            ? 'profile-not-clean'
            : typeof profileRaisedMaxCap === 'number' && profileRaisedMaxCap <= baseMaxCap
              ? 'profile-cap-not-above-auto-cap'
              : 'profile-missing-raised-cap')
      : undefined
    const kimiProfileDisqualificationReason = admission.service === 'kimi' && exactProfileMatch
      ? (profileEstimate?.profile.retryPressureCount ?? 0) > 0 || (profileEstimate?.profile.pauseTimeMs ?? 0) > 0
        ? 'kimi-profile-retry-pressure'
        : typeof profileRaisedMaxCap === 'number'
          && profileRaisedMaxCap >= KIMI_PROFILE_HIGH_CAP_THRESHOLD
          && getCleanSampleCount(profileEstimate?.profile.cleanSampleCount) < KIMI_PROFILE_HIGH_CAP_MIN_CLEAN_SAMPLES
            ? 'kimi-profile-needs-clean-samples'
            : undefined
      : undefined

    if (
      typeof profileRaisedMaxCap === 'number'
      && profileRaisedMaxCap > baseMaxCap
      && profileEstimate?.confidence === 'healthy'
      && kimiProfileDisqualificationReason === undefined
    ) {
      return {
        maxCap: profileRaisedMaxCap,
        capSource: 'profile',
        sourceConfidence: profileEstimate.confidence,
        profileSampleCount: profileEstimate.profile.sampleCount,
        profileRaisedMaxCap
      }
    }

    return {
      maxCap: baseMaxCap,
      capSource: 'unprofiled',
      sourceConfidence: profileEstimate?.confidence ?? 'none',
      ...(typeof profileEstimate?.profile.sampleCount === 'number'
        ? { profileSampleCount: profileEstimate.profile.sampleCount }
        : {}),
      ...(typeof (kimiProfileDisqualificationReason ?? profileDisqualificationReason) === 'string'
        ? { profileDisqualificationReason: kimiProfileDisqualificationReason ?? profileDisqualificationReason }
        : {})
    }
  }

  private getTarget(
    lane: HostedOcrSchedulerLaneState,
    admission: HostedOcrSchedulerAdmission,
    targetKey: string
  ): HostedOcrSchedulerTargetStats {
    const existing = lane.targets.get(targetKey)
    if (existing) {
      return existing
    }
    const target: HostedOcrSchedulerTargetStats = {
      targetKey,
      service: admission.service,
      model: admission.model,
      submittedPages: 0,
      completedPages: 0,
      failedPages: 0
    }
    lane.targets.set(targetKey, target)
    return target
  }

  private getDocumentTarget(
    lane: HostedOcrSchedulerLaneState,
    admission: HostedOcrSchedulerAdmission,
    targetKey: string
  ): HostedOcrSchedulerTargetStats | undefined {
    if (!admission.documentKey) return undefined
    let targets = lane.documentTargets.get(admission.documentKey)
    if (!targets) {
      targets = new Map()
      lane.documentTargets.set(admission.documentKey, targets)
    }
    const existing = targets.get(targetKey)
    if (existing) return existing
    const target: HostedOcrSchedulerTargetStats = {
      targetKey,
      service: admission.service,
      model: admission.model,
      submittedPages: 0,
      completedPages: 0,
      failedPages: 0
    }
    targets.set(targetKey, target)
    return target
  }

  private pickNextJob(lane: HostedOcrSchedulerLaneState): QueuedHostedOcrJob | undefined {
    if (lane.targetOrder.length === 0) {
      return undefined
    }

    for (let offset = 0; offset < lane.targetOrder.length; offset++) {
      const index = (lane.roundRobinCursor + offset) % lane.targetOrder.length
      const targetKey = lane.targetOrder[index]
      if (targetKey === undefined) {
        continue
      }
      const queue = lane.queues.get(targetKey)
      const job = queue?.shift()
      if (job !== undefined && queue !== undefined) {
        if (queue.length === 0) {
          lane.queues.delete(targetKey)
          lane.targetOrder.splice(index, 1)
          lane.roundRobinCursor = lane.targetOrder.length === 0
            ? 0
            : index % lane.targetOrder.length
        } else {
          lane.roundRobinCursor = (index + 1) % lane.targetOrder.length
        }
        return job
      }
    }

    return undefined
  }

  private pumpLane(lane: HostedOcrSchedulerLaneState): void {
    if (lane.pauseUntilMs > Date.now()) {
      this.schedulePausedPump(lane)
      return
    }

    while (lane.active < lane.currentCap) {
      const job = this.pickNextJob(lane)
      if (job === undefined) {
        return
      }
      this.startJob(lane, job)
    }
  }

  private schedulePausedPump(lane: HostedOcrSchedulerLaneState): void {
    if (lane.pumpTimer !== undefined) {
      return
    }
    const delayMs = Math.max(1, lane.pauseUntilMs - Date.now())
    lane.pumpTimer = setTimeout(() => {
      lane.pumpTimer = undefined
      this.pumpLane(lane)
    }, delayMs)
  }

  private startJob(lane: HostedOcrSchedulerLaneState, job: QueuedHostedOcrJob): void {
    const target = this.getTarget(lane, job.admission, job.targetKey)
    const documentTarget = job.documentKey
      ? lane.documentTargets.get(job.documentKey)?.get(job.targetKey)
      : undefined
    const now = Date.now()
    lane.startedAtMs ??= now
    target.startedAtMs ??= now
    if (documentTarget) documentTarget.startedAtMs ??= now
    lane.active += 1
    lane.activePeak = Math.max(lane.activePeak, lane.active)

    void (async () => {
      let retryPressureRecordedForJob = false
      let coreAdmission: HostedConcurrencyAdmissionToken | undefined
      const coreAdmissionRequest = {
        provider: lane.service,
        accountLabel: lane.scopeLabel,
        lane: lane.lane,
        workClass: 'ocr-page' as const,
        configuredLimit: lane.maxCap,
        workId: job.admission.documentKey
          ? `${job.admission.documentKey}:${job.targetKey}`
          : job.targetKey,
        unitIndex: job.admission.pageNumber ?? 0,
        context: {
          targetKey: job.targetKey,
          ...(typeof job.admission.pageNumber === 'number' ? { pageNumber: job.admission.pageNumber } : {})
        }
      }
      try {
        if (this.sharedHostedPolicy) {
          coreAdmission = await this.hostedConcurrencyCoordinator.acquire(coreAdmissionRequest)
        }
        const onRetryable: HostedOcrSchedulerRetryPressureHandler = Object.assign(
          async (pressure: HostedOcrSchedulerRetryPressure, error?: unknown) => {
            if (!retryPressureRecordedForJob) {
              retryPressureRecordedForJob = true
              this.recordLaneRetryPressure(lane, pressure, {
                admission: job.admission,
                targetKey: job.targetKey
              })
            } else {
              this.recordLaneRetryEvent(lane, pressure, {
                admission: job.admission,
                targetKey: job.targetKey
              })
            }
            if (!isRateLimitPressure(pressure) || !this.sharedHostedPolicy) return
            if (!coreAdmission) return
            coreAdmission = await recoverHostedConcurrencyRequest({
              coordinator: this.hostedConcurrencyCoordinator,
              admission: coreAdmissionRequest,
              token: coreAdmission,
              error,
              pressure
            })
            return true
          },
          { managesHostedRateLimitRecovery: this.sharedHostedPolicy }
        )
        const result = await job.task({ onRetryable })
        if (coreAdmission) {
          this.hostedConcurrencyCoordinator.release(coreAdmission, 'succeeded')
          coreAdmission = undefined
        }
        this.recordSuccess(lane, target, documentTarget, job.pageCount)
        job.resolve(result)
      } catch (error) {
        if (coreAdmission) this.hostedConcurrencyCoordinator.release(coreAdmission, 'failed')
        this.recordFailure(lane, target, documentTarget, job, error, retryPressureRecordedForJob)
        job.reject(error)
      } finally {
        lane.active -= 1
        this.pumpLane(lane)
      }
    })()
  }

  private recordSuccess(lane: HostedOcrSchedulerLaneState, target: HostedOcrSchedulerTargetStats, documentTarget: HostedOcrSchedulerTargetStats | undefined, pageCount: number): void {
    const now = Date.now()
    target.completedPages += pageCount
    target.finishedAtMs = now
    if (documentTarget) {
      documentTarget.completedPages += pageCount
      documentTarget.finishedAtMs = now
    }
    lane.completedPages += pageCount
    lane.finishedAtMs = now
    lane.cleanSuccessPages += pageCount

    if (this.sharedHostedPolicy) {
      return
    }

    while (lane.currentCap < lane.maxCap) {
      const fastRamp = lane.cleanFastRampEnabled && lane.retryPressureCount === 0
      const cleanWindowPages = fastRamp ? Math.ceil(lane.currentCap / 2) : lane.currentCap
      if (lane.cleanSuccessPages < cleanWindowPages) {
        break
      }
      lane.cleanSuccessPages -= cleanWindowPages
      lane.currentCap = Math.min(lane.maxCap, lane.currentCap + (fastRamp ? 2 : 1))
    }
  }

  private recordFailure(
    lane: HostedOcrSchedulerLaneState,
    target: HostedOcrSchedulerTargetStats,
    documentTarget: HostedOcrSchedulerTargetStats | undefined,
    job: QueuedHostedOcrJob,
    error: unknown,
    retryPressureRecordedForJob: boolean
  ): void {
    const now = Date.now()
    target.failedPages += job.pageCount
    target.finishedAtMs = now
    if (documentTarget) {
      documentTarget.failedPages += job.pageCount
      documentTarget.finishedAtMs = now
    }
    lane.failedPages += job.pageCount
    lane.finishedAtMs = now
    if (shouldBackoffForError(error) && !retryPressureRecordedForJob) {
      const status = getErrorStatus(error)
      this.recordLaneRetryPressure(lane, {
        reason: isTimeoutLike(error) ? 'timeout' : 'retryable-error',
        ...(typeof status === 'number' ? { status } : {})
      }, {
        admission: job.admission,
        targetKey: job.targetKey
      })
    }
  }

  private recordLaneRetryPressure(
    lane: HostedOcrSchedulerLaneState,
    pressure: HostedOcrSchedulerRetryPressure,
    context?: { admission?: HostedOcrSchedulerAdmission | undefined, targetKey?: string | undefined } | undefined
  ): void {
    lane.retryPressureCount += 1
    if (!this.sharedHostedPolicy) this.applyBackoff(lane)
    this.constrainKimiProfileCapAfterPressure(lane)
    this.recordLaneRetryEvent(lane, pressure, context)
    if (!this.sharedHostedPolicy) this.applyRetryPressurePause(lane, pressure)
  }

  private recordLaneRetryEvent(
    lane: HostedOcrSchedulerLaneState,
    pressure: HostedOcrSchedulerRetryPressure,
    context?: { admission?: HostedOcrSchedulerAdmission | undefined, targetKey?: string | undefined } | undefined
  ): void {
    const delayMs = pressure.retryAfterMs ?? pressure.delayMs
    lane.retryEvents.push({
      reason: pressure.reason,
      ...(context?.targetKey ? { targetKey: context.targetKey } : {}),
      ...(typeof context?.admission?.pageNumber === 'number' ? { pageNumber: context.admission.pageNumber } : {}),
      ...(typeof delayMs === 'number' ? { delayMs } : {}),
      ...(typeof pressure.status === 'number' ? { status: pressure.status } : {}),
      ...(typeof pressure.retryAfterMs === 'number' ? { retryAfterMs: pressure.retryAfterMs } : {}),
      effectiveCap: lane.currentCap
    })
    if (lane.retryEvents.length > HOSTED_OCR_RETRY_EVENT_LIMIT) {
      lane.retryEvents.splice(0, lane.retryEvents.length - HOSTED_OCR_RETRY_EVENT_LIMIT)
    }
  }

  private applyRetryPressurePause(lane: HostedOcrSchedulerLaneState, pressure: HostedOcrSchedulerRetryPressure): void {
    const retryAfterMs = pressure.retryAfterMs ?? pressure.delayMs
    if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      const now = Date.now()
      const newPauseUntilMs = now + Math.ceil(retryAfterMs)
      const overlapStart = Math.max(now, lane.pauseUntilMs)
      if (newPauseUntilMs > overlapStart) {
        lane.pauseTimeMs += newPauseUntilMs - overlapStart
      }
      lane.pauseUntilMs = Math.max(lane.pauseUntilMs, newPauseUntilMs)
    }
  }

  private applyBackoff(lane: HostedOcrSchedulerLaneState): void {
    lane.currentCap = Math.max(1, Math.floor(lane.currentCap / 2))
    lane.cleanSuccessPages = 0
    lane.cleanFastRampEnabled = false
  }

  private constrainKimiProfileCapAfterPressure(lane: HostedOcrSchedulerLaneState): void {
    if (lane.service !== 'kimi' || lane.mode !== 'auto' || lane.capSource !== 'profile') {
      return
    }
    const unprofiledCap = resolveHostedOcrAutoMaxCap(Math.max(1, this.documentPages))
    if (lane.maxCap <= unprofiledCap) {
      return
    }
    lane.maxCap = unprofiledCap
    lane.capSource = 'unprofiled'
    lane.profileDisqualificationReason = 'kimi-current-retry-pressure'
    lane.profileRaisedMaxCap = undefined
    lane.currentCap = Math.min(lane.currentCap, lane.maxCap)
  }

  private snapshotLane(lane: HostedOcrSchedulerLaneState): HostedOcrSchedulerLaneTelemetry {
    const targets = [...lane.targets.values()].map((target) => this.snapshotTarget(lane, target))
    const durationMs = observedDurationMs(lane.startedAtMs, lane.finishedAtMs)
    const projectedMs = projectedObservedDurationMs(lane.submittedPages, lane.completedPages, durationMs)
    const hostedLane = this.sharedHostedPolicy
      ? this.hostedConcurrencyCoordinator.snapshot().lanes.find((entry) => entry.lane.laneKey === lane.laneKey)
      : undefined
    return {
      lane: lane.lane,
      laneKey: lane.laneKey,
      service: lane.service,
      scopeLabel: lane.scopeLabel,
      status: resolveSchedulerStatus(lane.submittedPages, lane.completedPages, lane.failedPages, lane.active),
      mode: lane.mode,
      initialCap: lane.initialCap,
      currentCap: hostedLane?.currentLimit ?? lane.currentCap,
      maxCap: lane.maxCap,
      capSource: lane.capSource,
      sourceConfidence: lane.sourceConfidence,
      ...(typeof lane.profileSampleCount === 'number' ? { profileSampleCount: lane.profileSampleCount } : {}),
      ...(typeof lane.profileRaisedMaxCap === 'number' ? { profileRaisedMaxCap: lane.profileRaisedMaxCap } : {}),
      ...(typeof lane.profileDisqualificationReason === 'string' ? { profileDisqualificationReason: lane.profileDisqualificationReason } : {}),
      activePeak: hostedLane?.classes.find((entry) => entry.workClass === 'ocr-page')?.activePeak ?? lane.activePeak,
      retryPressureCount: hostedLane?.pressureEvents.length ?? lane.retryPressureCount,
      ...(lane.retryEvents.length > 0 ? { retryEvents: lane.retryEvents.slice() } : {}),
      pauseTimeMs: hostedLane?.pauseDurationMs ?? Math.round(lane.pauseTimeMs),
      submittedPages: lane.submittedPages,
      completedPages: lane.completedPages,
      failedPages: lane.failedPages,
      pagesPerMinute: pagesPerMinute(lane.completedPages, lane.startedAtMs, lane.finishedAtMs),
      ...(typeof durationMs === 'number' ? { observedDurationMs: durationMs } : {}),
      ...(typeof projectedMs === 'number' ? { projectedObservedDurationMs: projectedMs } : {}),
      targets
    }
  }

  private snapshotDocument(documentKey: string, documentPages: number): HostedOcrSchedulerTelemetry {
    const { likelyGatingTarget: _runGatingTarget, ...root } = this.snapshot()
    const lanes = [...this.lanes.values()].flatMap((lane) => {
      const documentTargets = lane.documentTargets.get(documentKey)
      if (!documentTargets || documentTargets.size === 0) return []
      const totalCompletedPages = [...documentTargets.values()].reduce(
        (sum, candidate) => sum + candidate.completedPages,
        0
      )
      const targets = [...documentTargets.values()].map((target) =>
        this.snapshotTargetFromTotal(target, totalCompletedPages)
      )
      const submittedPages = targets.reduce((sum, target) => sum + target.submittedPages, 0)
      const completedPages = targets.reduce((sum, target) => sum + target.completedPages, 0)
      const failedPages = targets.reduce((sum, target) => sum + target.failedPages, 0)
      const starts = [...documentTargets.values()].flatMap((target) => target.startedAtMs === undefined ? [] : [target.startedAtMs])
      const finishes = [...documentTargets.values()].flatMap((target) => target.finishedAtMs === undefined ? [] : [target.finishedAtMs])
      const startedAtMs = starts.length > 0 ? Math.min(...starts) : undefined
      const finishedAtMs = finishes.length > 0 ? Math.max(...finishes) : undefined
      const durationMs = observedDurationMs(startedAtMs, finishedAtMs)
      const projectedMs = projectedObservedDurationMs(submittedPages, completedPages, durationMs)
      return [{
        ...this.snapshotLane(lane),
        status: resolveSchedulerStatus(submittedPages, completedPages, failedPages),
        submittedPages,
        completedPages,
        failedPages,
        pagesPerMinute: pagesPerMinute(completedPages, startedAtMs, finishedAtMs),
        observedDurationMs: durationMs,
        projectedObservedDurationMs: projectedMs,
        targets
      }]
    })
    const likelyGatingTarget = lanes
      .flatMap((lane) => lane.targets.map((target) => ({ lane, target })))
      .filter((entry) =>
        entry.target.submittedPages > 0
        && (
          typeof entry.target.projectedObservedDurationMs === 'number'
          || typeof entry.target.observedDurationMs === 'number'
          || typeof entry.target.pagesPerMinute === 'number'
        )
      )
      .sort((left, right) => {
        const leftProjected = left.target.projectedObservedDurationMs ?? left.target.observedDurationMs ?? 0
        const rightProjected = right.target.projectedObservedDurationMs ?? right.target.observedDurationMs ?? 0
        if (rightProjected !== leftProjected) return rightProjected - leftProjected
        const leftThroughput = left.target.pagesPerMinute ?? Number.POSITIVE_INFINITY
        const rightThroughput = right.target.pagesPerMinute ?? Number.POSITIVE_INFINITY
        return leftThroughput - rightThroughput
      })[0]
    return {
      ...root,
      documentPages,
      documentCount: 1,
      lanes,
      ...(likelyGatingTarget
        ? {
            likelyGatingTarget: {
              laneKey: likelyGatingTarget.lane.laneKey,
              targetKey: likelyGatingTarget.target.targetKey,
              service: likelyGatingTarget.target.service,
              model: likelyGatingTarget.target.model,
              status: likelyGatingTarget.target.status,
              submittedPages: likelyGatingTarget.target.submittedPages,
              completedPages: likelyGatingTarget.target.completedPages,
              failedPages: likelyGatingTarget.target.failedPages,
              share: likelyGatingTarget.target.share,
              pagesPerMinute: likelyGatingTarget.target.pagesPerMinute,
              ...(typeof likelyGatingTarget.target.observedDurationMs === 'number'
                ? { observedDurationMs: likelyGatingTarget.target.observedDurationMs }
                : {}),
              ...(typeof likelyGatingTarget.target.projectedObservedDurationMs === 'number'
                ? { projectedObservedDurationMs: likelyGatingTarget.target.projectedObservedDurationMs }
                : {})
            }
          }
        : {})
    }
  }

  private snapshotTarget(
    lane: HostedOcrSchedulerLaneState,
    target: HostedOcrSchedulerTargetStats
  ): HostedOcrSchedulerTargetTelemetry {
    return this.snapshotTargetFromTotal(target, lane.completedPages)
  }

  private snapshotTargetFromTotal(
    target: HostedOcrSchedulerTargetStats,
    totalCompletedPages: number
  ): HostedOcrSchedulerTargetTelemetry {
    const durationMs = observedDurationMs(target.startedAtMs, target.finishedAtMs)
    const projectedMs = projectedObservedDurationMs(target.submittedPages, target.completedPages, durationMs)
    return {
      targetKey: target.targetKey,
      service: target.service,
      model: target.model,
      status: resolveSchedulerStatus(target.submittedPages, target.completedPages, target.failedPages),
      submittedPages: target.submittedPages,
      completedPages: target.completedPages,
      failedPages: target.failedPages,
      share: totalCompletedPages > 0 ? roundMetric(target.completedPages / totalCompletedPages) : 0,
      pagesPerMinute: pagesPerMinute(target.completedPages, target.startedAtMs, target.finishedAtMs),
      ...(typeof durationMs === 'number' ? { observedDurationMs: durationMs } : {}),
      ...(typeof projectedMs === 'number' ? { projectedObservedDurationMs: projectedMs } : {})
    }
  }
}

export const createHostedOcrScheduler = (
  options: HostedOcrSchedulerOptions
): HostedOcrScheduler =>
  new HostedOcrSchedulerImpl(options)

export const runHostedOcrSchedulerAdmission = async <T>(
  scheduler: HostedOcrScheduler | undefined,
  admission: HostedOcrSchedulerAdmission,
  task: (onRetryable: HostedOcrSchedulerRetryPressureHandler | undefined) => Promise<T>
): Promise<T> => {
  if (!scheduler) {
    return await task(undefined)
  }
  return await scheduler.run(admission, async ({ onRetryable }) => await task(onRetryable))
}
