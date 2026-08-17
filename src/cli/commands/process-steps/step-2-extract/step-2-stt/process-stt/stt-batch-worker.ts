import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProviderFailure, SttBatchBlockedProviderReason, SttBatchWorkerContext, SttTarget } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { sttTarget } from '../run-stt'
import { getSttProviderArtifactDir, toRecordedProviderError } from '../stt-batch/stt-run-state'
import { createSttProviderProgressLifecycle, markSttProviderRunning } from '../stt-provider-progress'
import { classifySttProviderFailure, extractProviderRawResponse, resolveTransientProviderCooldownMs, shouldBlockSttProviderForBatch, writeProviderFailureArtifacts, writeSkippedProviderArtifact } from '../stt-provider-failures'
import { getSttTargetDirectoryName, getSttTargetKey } from '../stt-targets'
import { writeSttResultArtifact } from '../stt-utils/stt-result-artifacts'
import { withMergedStep2Timings } from './recorded-step2'

/**
 * Mutable state shared across every provider target run in a multi-provider STT batch.
 * The worker functions read and mutate `successes`, `failuresByIndex`, and
 * `providerStateMap` in place, and queue a prompt refresh after each success.
 */

export const markSttTargetSkipped = async (
  ctx: SttBatchWorkerContext,
  index: number,
  reason: Pick<SttBatchBlockedProviderReason, 'service' | 'model' | 'message' | 'retryable' | 'stage' | 'status' | 'degraded'>,
  options: {
    rawResponse?: unknown
    attempts?: number | undefined
  } = {}
): Promise<void> => {
  const target = ctx.requestedTargets[index] as SttTarget
  const providerDir = join(ctx.providersDir, getSttTargetDirectoryName(target))
  const relativeDir = getSttProviderArtifactDir(target)
  const targetKey = getSttTargetKey(target)
  await mkdir(providerDir, { recursive: true })
  const skippedArtifacts = await writeSkippedProviderArtifact(providerDir, reason, options.rawResponse)
  ctx.providerStateMap.set(targetKey, {
    service: target.service,
    model: target.model,
    local: target.local,
    artifactDir: relativeDir,
    status: 'skipped',
    attempts: options.attempts ?? ctx.providerStateMap.get(targetKey)?.attempts ?? 0,
    ...(ctx.providerStateMap.get(targetKey)?.metadata ? { metadata: ctx.providerStateMap.get(targetKey)?.metadata } : {}),
    lastError: toRecordedProviderError({
      message: reason.message,
      skipped: true,
      ...(reason.stage ? { stage: reason.stage } : {}),
      ...(typeof reason.status === 'number' ? { status: reason.status } : {}),
      errorFile: `${relativeDir}/${skippedArtifacts.errorFile}`,
      ...(skippedArtifacts.rawResponseFile ? { rawResponseFile: `${relativeDir}/${skippedArtifacts.rawResponseFile}` } : {})
    } as Omit<ProviderFailure, 'index' | 'service' | 'model'>)
  })
  ctx.failuresByIndex.delete(index)
}

export const runSttProviderTargetAtIndex = async (
  ctx: SttBatchWorkerContext,
  index: number,
  attempt: 'initial' | 'recovery' = 'initial',
  queueWaitMs = 0
): Promise<void> => {
  const { requestedTargets, providersDir, providerStateMap, successes, failuresByIndex, options, prepared, runOptions, batchCoordinator, mistralPassController } = ctx
  const target = requestedTargets[index] as SttTarget
  const providerDirName = getSttTargetDirectoryName(target)
  const providerDir = join(providersDir, providerDirName)
  const relativeDir = getSttProviderArtifactDir(target)
  const targetKey = getSttTargetKey(target)
  const previousState = providerStateMap.get(targetKey)
  const nextAttemptCount = (previousState?.attempts ?? 0) + 1

  providerStateMap.set(targetKey, {
    service: target.service,
    model: target.model,
    local: target.local,
    artifactDir: relativeDir,
    status: 'missing',
    attempts: nextAttemptCount,
    ...(previousState?.metadata ? { metadata: previousState.metadata } : {})
  })

  try {
    if (attempt === 'recovery') {
      await rm(providerDir, { recursive: true, force: true })
    }
    await mkdir(providerDir, { recursive: true })
    await markSttProviderRunning({
      rootDir: ctx.outputDir,
      artifactDir: providerDir,
      target
    }, nextAttemptCount)

    const audioPath = prepared.executionArtifacts.sourceMediaPath
    if (runOptions.outputDir) {
      batchCoordinator?.noteBackfill(target)
    }
    let asyncJobReady = false
    const manifestLifecycle = createSttProviderProgressLifecycle({
      rootDir: ctx.outputDir,
      artifactDir: providerDir,
      target
    }, (metadata) => {
      const current = providerStateMap.get(targetKey)
      if (current) {
        providerStateMap.set(targetKey, { ...current, metadata })
      }
    })
    const transcription = await runWithLogContext({ step: 'step-2-stt', provider: providerDirName }, async () =>
      await sttTarget(audioPath, providerDir, target, {
        split: options.split,
        sttSegmentConcurrency: options.sttSegmentConcurrency,
        sttProviderConcurrency: options.sttProviderConcurrency,
        hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
        audioDurationSeconds: prepared.durationSeconds,
        sourceUrl: prepared.step1Metadata.url,
        language: target.service === 'scrapecreators' ? options.scrapecreatorsLang : options.supadataLang,
        happyscribeOrganizationId: options.happyscribeOrganizationId,
        runMode: runOptions.outputDir ? 'backfill' : 'initial',
        ...(mistralPassController ? { mistralPassController } : {}),
        asyncLifecycle: {
          ...manifestLifecycle,
          ...(batchCoordinator
            ? {
              onJobReady: async () => {
                if (asyncJobReady) {
                  return
                }
                asyncJobReady = true
                batchCoordinator.releaseProviderSlot(target, { warmupSuccess: true })
              },
              withPollSlot: async <T,>(fn: () => Promise<T>): Promise<T> =>
                await batchCoordinator.withPollSlot(target, fn)
            }
            : {})
        }
      })
    )
    const metadataWithQueueTiming = withMergedStep2Timings(
      transcription.metadata,
      queueWaitMs > 0 ? { queueWaitMs } : undefined
    )
    await writeSttResultArtifact(providerDir, transcription.result)
    successes[index] = {
      target,
      metadata: metadataWithQueueTiming,
      result: transcription.result,
      relativeDir
    }
    ctx.queuePromptRefresh()
    batchCoordinator?.reportProviderSuccess(target)
    providerStateMap.set(targetKey, {
      service: target.service,
      model: target.model,
      local: target.local,
      artifactDir: relativeDir,
      status: 'succeeded',
      attempts: nextAttemptCount,
      ...(providerStateMap.get(targetKey)?.metadata ? { metadata: providerStateMap.get(targetKey)?.metadata } : {})
    })
    failuresByIndex.delete(index)
  } catch (error) {
    const failure: ProviderFailure = {
      index,
      service: target.service,
      model: target.model,
      ...classifySttProviderFailure(error)
    }
    const rawResponse = extractProviderRawResponse(error)

    if (failure.skipped === true) {
      batchCoordinator?.reportProviderFailure(target, failure)
      await markSttTargetSkipped(ctx, index, {
        service: target.service,
        model: target.model,
        message: failure.message,
        retryable: failure.retryable,
        ...(failure.stage ? { stage: failure.stage } : {}),
        ...(typeof failure.status === 'number' ? { status: failure.status } : {})
      }, {
        rawResponse,
        attempts: nextAttemptCount
      })
      return
    }

    try {
      Object.assign(failure, await writeProviderFailureArtifacts(providerDir, failure, rawResponse, error))
    } catch (artifactError) {
      l.warn(`Failed to write STT provider diagnostics for ${target.service}/${target.model}: ${artifactError instanceof Error ? artifactError.message : String(artifactError)}`)
    }

    const batchBlockedFailure = shouldBlockSttProviderForBatch(failure)
      ? {
          service: target.service,
          model: target.model,
          local: target.local,
          message: failure.message,
          retryable: failure.retryable,
          ...(failure.stage ? { stage: failure.stage } : {}),
          ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
          degraded: false
        } satisfies SttBatchBlockedProviderReason
      : undefined
    batchCoordinator?.reportProviderFailure(target, failure, {
      blockedReason: batchBlockedFailure,
      cooldownMs: resolveTransientProviderCooldownMs(failure)
    })

    providerStateMap.set(targetKey, {
      service: target.service,
      model: target.model,
      local: target.local,
      artifactDir: relativeDir,
      status: 'failed',
      attempts: nextAttemptCount,
      ...(providerStateMap.get(targetKey)?.metadata ? { metadata: providerStateMap.get(targetKey)?.metadata } : {}),
      lastError: toRecordedProviderError({
        message: failure.message,
        ...(failure.stage ? { stage: failure.stage } : {}),
        ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
        ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
        ...(failure.errorFile ? { errorFile: `${relativeDir}/${failure.errorFile}` } : {}),
        ...(failure.rawResponseFile ? { rawResponseFile: `${relativeDir}/${failure.rawResponseFile}` } : {})
      })
    })
    failuresByIndex.set(index, failure)
  }
}
