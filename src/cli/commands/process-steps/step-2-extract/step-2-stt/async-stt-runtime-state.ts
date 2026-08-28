import { isRecord } from '~/utils/rest-client'
import type { AsyncSttLifecycleCleanupSnapshot, AsyncSttLifecycleCleanupState, AsyncSttLifecycleContext, AsyncSttLifecycleHooks, AsyncSttLifecycleMetrics, AsyncSttLifecycleOptions, AsyncSttUploadAssetResult, Step2Metadata, Step2RuntimeMetadata } from '~/types'
import { buildStep2TimingMetadata } from './stt-timing-metadata'

export const getAsyncSttProgressKey = (segmentNumber: number | undefined): string =>
  segmentNumber === undefined
    ? 'whole'
    : `segment-${String(segmentNumber).padStart(3, '0')}`

export const parseCleanupState = (value: unknown): Step2RuntimeMetadata['cleanup'] | undefined => {
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

export const createAsyncSttLifecycleMetrics = (
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

export const createAsyncSttLifecycleCleanupState = <TStatus, TUpload>(): AsyncSttLifecycleCleanupState<TStatus, TUpload> => {
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

export const buildAsyncSttRuntime = <TUpload>(
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

export const createAsyncSttLifecycleContext = <TStatus, TTranscript, TUpload>(
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
