import type { HostedConcurrencyAdmission, HostedTtsChunkAdmissionToken, HostedTtsChunkJob, HostedTtsProviderChunkState, HostedTtsRunChunksOptions } from '~/types'
import { InternalError } from '~/utils/error-handler'

export const hasRemainingHostedTtsChunks = (job: HostedTtsChunkJob): boolean =>
  !job.failed
  && !job.settled
  && job.abortSignal?.aborted !== true
  && job.nextChunkIndex < job.chunks.length

export const detachHostedTtsAbortListener = (job: HostedTtsChunkJob): void => {
  if (job.abortSignal && job.abortListener) {
    job.abortSignal.removeEventListener('abort', job.abortListener)
  }
  job.abortSignal = undefined
  job.abortListener = undefined
}

export const settleHostedTtsJobIfComplete = <T>(job: HostedTtsChunkJob<T>): boolean => {
  if (
    job.settled
    || job.failed
    || job.active > 0
    || job.completedChunks < job.chunks.length
  ) {
    return false
  }

  job.settled = true
  detachHostedTtsAbortListener(job)
  job.resolve(job.results)
  return true
}

export const settleHostedTtsFailedJobIfInactive = (job: HostedTtsChunkJob): boolean => {
  if (job.settled || !job.failed || job.active > 0) {
    return false
  }

  job.settled = true
  detachHostedTtsAbortListener(job)
  job.reject(job.failureReason ?? InternalError('Hosted TTS chunk job failed', {
    stage: 'tts:chunk-scheduler'
  }))
  return true
}

export const createHostedTtsChunkJob = <T>(
  state: HostedTtsProviderChunkState,
  internalId: number,
  chunks: readonly string[],
  runChunk: (chunk: string, index: number, admission: HostedTtsChunkAdmissionToken) => Promise<T>,
  options: HostedTtsRunChunksOptions
): HostedTtsChunkJob<T> => {
  const provider = state.provider
  const jobContext = options.job ?? {}
  return {
    ...jobContext,
    internalId,
    lane: state.lane,
    jobId: jobContext.jobId ?? `${provider}-${internalId}`,
    provider,
    originalOrder: jobContext.originalOrder ?? internalId,
    chunks,
    runChunk,
    results: new Array<T>(chunks.length),
    registeredAtMs: Date.now(),
    nextChunkIndex: 0,
    active: 0,
    startedChunks: 0,
    completedChunks: 0,
    failedChunks: 0,
    retryCount: 0,
    rateLimitCount: 0,
    queueWaitSamplesMs: [],
    activeLatencySamplesMs: [],
    dispatchDebt: 0,
    lastDispatchSequence: 0,
    failed: false,
    settled: false,
    abortSignal: options.abortSignal,
    resolve: () => undefined,
    reject: () => undefined
  }
}

export const beginHostedTtsChunk = <T>(state: HostedTtsProviderChunkState, job: HostedTtsChunkJob<T>): {
  admission: HostedTtsChunkAdmissionToken
  activeStartedAtMs: number
} => {
  const chunkIndex = job.nextChunkIndex
  job.nextChunkIndex += 1
  job.startedChunks += 1
  job.active += 1
  const selectedAtMs = Date.now()

  state.active += 1
  state.stats.startedChunks += 1
  state.stats.maxActive = Math.max(state.stats.maxActive, state.active)

  const waitMs = Math.max(0, selectedAtMs - job.registeredAtMs)
  job.queueWaitSamplesMs.push(waitMs)
  state.stats.queueWaitSamplesMs.push(waitMs)
  const activeStartedAtMs = Date.now()
  const publicContext = Object.freeze({
    ...(job.jobId ? { jobId: job.jobId } : {}),
    ...(job.label ? { label: job.label } : {}),
    ...(typeof job.inputIndex === 'number' ? { inputIndex: job.inputIndex } : {}),
    ...(typeof job.targetIndex === 'number' ? { targetIndex: job.targetIndex } : {}),
    ...(typeof job.turnIndex === 'number' ? { turnIndex: job.turnIndex } : {}),
    ...(typeof job.segmentIndex === 'number' ? { segmentIndex: job.segmentIndex } : {}),
    ...(typeof job.originalOrder === 'number' ? { originalOrder: job.originalOrder } : {})
  })
  const admission: HostedTtsChunkAdmissionToken = Object.freeze({
    lane: state.lane,
    workId: job.jobId ?? `${state.lane.laneKey}-${job.internalId}`,
    unitIndex: chunkIndex,
    chunkIndex,
    internalJobId: job.internalId,
    context: publicContext
  })
  return { admission, activeStartedAtMs }
}

export const buildHostedTtsCoreAdmission = (
  state: HostedTtsProviderChunkState,
  job: HostedTtsChunkJob,
  admission: HostedTtsChunkAdmissionToken
): HostedConcurrencyAdmission => ({
  provider: state.provider,
  accountLabel: state.lane.scopeLabel,
  lane: state.lane,
  workClass: 'tts-chunk',
  configuredLimit: state.maxLimit,
  workId: admission.workId,
  unitIndex: admission.chunkIndex,
  context: admission.context,
  abortSignal: job.abortSignal
})
