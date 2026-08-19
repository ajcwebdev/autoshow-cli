import type {
  HostedConcurrencyAdmission,
  HostedConcurrencyAdmissionToken,
  HostedConcurrencyCoordinator,
  HostedOcrScheduler,
  HostedOcrSchedulerAdmission,
  HostedOcrSchedulerLaneState,
  HostedOcrSchedulerOptions,
  HostedOcrSchedulerRetryPressure,
  HostedOcrSchedulerRetryPressureHandler,
  HostedOcrSchedulerRunControls,
  HostedOcrSchedulerTelemetry,
  HostedOcrService,
  HostedOcrLaneJobStart,
  HostedOcrRetryContext,
  HostedOcrTelemetryRoot,
  OcrConcurrencyMode,
  ProviderLaneIdentity,
  QueuedHostedOcrJob
} from '~/types'
import { createProviderLaneIdentity } from '~/cli/commands/process-steps/provider-lane-contract'
import {
  createHostedConcurrencyCoordinator,
  recoverHostedConcurrencyRequest
} from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import {
  buildHostedOcrRetryEvent,
  getHostedOcrErrorStatus,
  HOSTED_OCR_AUTO_INITIAL_CAP,
  HOSTED_OCR_DEFAULT_SCOPE_LABEL,
  isHostedOcrRateLimitPressure,
  isHostedOcrTimeoutError,
  normalizeHostedOcrPositiveInteger,
  resolveHostedOcrBackoff,
  resolveHostedOcrInitialCaps,
  resolveHostedOcrLaneCapsFromProfiles,
  resolveHostedOcrLaneProfileRefresh,
  resolveHostedOcrRetryEvents,
  resolveHostedOcrRetryPause,
  resolveKimiHostedOcrProfileAfterPressure,
  shouldBackoffHostedOcrError
} from './hosted-ocr-cap-policy'
import { HostedOcrLaneEngine } from './hosted-ocr-lane-engine'
import {
  projectHostedOcrDocumentTelemetry,
  projectHostedOcrRunTelemetry
} from './hosted-ocr-telemetry'

export {
  HOSTED_OCR_AUTO_INITIAL_CAP,
  HOSTED_OCR_AUTO_MAX_CAP_CEILING,
  HOSTED_OCR_DEFAULT_SCOPE_LABEL,
  HOSTED_OCR_LARGE_DOCUMENT_THRESHOLD,
  HOSTED_OCR_PROFILE_MAX_CAP_CEILING,
  resolveHostedOcrAutoMaxCap,
  resolveHostedOcrEstimateCap,
  resolveHostedOcrLaneKey
} from './hosted-ocr-cap-policy'

const targetKeyFor = (
  admission: HostedOcrSchedulerAdmission
): string =>
  admission.targetKey ?? `${admission.service}:${admission.model}`

const queueKeyFor = (
  admission: HostedOcrSchedulerAdmission,
  targetKey: string
): string =>
  admission.documentKey
    ? `${admission.documentKey}:${targetKey}`
    : targetKey

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
  private readonly now: () => number
  private readonly laneEngine: HostedOcrLaneEngine

  constructor(options: HostedOcrSchedulerOptions) {
    this.mode = options.mode
    this.lifetime = options.lifetime ?? 'document'
    this.documentPages = options.pageCount > 0
      ? normalizeHostedOcrPositiveInteger(options.pageCount, 1)
      : 0
    this.documentCount = this.documentPages > 0 ? 1 : 0
    this.fixedCap = options.mode === 'fixed'
      ? normalizeHostedOcrPositiveInteger(
          options.fixedCap,
          HOSTED_OCR_AUTO_INITIAL_CAP
        )
      : undefined
    this.profilePath = options.profilePath
    this.sharedHostedPolicy =
      options.concurrencyMode !== undefined
      || options.hostedConcurrencyCoordinator !== undefined
    this.hostedConcurrencyCoordinator =
      options.hostedConcurrencyCoordinator
      ?? createHostedConcurrencyCoordinator({
        mode: options.concurrencyMode ?? 'immediate'
      })
    this.now = options.now ?? Date.now
    const setTimer = options.setTimer
      ?? ((callback: () => void, delayMs: number) =>
        setTimeout(callback, delayMs))
    this.laneEngine = new HostedOcrLaneEngine({
      now: this.now,
      setTimer,
      sharedHostedPolicy: this.sharedHostedPolicy,
      startJob: (lane, job, transition) => {
        this.startJob(lane, job, transition)
      }
    })
  }

  run = async <T>(
    admission: HostedOcrSchedulerAdmission,
    task: (controls: HostedOcrSchedulerRunControls) => Promise<T>
  ): Promise<T> => {
    const targetKey = targetKeyFor(admission)
    const queueKey = queueKeyFor(admission, targetKey)
    const lane = this.getLane(admission, targetKey)
    const pageCount = normalizeHostedOcrPositiveInteger(
      admission.pageCount,
      1
    )

    return await new Promise<T>((resolve, reject) => {
      const job: QueuedHostedOcrJob = {
        admission: {
          ...admission,
          service: admission.service,
          model: admission.model
        },
        targetKey,
        ...(admission.documentKey
          ? { documentKey: admission.documentKey }
          : {}),
        pageCount,
        execute: async (controls) => {
          const result = await task(controls)
          return () => resolve(result)
        },
        reject
      }
      this.laneEngine.submit(lane, queueKey, job)
    })
  }

  snapshot = (): HostedOcrSchedulerTelemetry =>
    projectHostedOcrRunTelemetry(
      this.telemetryRoot(),
      this.lanes.values()
    )

  getMaxConcurrency = (
    admission: HostedOcrSchedulerAdmission
  ): number => {
    const laneIdentity = this.resolveLaneIdentity(admission)
    if (this.mode === 'fixed') {
      return this.fixedCap ?? HOSTED_OCR_AUTO_INITIAL_CAP
    }
    const existingLane = this.lanes.get(laneIdentity.laneKey)
    if (
      existingLane?.service === 'kimi'
      && existingLane.retryPressureCount > 0
    ) {
      return existingLane.maxCap
    }
    const targetKey = targetKeyFor(admission)
    const laneTargetCount = existingLane
      ? this.prospectiveLaneTargetCount(existingLane, targetKey)
      : 1
    const resolution = this.resolveLaneCaps(
      admission,
      laneIdentity.scopeLabel,
      laneTargetCount
    )
    return existingLane
      ? Math.max(existingLane.maxCap, resolution.maxCap)
      : resolution.maxCap
  }

  recordRetryPressure = (
    admission: HostedOcrSchedulerAdmission,
    pressure: HostedOcrSchedulerRetryPressure
  ): void => {
    const targetKey = targetKeyFor(admission)
    this.recordLaneRetryPressure(
      this.getLane(admission, targetKey),
      pressure,
      { admission, targetKey }
    )
  }

  createDocumentScope = (pageCount: number): HostedOcrScheduler => {
    const documentKey = `document-${this.nextDocumentId}`
    this.nextDocumentId += 1
    const documentPageCount = normalizeHostedOcrPositiveInteger(
      pageCount,
      1
    )
    this.documentPages += documentPageCount
    this.documentCount += 1
    const bindAdmission = (
      admission: HostedOcrSchedulerAdmission
    ): HostedOcrSchedulerAdmission => ({
      ...admission,
      documentKey,
      documentPageCount
    })
    return {
      run: async (admission, task) =>
        await this.run(bindAdmission(admission), task),
      snapshot: () =>
        projectHostedOcrDocumentTelemetry(
          this.telemetryRoot(),
          this.lanes.values(),
          documentKey,
          documentPageCount
        ),
      getMaxConcurrency: (admission) =>
        this.getMaxConcurrency(bindAdmission(admission)),
      recordRetryPressure: (admission, pressure) =>
        this.recordRetryPressure(bindAdmission(admission), pressure),
      createDocumentScope: this.createDocumentScope,
      getLifetime: this.getLifetime
    }
  }

  getLifetime = (): 'document' | 'run' => this.lifetime

  private telemetryRoot(): HostedOcrTelemetryRoot {
    return {
      lifetime: this.lifetime,
      mode: this.mode,
      ...(this.fixedCap !== undefined
        ? { fixedCap: this.fixedCap }
        : {}),
      documentPages: this.documentPages,
      documentCount: this.documentCount,
      sharedHostedPolicy: this.sharedHostedPolicy,
      ...(this.sharedHostedPolicy
        ? {
            hostedConcurrency:
              this.hostedConcurrencyCoordinator.snapshot()
          }
        : {})
    }
  }

  private resolveLaneIdentity(
    admission: HostedOcrSchedulerAdmission
  ): ProviderLaneIdentity<HostedOcrService> {
    if (admission.lane) {
      if (admission.lane.service !== admission.service) {
        throw new Error(
          `Hosted OCR lane service ${admission.lane.service} does not match admission service ${admission.service}.`
        )
      }
      const identity = createProviderLaneIdentity(
        admission.service,
        admission.lane.scopeLabel,
        HOSTED_OCR_DEFAULT_SCOPE_LABEL
      )
      if (admission.lane.laneKey !== identity.laneKey) {
        throw new Error(
          'Hosted OCR lane key does not match its service and scope label.'
        )
      }
      return identity
    }
    const identity = createProviderLaneIdentity(
      admission.service,
      admission.scopeLabel,
      HOSTED_OCR_DEFAULT_SCOPE_LABEL
    )
    if (admission.laneKey && admission.laneKey !== identity.laneKey) {
      throw new Error(
        'Hosted OCR lane key does not match its service and scope label.'
      )
    }
    return identity
  }

  private getLane(
    admission: HostedOcrSchedulerAdmission,
    targetKey: string
  ): HostedOcrSchedulerLaneState {
    const laneIdentity = this.resolveLaneIdentity(admission)
    const existing = this.lanes.get(laneIdentity.laneKey)
    if (existing) {
      const refresh = resolveHostedOcrLaneProfileRefresh(
        existing,
        this.resolveLaneCaps(
          admission,
          laneIdentity.scopeLabel,
          this.prospectiveLaneTargetCount(existing, targetKey)
        )
      )
      if (refresh) Object.assign(existing, refresh)
      return existing
    }

    const capResolution = this.resolveLaneCaps(
      admission,
      laneIdentity.scopeLabel,
      1
    )
    const caps = resolveHostedOcrInitialCaps({
      mode: this.mode,
      documentPages: this.documentPages,
      maxCap: capResolution.maxCap,
      sharedHostedPolicy: this.sharedHostedPolicy,
      hostedConcurrencyMode: this.hostedConcurrencyCoordinator.mode
    })
    const lane: HostedOcrSchedulerLaneState = {
      lane: laneIdentity,
      laneKey: laneIdentity.laneKey,
      service: admission.service,
      scopeLabel: laneIdentity.scopeLabel,
      mode: this.mode,
      ...caps,
      capSource: capResolution.capSource,
      sourceConfidence: capResolution.sourceConfidence,
      ...(typeof capResolution.profileSampleCount === 'number'
        ? { profileSampleCount: capResolution.profileSampleCount }
        : {}),
      ...(typeof capResolution.profileRaisedMaxCap === 'number'
        ? { profileRaisedMaxCap: capResolution.profileRaisedMaxCap }
        : {}),
      ...(typeof capResolution.profileDisqualificationReason === 'string'
        ? {
            profileDisqualificationReason:
              capResolution.profileDisqualificationReason
          }
        : {}),
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
    this.lanes.set(lane.laneKey, lane)
    return lane
  }

  private prospectiveLaneTargetCount(
    lane: HostedOcrSchedulerLaneState,
    targetKey: string
  ): number {
    return Math.max(
      1,
      lane.targets.size + (lane.targets.has(targetKey) ? 0 : 1)
    )
  }

  private resolveLaneCaps(
    admission: HostedOcrSchedulerAdmission,
    scopeLabel: string,
    laneTargetCount: number
  ) {
    return resolveHostedOcrLaneCapsFromProfiles({
      admission,
      mode: this.mode,
      fixedCap: this.fixedCap,
      runPages: this.documentPages,
      scopeLabel,
      laneTargetCount,
      profilePath: this.profilePath
    })
  }

  private startJob(
    lane: HostedOcrSchedulerLaneState,
    job: QueuedHostedOcrJob,
    _transition: HostedOcrLaneJobStart
  ): void {
    void this.executeJob(lane, job)
  }

  private async executeJob(
    lane: HostedOcrSchedulerLaneState,
    job: QueuedHostedOcrJob
  ): Promise<void> {
    let retryPressureRecordedForJob = false
    let coreAdmission: HostedConcurrencyAdmissionToken | undefined
    let resolveJob: () => void
    const coreAdmissionRequest = this.coreAdmissionRequest(lane, job)
    try {
      if (this.sharedHostedPolicy) {
        coreAdmission =
          await this.hostedConcurrencyCoordinator.acquire(
            coreAdmissionRequest
          )
      }
      const onRetryable: HostedOcrSchedulerRetryPressureHandler =
        Object.assign(
          async (
            pressure: HostedOcrSchedulerRetryPressure,
            error?: unknown
          ) => {
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
            if (
              !isHostedOcrRateLimitPressure(pressure)
              || !this.sharedHostedPolicy
              || !coreAdmission
            ) {
              return
            }
            coreAdmission = await recoverHostedConcurrencyRequest({
              coordinator: this.hostedConcurrencyCoordinator,
              admission: coreAdmissionRequest,
              token: coreAdmission,
              error,
              pressure
            })
            return true
          },
          {
            managesHostedRateLimitRecovery:
              this.sharedHostedPolicy
          }
        )
      resolveJob = await job.execute({ onRetryable })
      if (coreAdmission) {
        this.hostedConcurrencyCoordinator.release(
          coreAdmission,
          'succeeded'
        )
        coreAdmission = undefined
      }
    } catch (error) {
      if (coreAdmission) {
        this.hostedConcurrencyCoordinator.release(
          coreAdmission,
          'failed'
        )
      }
      this.recordFailurePressure(
        lane,
        job,
        error,
        retryPressureRecordedForJob
      )
      this.laneEngine.finishFailure(lane, job)
      job.reject(error)
      return
    }
    this.laneEngine.finishSuccess(lane, job)
    resolveJob()
  }

  private coreAdmissionRequest(
    lane: HostedOcrSchedulerLaneState,
    job: QueuedHostedOcrJob
  ): HostedConcurrencyAdmission {
    return {
      provider: lane.service,
      accountLabel: lane.scopeLabel,
      lane: lane.lane,
      workClass: 'ocr-page',
      configuredLimit: lane.maxCap,
      workId: job.admission.documentKey
        ? `${job.admission.documentKey}:${job.targetKey}`
        : job.targetKey,
      unitIndex: job.admission.pageNumber ?? 0,
      context: {
        targetKey: job.targetKey,
        ...(typeof job.admission.pageNumber === 'number'
          ? { pageNumber: job.admission.pageNumber }
          : {})
      }
    }
  }

  private recordFailurePressure(
    lane: HostedOcrSchedulerLaneState,
    job: QueuedHostedOcrJob,
    error: unknown,
    retryPressureRecordedForJob: boolean
  ): void {
    if (
      !shouldBackoffHostedOcrError(error)
      || retryPressureRecordedForJob
    ) {
      return
    }
    const status = getHostedOcrErrorStatus(error)
    this.recordLaneRetryPressure(
      lane,
      {
        reason: isHostedOcrTimeoutError(error)
          ? 'timeout'
          : 'retryable-error',
        ...(typeof status === 'number' ? { status } : {})
      },
      {
        admission: job.admission,
        targetKey: job.targetKey
      }
    )
  }

  private recordLaneRetryPressure(
    lane: HostedOcrSchedulerLaneState,
    pressure: HostedOcrSchedulerRetryPressure,
    context?: HostedOcrRetryContext | undefined
  ): void {
    lane.retryPressureCount += 1
    if (!this.sharedHostedPolicy) {
      Object.assign(lane, resolveHostedOcrBackoff(lane))
    }
    const kimiConstraint = resolveKimiHostedOcrProfileAfterPressure(
      lane,
      this.documentPages
    )
    if (kimiConstraint) Object.assign(lane, kimiConstraint)
    this.recordLaneRetryEvent(lane, pressure, context)
    if (!this.sharedHostedPolicy) {
      const pause = resolveHostedOcrRetryPause(
        lane.pauseUntilMs,
        pressure,
        this.now()
      )
      lane.pauseUntilMs = pause.pauseUntilMs
      lane.pauseTimeMs += pause.addedPauseTimeMs
    }
  }

  private recordLaneRetryEvent(
    lane: HostedOcrSchedulerLaneState,
    pressure: HostedOcrSchedulerRetryPressure,
    context?: HostedOcrRetryContext | undefined
  ): void {
    lane.retryEvents = resolveHostedOcrRetryEvents(
      lane.retryEvents,
      buildHostedOcrRetryEvent(lane, pressure, context)
    )
  }
}

export const createHostedOcrScheduler = (
  options: HostedOcrSchedulerOptions
): HostedOcrScheduler =>
  new HostedOcrSchedulerImpl(options)

export const runHostedOcrSchedulerAdmission = async <T>(
  scheduler: HostedOcrScheduler | undefined,
  admission: HostedOcrSchedulerAdmission,
  task: (
    onRetryable: HostedOcrSchedulerRetryPressureHandler | undefined
  ) => Promise<T>
): Promise<T> => {
  if (!scheduler) return await task(undefined)
  return await scheduler.run(
    admission,
    async ({ onRetryable }) => await task(onRetryable)
  )
}
