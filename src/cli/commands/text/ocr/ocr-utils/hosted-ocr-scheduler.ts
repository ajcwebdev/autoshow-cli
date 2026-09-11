import type {
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
  HostedOcrLaneJobStart,
  HostedOcrTelemetryRoot,
  OcrConcurrencyMode,
  QueuedHostedOcrJob
} from '~/types'
import {
  createHostedConcurrencyCoordinator,
  recoverHostedConcurrencyRequest
} from '~/cli/commands/command-shared/hosted-concurrency-coordinator'
import { HOSTED_OCR_AUTO_INITIAL_CAP, isHostedOcrRateLimitPressure, normalizeHostedOcrPositiveInteger } from './hosted-ocr-cap-policy'
import { getOrCreateHostedOcrLane, prospectiveHostedOcrLaneTargetCount, resolveHostedOcrLaneIdentity, resolveHostedOcrRegistryCaps } from './hosted-ocr-lane-registry'
import type { HostedOcrLaneRegistryPolicy } from './hosted-ocr-lane-registry'
import { recordHostedOcrFailurePressure, recordHostedOcrLaneRetryEvent, recordHostedOcrLaneRetryPressure } from './hosted-ocr-pressure-adapter'
import type { HostedOcrPressurePolicy } from './hosted-ocr-pressure-adapter'
import { buildHostedOcrCoreAdmission } from './hosted-ocr-core-admission'
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
    const laneIdentity = resolveHostedOcrLaneIdentity(admission)
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
      ? prospectiveHostedOcrLaneTargetCount(existingLane, targetKey)
      : 1
    const resolution = resolveHostedOcrRegistryCaps(this.lanePolicy(),
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
    recordHostedOcrLaneRetryPressure(this.pressurePolicy(),
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

  private lanePolicy(): HostedOcrLaneRegistryPolicy {
    return {
      mode: this.mode,
      fixedCap: this.fixedCap,
      documentPages: this.documentPages,
      profilePath: this.profilePath,
      sharedHostedPolicy: this.sharedHostedPolicy,
      hostedConcurrencyMode: this.hostedConcurrencyCoordinator.mode
    }
  }

  private getLane(admission: HostedOcrSchedulerAdmission, targetKey: string): HostedOcrSchedulerLaneState {
    return getOrCreateHostedOcrLane(this.lanes, this.lanePolicy(), admission, targetKey)
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
    const coreAdmissionRequest = buildHostedOcrCoreAdmission(lane, job)
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
              recordHostedOcrLaneRetryPressure(this.pressurePolicy(),lane, pressure, {
                admission: job.admission,
                targetKey: job.targetKey
              })
            } else {
              recordHostedOcrLaneRetryEvent(lane, pressure, {
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
      recordHostedOcrFailurePressure(this.pressurePolicy(),
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

  private pressurePolicy(): HostedOcrPressurePolicy {
    return { sharedHostedPolicy: this.sharedHostedPolicy, documentPages: this.documentPages, now: this.now }
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
