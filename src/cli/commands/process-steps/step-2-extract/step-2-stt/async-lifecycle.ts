import { isRecord } from '~/utils/rest-client'
import type { AsyncSttActiveJobContext, AsyncSttCompletedJobContext, AsyncSttLifecycleCleanupSnapshot, AsyncSttLifecycleCleanupState, AsyncSttLifecycleContext, AsyncSttLifecycleHooks, AsyncSttLifecycleMetrics, AsyncSttLifecycleOptions, AsyncSttPolledJobContext, AsyncSttPollLoopOptions, AsyncSttUploadAssetResult, RetryClass, Step2Metadata, Step2RuntimeMetadata, TranscriptionResult } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError, InternalError, ProviderError } from '~/utils/error-handler'
import { logSttAsyncJobLifecycle, logSttCleanupFailure, logSttSegmentLifecycle } from './stt-logging'
import { buildStep2TimingMetadata } from './stt-timing-metadata'


const DEFAULT_POLL_DEADLINE_MS = 10 * 60 * 1000
const MAX_POLL_DEADLINE_MS = 30 * 60 * 1000
const POLL_DEADLINE_AUDIO_MULTIPLIER_MS = 250
const ASYNC_STT_RESUME_PROBE_DELAYS_MS = [0, 30_000, 60_000, 120_000, 240_000] as const

const getAsyncSttProgressKey = (segmentNumber: number | undefined): string =>
  segmentNumber === undefined
    ? 'whole'
    : `segment-${String(segmentNumber).padStart(3, '0')}`


const parseCleanupState = (value: unknown): Step2RuntimeMetadata['cleanup'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const cleanup: NonNullable<Step2RuntimeMetadata['cleanup']> = {}
  if (typeof value['remoteJobDeleted'] === 'boolean') {
    cleanup.remoteJobDeleted = value['remoteJobDeleted']
  }
  if (typeof value['remoteAssetDeleted'] === 'boolean') {
    cleanup.remoteAssetDeleted = value['remoteAssetDeleted']
  }

  return Object.keys(cleanup).length > 0 ? cleanup : undefined
}

export const parseStep2RuntimeMetadata = (
  value: unknown
): Step2RuntimeMetadata | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  if (
    (value['mode'] !== 'fresh' && value['mode'] !== 'resumed')
    || (value['stage'] !== 'created'
      && value['stage'] !== 'polling'
      && value['stage'] !== 'completed'
      && value['stage'] !== 'cleanup-pending'
      && value['stage'] !== 'cleanup-complete')
    || typeof value['remoteJobId'] !== 'string'
  ) {
    return undefined
  }

  return {
    mode: value['mode'],
    stage: value['stage'],
    remoteJobId: value['remoteJobId'],
    ...(typeof value['remoteAssetId'] === 'string' ? { remoteAssetId: value['remoteAssetId'] } : {}),
    ...(typeof value['remoteAssetUrl'] === 'string' ? { remoteAssetUrl: value['remoteAssetUrl'] } : {}),
    ...(typeof value['createCompletedAt'] === 'string' ? { createCompletedAt: value['createCompletedAt'] } : {}),
    ...(typeof value['lastPollAt'] === 'string' ? { lastPollAt: value['lastPollAt'] } : {}),
    ...(typeof value['completedAt'] === 'string' ? { completedAt: value['completedAt'] } : {}),
    ...(typeof value['cleanupCompletedAt'] === 'string' ? { cleanupCompletedAt: value['cleanupCompletedAt'] } : {}),
    ...(parseCleanupState(value['cleanup']) ? { cleanup: parseCleanupState(value['cleanup']) } : {})
  }
}

export const readPersistedAsyncSttProgressMetadata = async (
  lifecycle: AsyncSttLifecycleHooks | undefined,
  expected: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>,
  segmentNumber?: number | undefined
): Promise<Record<string, unknown> | undefined> => {
  const progress = await lifecycle?.readProgressMetadata?.(getAsyncSttProgressKey(segmentNumber))
  if (
    progress
    && progress['transcriptionService'] === expected.transcriptionService
    && progress['transcriptionModel'] === expected.transcriptionModel
  ) {
    return progress
  }
  return undefined
}

export const readPersistedAsyncSttRuntime = async (
  lifecycle: AsyncSttLifecycleHooks | undefined,
  expected: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>,
  segmentNumber?: number | undefined
): Promise<Step2RuntimeMetadata | undefined> =>
  parseStep2RuntimeMetadata((await readPersistedAsyncSttProgressMetadata(
    lifecycle,
    expected,
    segmentNumber
  ))?.['runtime'])

export const createAsyncSttProgressMetadataPersister = (
  lifecycle: AsyncSttLifecycleHooks | undefined,
  segmentNumber: number | undefined,
  buildProgressMetadata: (runtime: Step2RuntimeMetadata) => Step2Metadata,
  setRuntime: (runtime: Step2RuntimeMetadata) => void
): (runtime: Step2RuntimeMetadata) => Promise<void> =>
  async (runtime) => {
    setRuntime(runtime)
    await lifecycle?.writeProgressMetadata?.(
      getAsyncSttProgressKey(segmentNumber),
      buildProgressMetadata(runtime)
    )
  }

export const createAsyncSttJobReadyNotifier = (
  onJobReady: ((runtime: Step2RuntimeMetadata) => Promise<void> | void) | undefined
): (runtime: Step2RuntimeMetadata) => Promise<void> => {
  let notified = false

  return async (runtime) => {
    if (notified) {
      return
    }
    notified = true
    await onJobReady?.(runtime)
  }
}

const resolveAsyncSttPollDeadlineMs = (
  audioDurationSeconds: number | undefined
): number => {
  const durationScaled = typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds) && audioDurationSeconds > 0
    ? Math.round(audioDurationSeconds * POLL_DEADLINE_AUDIO_MULTIPLIER_MS)
    : 0

  return Math.min(
    MAX_POLL_DEADLINE_MS,
    Math.max(DEFAULT_POLL_DEADLINE_MS, durationScaled)
  )
}

export const pollAsyncSttJobUntilComplete = async <TStatus>(
  options: AsyncSttPollLoopOptions<TStatus>
): Promise<{ status: TStatus, pollCount: number, pollSleepMs: number }> => {
  const pollOnce = async (): Promise<{ status: TStatus, retryAfterMs: number | null }> => {
    const runPoll = async (): Promise<{ status: TStatus, retryAfterMs: number | null }> =>
      await options.poll()
    const pollResult = options.withPollSlot
      ? await options.withPollSlot(runPoll)
      : await runPoll()
    await options.onProgress?.(pollResult.status)

    const failureReason = options.isFailed(pollResult.status)
    if (failureReason) {
      throw InfraError(failureReason, { stage: 'stt:async' })
    }

    return pollResult
  }

  if (options.pollMode === 'resume-probe') {
    let pollCount = 0
    let pollSleepMs = 0

    for (const delayMs of ASYNC_STT_RESUME_PROBE_DELAYS_MS) {
      if (delayMs > 0) {
        const sleepStartedAt = Date.now()
        await Bun.sleep(delayMs)
        pollSleepMs += Date.now() - sleepStartedAt
      }

      const pollResult = await pollOnce()
      pollCount += 1

      if (options.isComplete(pollResult.status)) {
        return {
          status: pollResult.status,
          pollCount,
          pollSleepMs
        }
      }
    }

    const totalWaitMs = ASYNC_STT_RESUME_PROBE_DELAYS_MS.reduce<number>((sum, delayMs) => sum + delayMs, 0)
    if (options.buildResumeProbeError) {
      options.buildResumeProbeError(options.jobId, ASYNC_STT_RESUME_PROBE_DELAYS_MS.length, totalWaitMs)
    }
    options.buildDeadlineError(options.jobId, totalWaitMs)
  }

  const pollDeadlineMs = resolveAsyncSttPollDeadlineMs(options.audioDurationSeconds)
  const deadlineAt = Date.now() + pollDeadlineMs
  let pollDelayMs = options.initialPollIntervalMs
  let pollCount = 0
  let pollSleepMs = 0

  while (true) {
    const remainingBeforeSleep = deadlineAt - Date.now()
    if (remainingBeforeSleep <= 0) {
      options.buildDeadlineError(options.jobId, pollDeadlineMs)
    }

    const sleepStartedAt = Date.now()
    await Bun.sleep(Math.min(pollDelayMs, remainingBeforeSleep))
    pollSleepMs += Date.now() - sleepStartedAt

    const pollResult = await pollOnce()
    pollCount += 1

    if (options.isComplete(pollResult.status)) {
      return {
        status: pollResult.status,
        pollCount,
        pollSleepMs
      }
    }

    pollDelayMs = pollResult.retryAfterMs !== null
      ? Math.min(options.maxPollIntervalMs, Math.max(options.initialPollIntervalMs, pollResult.retryAfterMs))
      : Math.min(options.maxPollIntervalMs, pollDelayMs * 2)
  }
}

const createAsyncSttLifecycleMetrics = (
  runMode: 'initial' | 'backfill' | undefined
): AsyncSttLifecycleMetrics => ({
  uploadMs: 0,
  createMs: 0,
  pollMs: 0,
  pollSleepMs: 0,
  transcriptMs: 0,
  createCount: 0,
  pollCount: 0,
  requestCount: 0,
  retryCount: 0,
  rateLimitCount: 0,
  backfillCount: runMode === 'backfill' ? 1 : 0
})

export const getAsyncSttErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

export const attachAsyncSttErrorContext = <TError extends Error & { stage?: string, retryClass?: RetryClass }>(
  error: unknown,
  stage: string,
  retryClass: RetryClass
): never => {
  if (error instanceof Error && error.cause instanceof Error) {
    ;(error.cause as unknown as TError).stage = stage
    ;(error.cause as unknown as TError).retryClass = retryClass
    throw error.cause
  }

  const source = error instanceof Error ? error : ProviderError(String(error))
  ;(source as unknown as TError).stage = stage
  ;(source as unknown as TError).retryClass = retryClass
  throw source
}

export const attachAsyncSttValidationContext = <TError extends Error & { stage?: string, retryClass?: RetryClass, rawResponse?: unknown }>(
  error: unknown,
  stage: string,
  retryClass: RetryClass,
  rawResponse: unknown
): never => {
  const source = error instanceof Error ? error : ProviderError(String(error))
  ;(source as unknown as TError).stage = stage
  ;(source as unknown as TError).retryClass = retryClass
  ;(source as unknown as TError).rawResponse = rawResponse
  throw source
}

export const buildAsyncSttPollingDeadlineError = (
  provider: string,
  jobId: string,
  pollDeadlineMs: number
): never => {
  throw ProviderError(
    `${provider} timed out waiting for transcription completion for ${jobId} (deadline exceeded after ${pollDeadlineMs}ms)`,
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' satisfies RetryClass,
      retryable: true
    }
  )
}

export const buildAsyncSttResumeProbeError = (
  provider: string,
  jobNoun: string,
  jobId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  throw ProviderError(
    `${provider} ${jobNoun} ${jobId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`,
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' satisfies RetryClass,
      retryable: true
    }
  )
}

export const deleteSttRemoteResource = async (options: {
  url: string
  apiKey: string
  provider: string
  artifact: string
  id: string
}): Promise<boolean> => {
  try {
    const response = await fetch(options.url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${options.apiKey}`
      }
    })

    if (!response.ok && response.status !== 404) {
      logSttCleanupFailure(l, {
        provider: options.provider,
        artifact: options.artifact,
        id: options.id,
        detail: String(response.status)
      })
      return false
    }

    return true
  } catch (error) {
    logSttCleanupFailure(l, {
      provider: options.provider,
      artifact: options.artifact,
      id: options.id,
      detail: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

const createAsyncSttLifecycleCleanupState = <TStatus, TUpload>(): AsyncSttLifecycleCleanupState<TStatus, TUpload> => {
  const state: AsyncSttLifecycleCleanupSnapshot<TStatus, TUpload> = {}

  return {
    snapshot: () => state,
    setRuntime: (runtime) => { state.runtime = runtime },
    setJob: (jobId, status) => {
      state.jobId = jobId
      state.lastKnownStatus = status
    },
    setLastKnownStatus: (status) => { state.lastKnownStatus = status },
    setUploadedAsset: (uploadedAsset) => { state.uploadedAsset = uploadedAsset },
    setMetadata: (metadata) => { state.metadata = metadata }
  }
}

const buildAsyncSttRuntime = <TUpload>(
  mode: Step2RuntimeMetadata['mode'],
  stage: Step2RuntimeMetadata['stage'],
  jobId: string,
  runtime: Step2RuntimeMetadata | undefined,
  uploadedAsset: AsyncSttUploadAssetResult<TUpload> | undefined,
  timestamps: Pick<Step2RuntimeMetadata, 'createCompletedAt' | 'lastPollAt' | 'completedAt'>
): Step2RuntimeMetadata => ({
  ...(runtime ?? { mode, stage, remoteJobId: jobId }),
  mode,
  stage,
  remoteJobId: jobId,
  ...((runtime?.remoteAssetId ?? uploadedAsset?.remoteAssetId) ? { remoteAssetId: runtime?.remoteAssetId ?? uploadedAsset?.remoteAssetId } : {}),
  ...((runtime?.remoteAssetUrl ?? uploadedAsset?.remoteAssetUrl) ? { remoteAssetUrl: runtime?.remoteAssetUrl ?? uploadedAsset?.remoteAssetUrl } : {}),
  ...(timestamps.createCompletedAt ? { createCompletedAt: timestamps.createCompletedAt } : {}),
  ...(timestamps.lastPollAt ? { lastPollAt: timestamps.lastPollAt } : {}),
  ...(timestamps.completedAt ? { completedAt: timestamps.completedAt } : {})
})

const createAsyncSttLifecycleContext = <TStatus, TTranscript, TUpload>(
  options: AsyncSttLifecycleOptions<TStatus, TTranscript, TUpload>
): AsyncSttLifecycleContext<TStatus, TTranscript, TUpload> => {
  const metrics = createAsyncSttLifecycleMetrics(options.runMode)
  const cleanupState = createAsyncSttLifecycleCleanupState<TStatus, TUpload>()
  const buildTimingMetadata = (remoteProcessingMs = 0): Step2Metadata['timings'] =>
    buildStep2TimingMetadata({
      uploadMs: metrics.uploadMs,
      createMs: metrics.createMs,
      createCount: metrics.createCount,
      pollMs: metrics.pollMs,
      pollSleepMs: metrics.pollSleepMs,
      pollCount: metrics.pollCount,
      transcriptMs: metrics.transcriptMs,
      remoteProcessingMs,
      requestCount: metrics.requestCount,
      retryCount: metrics.retryCount,
      rateLimitCount: metrics.rateLimitCount,
      backfillCount: metrics.backfillCount
    })
  const buildProgressMetadata = (runtime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: options.providerService,
    transcriptionModel: options.modelName,
    processingTime: Date.now() - options.startTime,
    tokenCount: 0,
    ...options.extendProgressMetadata?.(runtime),
    timings: buildTimingMetadata() ?? {},
    runtime
  })

  return {
    options,
    metrics,
    cleanupState,
    persistProgressMetadata: createAsyncSttProgressMetadataPersister(
      options.lifecycle,
      options.segment?.segmentNumber,
      buildProgressMetadata,
      cleanupState.setRuntime
    ),
    notifyJobReady: createAsyncSttJobReadyNotifier(options.lifecycle?.onJobReady),
    buildTimingMetadata
  }
}

const createFreshAsyncSttJob = async <TStatus, TTranscript, TUpload>(
  context: AsyncSttLifecycleContext<TStatus, TTranscript, TUpload>
): Promise<AsyncSttActiveJobContext<TStatus, TTranscript, TUpload>> => {
  const { cleanupState, metrics, notifyJobReady, options, persistProgressMetadata } = context
  let uploadedAsset: AsyncSttUploadAssetResult<TUpload> | undefined

  if (options.uploadAsset) {
    const uploadStartedAt = Date.now()
    uploadedAsset = await options.uploadAsset(metrics)
    metrics.uploadMs += Date.now() - uploadStartedAt
    cleanupState.setUploadedAsset(uploadedAsset)
  }

  const createStartedAt = Date.now()
  const createResponse = await options.createJob(metrics, uploadedAsset)
  metrics.createMs += Date.now() - createStartedAt
  metrics.createCount += 1
  cleanupState.setJob(createResponse.jobId, createResponse.status)

  const runtime = buildAsyncSttRuntime(
    'fresh',
    'polling',
    createResponse.jobId,
    undefined,
    uploadedAsset,
    { createCompletedAt: new Date().toISOString() }
  )
  await persistProgressMetadata(runtime)
  await notifyJobReady(runtime)

  return {
    ...context,
    activeJob: {
      jobId: createResponse.jobId,
      resumedExistingJob: false,
      ...(createResponse.status === undefined ? {} : { initialStatus: createResponse.status })
    },
    runtime,
    ...(uploadedAsset ? { uploadedAsset } : {})
  }
}

const resumeAsyncSttJob = async <TStatus, TTranscript, TUpload>(
  context: AsyncSttLifecycleContext<TStatus, TTranscript, TUpload>,
  persistedRuntime: Step2RuntimeMetadata
): Promise<AsyncSttActiveJobContext<TStatus, TTranscript, TUpload>> => {
  const runtime: Step2RuntimeMetadata = {
    ...persistedRuntime,
    mode: 'resumed',
    stage: 'polling'
  }
  context.cleanupState.setJob(runtime.remoteJobId, undefined)
  await context.persistProgressMetadata(runtime)
  await context.notifyJobReady(runtime)

  return {
    ...context,
    activeJob: {
      jobId: runtime.remoteJobId,
      resumedExistingJob: true
    },
    runtime
  }
}

export const resumeOrCreateAsyncSttJob = async <TStatus, TTranscript, TUpload>(
  context: AsyncSttLifecycleContext<TStatus, TTranscript, TUpload>
): Promise<AsyncSttActiveJobContext<TStatus, TTranscript, TUpload>> => {
  const { options } = context
  const persistedRuntime = await readPersistedAsyncSttRuntime(options.lifecycle, {
    transcriptionService: options.providerService,
    transcriptionModel: options.modelName
  }, options.segment?.segmentNumber)
  const segmentNumber = options.segment?.segmentNumber
  const totalSegments = options.segment?.totalSegments
  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, {
      provider: options.providerLogLabel,
      action: 'started',
      segmentNumber,
      totalSegments,
      model: options.modelName
    })
  }
  const activeContext = persistedRuntime && (persistedRuntime.stage === 'created' || persistedRuntime.stage === 'polling')
    ? await resumeAsyncSttJob(context, persistedRuntime)
    : await createFreshAsyncSttJob(context)
  const { activeJob } = activeContext

  if (!activeJob.jobId) {
    const jobNoun = options.jobNoun ?? 'job'
    throw InternalError(`${options.providerDisplayName} ${jobNoun} creation did not produce a ${jobNoun} id`, {
      stage: options.guardStage ?? 'stt:async'
    })
  }

  logSttAsyncJobLifecycle(l, {
    provider: `${options.providerLogLabel}/${options.modelName}`,
    action: activeJob.resumedExistingJob ? 'resumed' : 'created',
    remoteId: activeJob.jobId,
    state: 'polling'
  })
  return activeContext
}

export const pollAndPersistAsyncSttJob = async <TStatus, TTranscript, TUpload>(
  context: AsyncSttActiveJobContext<TStatus, TTranscript, TUpload>
): Promise<AsyncSttPolledJobContext<TStatus, TTranscript, TUpload>> => {
  const { activeJob, cleanupState, metrics, options, persistProgressMetadata, uploadedAsset } = context
  let runtime = context.runtime
  const pollResult = await pollAsyncSttJobUntilComplete({
    jobId: activeJob.jobId,
    initialPollIntervalMs: options.initialPollIntervalMs,
    maxPollIntervalMs: options.maxPollIntervalMs,
    audioDurationSeconds: options.audioDurationSeconds,
    pollMode: activeJob.resumedExistingJob ? 'resume-probe' : 'fresh',
    buildDeadlineError: options.buildDeadlineError,
    buildResumeProbeError: options.buildResumeProbeError,
    poll: async () => {
      const pollStartedAt = Date.now()
      const result = await options.pollJob(activeJob.jobId, metrics)
      metrics.pollMs += Date.now() - pollStartedAt
      return result
    },
    isComplete: options.isComplete,
    isFailed: options.isFailed,
    onProgress: async (status) => {
      cleanupState.setLastKnownStatus(status)
      runtime = buildAsyncSttRuntime(
        runtime.mode,
        'polling',
        activeJob.jobId,
        runtime,
        uploadedAsset,
        {
          createCompletedAt: runtime.createCompletedAt,
          lastPollAt: new Date().toISOString()
        }
      )
      await persistProgressMetadata(runtime)
    },
    withPollSlot: options.lifecycle?.withPollSlot
  })
  metrics.pollSleepMs += pollResult.pollSleepMs
  metrics.pollCount += pollResult.pollCount

  return {
    ...context,
    runtime,
    finalStatus: pollResult.status,
    completedRuntime: buildAsyncSttRuntime(
      runtime.mode,
      'completed',
      activeJob.jobId,
      runtime,
      uploadedAsset,
      {
        createCompletedAt: runtime.createCompletedAt,
        lastPollAt: runtime.lastPollAt,
        completedAt: new Date().toISOString()
      }
    )
  }
}

export const constructAsyncSttResult = async <TStatus, TTranscript, TUpload>(
  context: AsyncSttPolledJobContext<TStatus, TTranscript, TUpload>
): Promise<AsyncSttCompletedJobContext<TStatus, TTranscript, TUpload>> => {
  const { activeJob, completedRuntime, metrics, options } = context
  const transcriptStartedAt = Date.now()
  const transcript = await options.getTranscript(activeJob.jobId, metrics, context.finalStatus)
  metrics.transcriptMs += Date.now() - transcriptStartedAt

  if (options.persistCompletedProgress) {
    await context.persistProgressMetadata(completedRuntime)
  }

  const processingTime = Date.now() - options.startTime
  const remoteProcessingMs = Math.max(0, processingTime - metrics.uploadMs - metrics.createMs - metrics.pollMs - metrics.transcriptMs)
  const built = await options.buildResult({
    transcript,
    runtime: completedRuntime,
    processingTime,
    timings: context.buildTimingMetadata(remoteProcessingMs)
  })
  context.cleanupState.setMetadata(built.metadata)

  const segmentNumber = options.segment?.segmentNumber
  const totalSegments = options.segment?.totalSegments
  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, {
      provider: options.providerLogLabel,
      action: 'completed',
      segmentNumber,
      totalSegments,
      model: options.modelName,
      processingTimeMs: processingTime
    })
  }

  return { ...context, built }
}

const buildAsyncSttCleanupRuntime = <TStatus, TUpload>(
  snapshot: Readonly<AsyncSttLifecycleCleanupSnapshot<TStatus, TUpload>>,
  shouldDeleteRemoteResources: boolean,
  remoteJobDeleted: boolean | undefined,
  remoteAssetDeleted: boolean | undefined
): Step2RuntimeMetadata | undefined => {
  const { jobId, runtime } = snapshot
  if (!runtime || !jobId) {
    return undefined
  }
  const assetId = runtime.remoteAssetId ?? snapshot.uploadedAsset?.remoteAssetId

  return {
    ...runtime,
    stage: shouldDeleteRemoteResources ? 'cleanup-complete' : runtime.stage,
    remoteJobId: jobId,
    ...(shouldDeleteRemoteResources ? { cleanupCompletedAt: new Date().toISOString() } : {}),
    cleanup: {
      ...(runtime.cleanup ?? {}),
      ...(shouldDeleteRemoteResources && remoteJobDeleted !== undefined ? { remoteJobDeleted } : {}),
      ...(shouldDeleteRemoteResources && assetId && remoteAssetDeleted !== undefined ? { remoteAssetDeleted } : {})
    }
  }
}

const applyAsyncSttCleanupMetadata = <TStatus, TUpload>(
  snapshot: Readonly<AsyncSttLifecycleCleanupSnapshot<TStatus, TUpload>>,
  cleanupMs: number,
  remoteJobDeleted: boolean | undefined,
  remoteAssetDeleted: boolean | undefined
): void => {
  const { jobId, metadata, runtime, uploadedAsset } = snapshot
  if (!metadata) {
    return
  }
  const assetId = runtime?.remoteAssetId ?? uploadedAsset?.remoteAssetId
  const processingTime = metadata.processingTime
  metadata.timings = {
    ...(metadata.timings ?? {}),
    ...(cleanupMs > 0 ? { cleanupMs } : {}),
    remoteProcessingMs: Math.max(0, processingTime
      - ((metadata.timings?.createMs ?? 0)
      + (metadata.timings?.uploadMs ?? 0)
      + (metadata.timings?.pollMs ?? 0)
      + (metadata.timings?.transcriptMs ?? 0)
      + cleanupMs))
  }
  metadata.runtime = {
    ...(metadata.runtime ?? {
      mode: runtime?.mode ?? 'fresh',
      stage: 'cleanup-complete',
      remoteJobId: jobId ?? ''
    }),
    mode: metadata.runtime?.mode ?? runtime?.mode ?? 'fresh',
    stage: 'cleanup-complete',
    remoteJobId: metadata.runtime?.remoteJobId ?? jobId ?? '',
    ...((metadata.runtime?.remoteAssetId ?? assetId) ? { remoteAssetId: metadata.runtime?.remoteAssetId ?? assetId } : {}),
    ...((metadata.runtime?.remoteAssetUrl ?? runtime?.remoteAssetUrl ?? uploadedAsset?.remoteAssetUrl) ? { remoteAssetUrl: metadata.runtime?.remoteAssetUrl ?? runtime?.remoteAssetUrl ?? uploadedAsset?.remoteAssetUrl } : {}),
    ...(metadata.runtime?.createCompletedAt ? { createCompletedAt: metadata.runtime.createCompletedAt } : {}),
    ...(metadata.runtime?.lastPollAt ? { lastPollAt: metadata.runtime.lastPollAt } : {}),
    ...(metadata.runtime?.completedAt ? { completedAt: metadata.runtime.completedAt } : {}),
    cleanupCompletedAt: new Date().toISOString(),
    cleanup: {
      ...(metadata.runtime?.cleanup ?? {}),
      ...(remoteJobDeleted !== undefined ? { remoteJobDeleted } : {}),
      ...(assetId && remoteAssetDeleted !== undefined ? { remoteAssetDeleted } : {})
    }
  }
}

export const finalizeAsyncSttCleanup = async <TStatus, TTranscript, TUpload>(
  context: AsyncSttLifecycleContext<TStatus, TTranscript, TUpload>
): Promise<void> => {
  const { cleanup } = context.options
  if (!cleanup) {
    return
  }

  const cleanupStartedAt = Date.now()
  const snapshot = context.cleanupState.snapshot()
  const { jobId, metadata, runtime, uploadedAsset } = snapshot
  const shouldDeleteRemoteResources = jobId !== undefined && cleanup.shouldDelete({
    metadata,
    lastKnownStatus: snapshot.lastKnownStatus,
    runtime
  })
  const assetId = runtime?.remoteAssetId ?? uploadedAsset?.remoteAssetId
  let remoteJobDeleted: boolean | undefined
  let remoteAssetDeleted: boolean | undefined
  if (shouldDeleteRemoteResources && jobId && cleanup.deleteJob) {
    remoteJobDeleted = await cleanup.deleteJob(jobId)
  }
  if (shouldDeleteRemoteResources && assetId && cleanup.deleteAsset) {
    remoteAssetDeleted = await cleanup.deleteAsset(assetId)
  }
  const cleanupMs = Date.now() - cleanupStartedAt

  if (metadata && shouldDeleteRemoteResources) {
    applyAsyncSttCleanupMetadata(snapshot, cleanupMs, remoteJobDeleted, remoteAssetDeleted)
    return
  }

  if (!metadata) {
    const cleanupRuntime = buildAsyncSttCleanupRuntime(
      snapshot,
      shouldDeleteRemoteResources,
      remoteJobDeleted,
      remoteAssetDeleted
    )
    if (cleanupRuntime) {
      await context.persistProgressMetadata(cleanupRuntime)
    }
  }
}

export const runAsyncSttJobLifecycle = async <TStatus, TTranscript, TUpload = unknown>(
  options: AsyncSttLifecycleOptions<TStatus, TTranscript, TUpload>
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const context = createAsyncSttLifecycleContext(options)

  try {
    const activeJob = await resumeOrCreateAsyncSttJob(context)
    const polledJob = await pollAndPersistAsyncSttJob(activeJob)
    return (await constructAsyncSttResult(polledJob)).built
  } finally {
    await finalizeAsyncSttCleanup(context)
  }
}
