import type {
  HostedOcrLaneEngineOptions,
  HostedOcrSchedulerAdmission,
  HostedOcrSchedulerLaneState,
  HostedOcrSchedulerTargetStats,
  QueuedHostedOcrJob
} from '~/types'
import { InternalError } from '~/utils/error-handler'
import { resolveHostedOcrSuccessRamp } from './hosted-ocr-cap-policy'

const laneInvariantError = (
  lane: HostedOcrSchedulerLaneState,
  message: string
): Error =>
  InternalError(`Hosted OCR lane ${lane.laneKey} invariant failed: ${message}`, {
    stage: 'ocr:lane-engine',
    retryable: false,
    metadata: { laneKey: lane.laneKey }
  })

const createTarget = (
  admission: HostedOcrSchedulerAdmission,
  targetKey: string
): HostedOcrSchedulerTargetStats => ({
  targetKey,
  service: admission.service,
  model: admission.model,
  submittedPages: 0,
  completedPages: 0,
  failedPages: 0
})

const getOrCreateTarget = (
  targets: Map<string, HostedOcrSchedulerTargetStats>,
  admission: HostedOcrSchedulerAdmission,
  targetKey: string
): HostedOcrSchedulerTargetStats => {
  const existing = targets.get(targetKey)
  if (existing) return existing
  const target = createTarget(admission, targetKey)
  targets.set(targetKey, target)
  return target
}

const getDocumentTarget = (
  lane: HostedOcrSchedulerLaneState,
  job: QueuedHostedOcrJob
): HostedOcrSchedulerTargetStats | undefined =>
  job.documentKey
    ? lane.documentTargets.get(job.documentKey)?.get(job.targetKey)
    : undefined

export class HostedOcrLaneEngine {
  constructor(private readonly options: HostedOcrLaneEngineOptions) {}

  submit(lane: HostedOcrSchedulerLaneState, queueKey: string, job: QueuedHostedOcrJob): void {
    const target = getOrCreateTarget(
      lane.targets,
      job.admission,
      job.targetKey
    )
    const documentTarget = this.getOrCreateDocumentTarget(lane, job)
    target.submittedPages += job.pageCount
    if (documentTarget) documentTarget.submittedPages += job.pageCount
    lane.submittedPages += job.pageCount

    const queue = lane.queues.get(queueKey) ?? []
    queue.push(job)
    lane.queues.set(queueKey, queue)
    if (!lane.targetOrder.includes(queueKey)) {
      lane.targetOrder.push(queueKey)
    }
    this.assertInvariants(lane)
    this.pump(lane)
  }

  pump(lane: HostedOcrSchedulerLaneState): void {
    this.assertInvariants(lane)
    if (lane.pauseUntilMs > this.options.now()) {
      this.schedulePausedPump(lane)
      return
    }

    while (lane.active < lane.currentCap) {
      const job = this.pickNextJob(lane)
      if (!job) return
      this.start(lane, job)
    }
  }

  finishSuccess(
    lane: HostedOcrSchedulerLaneState,
    job: QueuedHostedOcrJob
  ): void {
    const target = this.requireTarget(lane, job.targetKey)
    const documentTarget = getDocumentTarget(lane, job)
    const now = this.options.now()
    target.completedPages += job.pageCount
    target.finishedAtMs = now
    if (documentTarget) {
      documentTarget.completedPages += job.pageCount
      documentTarget.finishedAtMs = now
    }
    lane.completedPages += job.pageCount
    lane.finishedAtMs = now
    if (!this.options.sharedHostedPolicy) {
      Object.assign(
        lane,
        resolveHostedOcrSuccessRamp(lane, job.pageCount)
      )
    }
    this.finish(lane)
  }

  finishFailure(
    lane: HostedOcrSchedulerLaneState,
    job: QueuedHostedOcrJob
  ): void {
    const target = this.requireTarget(lane, job.targetKey)
    const documentTarget = getDocumentTarget(lane, job)
    const now = this.options.now()
    target.failedPages += job.pageCount
    target.finishedAtMs = now
    if (documentTarget) {
      documentTarget.failedPages += job.pageCount
      documentTarget.finishedAtMs = now
    }
    lane.failedPages += job.pageCount
    lane.finishedAtMs = now
    this.finish(lane)
  }

  assertInvariants(lane: HostedOcrSchedulerLaneState): void {
    if (
      lane.active < 0
      || lane.currentCap < 1
      || lane.maxCap < lane.currentCap
    ) {
      throw laneInvariantError(lane, 'active and cap accounting is invalid')
    }
    if (new Set(lane.targetOrder).size !== lane.targetOrder.length) {
      throw laneInvariantError(lane, 'queue order contains duplicates')
    }
    for (const queueKey of lane.targetOrder) {
      const queue = lane.queues.get(queueKey)
      if (!queue || queue.length === 0) {
        throw laneInvariantError(
          lane,
          `queue order references empty queue ${queueKey}`
        )
      }
    }
    for (const [queueKey, queue] of lane.queues) {
      if (queue.length === 0 || !lane.targetOrder.includes(queueKey)) {
        throw laneInvariantError(
          lane,
          `queue ${queueKey} is not represented in queue order`
        )
      }
    }
    if (
      lane.targetOrder.length === 0
        ? lane.roundRobinCursor !== 0
        : lane.roundRobinCursor < 0
          || lane.roundRobinCursor >= lane.targetOrder.length
    ) {
      throw laneInvariantError(lane, 'round-robin cursor is out of bounds')
    }
  }

  private getOrCreateDocumentTarget(
    lane: HostedOcrSchedulerLaneState,
    job: QueuedHostedOcrJob
  ): HostedOcrSchedulerTargetStats | undefined {
    if (!job.documentKey) return undefined
    let targets = lane.documentTargets.get(job.documentKey)
    if (!targets) {
      targets = new Map()
      lane.documentTargets.set(job.documentKey, targets)
    }
    return getOrCreateTarget(targets, job.admission, job.targetKey)
  }

  private requireTarget(
    lane: HostedOcrSchedulerLaneState,
    targetKey: string
  ): HostedOcrSchedulerTargetStats {
    const target = lane.targets.get(targetKey)
    if (!target) {
      throw laneInvariantError(lane, `missing target ${targetKey}`)
    }
    return target
  }

  private pickNextJob(
    lane: HostedOcrSchedulerLaneState
  ): QueuedHostedOcrJob | undefined {
    for (let offset = 0; offset < lane.targetOrder.length; offset += 1) {
      const index =
        (lane.roundRobinCursor + offset) % lane.targetOrder.length
      const queueKey = lane.targetOrder[index]
      if (queueKey === undefined) {
        throw laneInvariantError(lane, `missing queue key at index ${index}`)
      }
      const queue = lane.queues.get(queueKey)
      if (!queue) {
        throw laneInvariantError(lane, `missing queue ${queueKey}`)
      }
      const job = queue.shift()
      if (!job) {
        throw laneInvariantError(lane, `empty queue ${queueKey}`)
      }
      if (queue.length === 0) {
        lane.queues.delete(queueKey)
        lane.targetOrder.splice(index, 1)
        lane.roundRobinCursor = lane.targetOrder.length === 0
          ? 0
          : index % lane.targetOrder.length
      } else {
        lane.roundRobinCursor = (index + 1) % lane.targetOrder.length
      }
      this.assertInvariants(lane)
      return job
    }
    return undefined
  }

  private schedulePausedPump(lane: HostedOcrSchedulerLaneState): void {
    if (lane.pumpTimer !== undefined) return
    const delayMs = Math.max(1, lane.pauseUntilMs - this.options.now())
    lane.pumpTimer = this.options.setTimer(() => {
      lane.pumpTimer = undefined
      this.pump(lane)
    }, delayMs)
  }

  private start(
    lane: HostedOcrSchedulerLaneState,
    job: QueuedHostedOcrJob
  ): void {
    const target = this.requireTarget(lane, job.targetKey)
    const documentTarget = getDocumentTarget(lane, job)
    const now = this.options.now()
    lane.startedAtMs ??= now
    target.startedAtMs ??= now
    if (documentTarget) documentTarget.startedAtMs ??= now
    lane.active += 1
    lane.activePeak = Math.max(lane.activePeak, lane.active)
    this.assertInvariants(lane)
    this.options.startJob(lane, job, { target, documentTarget })
  }

  private finish(lane: HostedOcrSchedulerLaneState): void {
    lane.active -= 1
    this.assertInvariants(lane)
    this.pump(lane)
  }
}
