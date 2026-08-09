import { isAbsolute, resolve } from 'node:path'
import { CLIUsageError } from '~/utils/error-handler'
import { costFromRunCostSteps, ensureFile, getNumber, getString, loadMediaRunJson } from '../benchmark-utils'
import { resolveVisionProviders } from '../vision-benchmark-engine'
import type { JsonObject, VideoBenchmarkProvider, VideoFileReference, VideoRunEntry, VideoRunJson } from '~/types'

const parseVideoRunEntry = (
  rawEntry: JsonObject,
  rawRunJson: JsonObject,
  index: number
): VideoRunEntry => {
  const videoGenService = getString(rawEntry, 'videoGenService')
  const videoGenModel = getString(rawEntry, 'videoGenModel')
  const videoFileName = getString(rawEntry, 'videoFileName')
  if (!videoGenService || !videoGenModel || !videoFileName) {
    throw CLIUsageError(`Video benchmark metadata.video[${index}] must include videoGenService, videoGenModel, and videoFileName.`)
  }

  const processingTimeMs = getNumber(rawEntry, 'processingTime')
  const costCents = getNumber(rawEntry, 'providerCostCents') ?? costFromRunCostSteps(rawRunJson, videoGenService, videoGenModel)
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

export const loadVideoRunJson = async (runDir: string): Promise<VideoRunJson> => {
  const { input, entries, raw } = await loadMediaRunJson(runDir, 'video', 'Video', parseVideoRunEntry)
  return {
    kind: 'video',
    metadata: {
      input,
      video: entries
    },
    raw
  }
}

export const resolveVideoProviders = async (
  runDir: string,
  runJson: VideoRunJson
): Promise<VideoBenchmarkProvider[]> => await resolveVisionProviders<VideoRunEntry, VideoFileReference, VideoBenchmarkProvider>({
  entries: runJson.metadata.video,
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
