import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ComicImagePurchaseUsage, PipelineProviderState } from '~/types'
import * as log from '~/utils/app-logger/app-logger'
import { UsageError } from '~/utils/error-handler'
import { atomicWriteJson } from '~/utils/filesystem'
import { pathIsPhysicallyWithinRoot } from '~/utils/runtime-containment'
import { isRecord } from '~/utils/value-helpers'

const metrics = ['costUsd', 'durationMs', 'imageInputUnits', 'textInputUnits', 'imageOutputUnits'] as const

const checkpointPath = (sceneRunDir: string, attemptId: string): string => {
  const path = join(sceneRunDir, 'metadata', 'image-usage', `${attemptId}.json`)
  if (!/^[\w-]+$/.test(attemptId) || !pathIsPhysicallyWithinRoot(sceneRunDir, path)) throw UsageError('Invalid comic image usage checkpoint path.')
  return path
}

/** One small atomic snapshot per invocation. Concurrent responses queue snapshots in receipt order. */
export const createComicImageUsageCheckpoint = (sceneRunDir: string, runId: string, model: string, attemptId: string) => {
  const path = checkpointPath(sceneRunDir, attemptId)
  const usage: ComicImagePurchaseUsage = { costUsd: 0, durationMs: 0, imageInputUnits: 0, textInputUnits: 0, imageOutputUnits: 0 }
  let imagesGenerated = 0
  let writing = Promise.resolve()
  let warned = false
  const warn = (error: unknown) => {
    if (warned) return
    warned = true
    log.write('warn', `Could not persist the comic image usage checkpoint for run ${runId}: ${error instanceof Error ? error.message : String(error)}`, { category: 'command' })
  }
  return {
    record: (purchase: ComicImagePurchaseUsage): Promise<void> => {
      for (const key of metrics) usage[key] += purchase[key]
      imagesGenerated += 1
      const snapshot = { runId, model, attemptId, imagesGenerated, usage: { ...usage } }
      // A later snapshot includes all earlier responses even if an earlier write failed.
      writing = writing.then(() => atomicWriteJson(path, snapshot)).catch(warn)
      return writing
    },
    clear: async () => { await rm(path, { force: true }).catch(warn) },
  }
}

export const readComicImageUsageCheckpoint = async (sceneRunDir: string, provider: PipelineProviderState, attemptId: string) => {
  const file = Bun.file(checkpointPath(sceneRunDir, attemptId))
  if (!await file.exists()) return undefined
  const snapshot: unknown = await file.json()
  if (!isRecord(snapshot) || snapshot['runId'] !== provider.metadata['runId'] || snapshot['model'] !== provider.model || snapshot['attemptId'] !== attemptId
      || typeof snapshot['imagesGenerated'] !== 'number' || !Number.isSafeInteger(snapshot['imagesGenerated']) || snapshot['imagesGenerated'] < 1
      || !isRecord(snapshot['usage'])) throw UsageError('Invalid comic image usage checkpoint for this attempt.')
  const usage = snapshot['usage']
  if (!metrics.every(key => typeof usage[key] === 'number' && Number.isFinite(usage[key]) && usage[key] >= 0)) throw UsageError('Invalid counters in comic image usage checkpoint.')
  return { imagesGenerated: snapshot['imagesGenerated'], usage }
}
