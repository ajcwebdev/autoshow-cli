import type { AsyncSttActiveJobContext, AsyncSttCompletedJobContext, AsyncSttCreationOutcome, AsyncSttLifecycleContext, AsyncSttPolledJobContext, AsyncSttUploadAssetResult, Step2Metadata, Step2RuntimeMetadata, TranscriptionResult } from '~/types'
import { InternalError } from '~/utils/error-handler'
import { logSttAsyncJobLifecycle, logSttSegmentLifecycle } from './stt-logging'
import { pollAsyncSttJobUntilComplete } from './async-stt-polling'
import { buildAsyncSttRuntime, readPersistedAsyncSttRuntime } from './async-stt-runtime-state'

export const createFreshAsyncSttJob = async <TStatus, TTranscript, TUpload>(
  context: AsyncSttLifecycleContext<TStatus, TTranscript, TUpload>
): Promise<AsyncSttCreationOutcome<TStatus, TTranscript, TUpload>> => {
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

  if (createResponse.kind === 'completed') {
    return { kind: 'completed', transcript: createResponse.transcript }
  }

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
    kind: 'job',
    context: {
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
}

export const resumeAsyncSttJob = async <TStatus, TTranscript, TUpload>(
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
): Promise<AsyncSttCreationOutcome<TStatus, TTranscript, TUpload>> => {
  const { options } = context
  const persistedRuntime = await readPersistedAsyncSttRuntime(options.lifecycle, {
    transcriptionService: options.providerService,
    transcriptionModel: options.modelName
  }, options.segment?.segmentNumber)
  const segmentNumber = options.segment?.segmentNumber
  const totalSegments = options.segment?.totalSegments
  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle( {
      provider: options.providerLogLabel,
      action: 'started',
      segmentNumber,
      totalSegments,
      model: options.modelName
    })
  }
  const outcome = persistedRuntime && (persistedRuntime.stage === 'created' || persistedRuntime.stage === 'polling')
    ? { kind: 'job' as const, context: await resumeAsyncSttJob(context, persistedRuntime) }
    : await createFreshAsyncSttJob(context)
  if (outcome.kind === 'completed') {
    return outcome
  }
  const activeContext = outcome.context
  const { activeJob } = activeContext

  if (!activeJob.jobId) {
    const jobNoun = options.jobNoun ?? 'job'
    throw InternalError(`${options.providerDisplayName} ${jobNoun} creation did not produce a ${jobNoun} id`, {
      stage: options.guardStage ?? 'stt:async'
    })
  }

  logSttAsyncJobLifecycle( {
    provider: `${options.providerLogLabel}/${options.modelName}`,
    action: activeJob.resumedExistingJob ? 'resumed' : 'created',
    remoteId: activeJob.jobId,
    state: 'polling'
  })
  return { kind: 'job', context: activeContext }
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

export const finalizeAsyncSttBuiltResult = async <TStatus, TTranscript, TUpload>(
  context: AsyncSttLifecycleContext<TStatus, TTranscript, TUpload>,
  transcript: TTranscript,
  runtime: Step2RuntimeMetadata | undefined
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { metrics, options } = context
  const processingTime = Date.now() - options.startTime
  const remoteProcessingMs = Math.max(0, processingTime - metrics.uploadMs - metrics.createMs - metrics.pollMs - metrics.transcriptMs)
  const built = await options.buildResult({
    transcript,
    runtime,
    processingTime,
    timings: context.buildTimingMetadata(remoteProcessingMs)
  })
  context.cleanupState.setMetadata(built.metadata)

  const segmentNumber = options.segment?.segmentNumber
  const totalSegments = options.segment?.totalSegments
  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle( {
      provider: options.providerLogLabel,
      action: 'completed',
      segmentNumber,
      totalSegments,
      model: options.modelName,
      processingTimeMs: processingTime
    })
  }

  return built
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

  return { ...context, built: await finalizeAsyncSttBuiltResult(context, transcript, completedRuntime) }
}
