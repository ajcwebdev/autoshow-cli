import type { AsyncSttLifecycleCleanupSnapshot, AsyncSttLifecycleContext, Step2RuntimeMetadata } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { logSttCleanupFailure } from './stt-logging'

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

export const buildAsyncSttCleanupRuntime = <TStatus, TUpload>(
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

export const applyAsyncSttCleanupMetadata = <TStatus, TUpload>(
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
