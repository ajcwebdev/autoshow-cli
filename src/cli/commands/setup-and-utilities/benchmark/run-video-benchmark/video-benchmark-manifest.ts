import { isAbsolute, resolve } from 'node:path'
import { CLIUsageError } from '~/utils/error-handler'
import { costFromManifestMetadata, ensureFile, getNumber, getString, loadMediaManifest } from '../benchmark-utils'
import { resolveVisionProviders } from '../vision-benchmark-engine'
import type { JsonObject, VideoBenchmarkManifestView, VideoBenchmarkProvider, VideoFileReference, VideoRunEntry } from '~/types'

const parseVideoRunEntry = (
  rawEntry: JsonObject,
  manifestMetadata: JsonObject,
  index: number
): VideoRunEntry => {
  const videoGenService = getString(rawEntry, 'videoGenService')
  const videoGenModel = getString(rawEntry, 'videoGenModel')
  const videoFileName = getString(rawEntry, 'videoFileName')
  if (!videoGenService || !videoGenModel || !videoFileName) {
    throw CLIUsageError(`Video benchmark metadata.video[${index}] must include videoGenService, videoGenModel, and videoFileName.`)
  }

  const processingTimeMs = getNumber(rawEntry, 'processingTime')
  const costCents = getNumber(rawEntry, 'providerCostCents') ?? costFromManifestMetadata(manifestMetadata, videoGenService, videoGenModel)
  const videoDuration = getNumber(rawEntry, 'videoDuration')

  return {
    videoGenService,
    videoGenModel,
    videoFileName,
    ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
    ...(costCents !== undefined ? { costCents } : {}),
    ...(videoDuration !== undefined ? { videoDuration } : {})
  }
}

export const loadVideoBenchmarkManifest = async (runDir: string): Promise<VideoBenchmarkManifestView> => {
  const { input, entries, raw } = await loadMediaManifest(runDir, 'video', 'Video', parseVideoRunEntry)
  return {
    input,
    entries,
    raw
  }
}

export const resolveVideoProviders = async (
  runDir: string,
  manifestView: VideoBenchmarkManifestView
): Promise<VideoBenchmarkProvider[]> => await resolveVisionProviders<VideoRunEntry, VideoFileReference, VideoBenchmarkProvider>({
  entries: manifestView.entries,
  identity: ({ videoGenService, videoGenModel }) => ({ service: videoGenService, model: videoGenModel }),
  stats: ({ processingTimeMs, costCents }) => ({
    ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
    ...(costCents !== undefined ? { costCents } : {})
  }),
  artifacts: async (entry) => {
    if (isAbsolute(entry.videoFileName)) throw CLIUsageError(`Video benchmark videoFileName must be relative to the run directory: ${entry.videoFileName}`)
    const path = resolve(runDir, entry.videoFileName)
    await ensureFile(path, `Video benchmark video file not found: ${path}`)
    return [{ fileName: entry.videoFileName, path, ...(entry.videoDuration !== undefined ? { metadataDurationSeconds: entry.videoDuration } : {}) }]
  },
  statsPolicy: 'average',
  assemble: (base, videos) => ({ ...base, videos })
})
