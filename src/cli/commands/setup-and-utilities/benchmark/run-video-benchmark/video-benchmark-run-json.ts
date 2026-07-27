import { isAbsolute, join, resolve } from 'node:path'
import { CLIUsageError, InternalError } from '~/utils/error-handler'
import { costFromRunCostSteps, ensureDirectory, ensureFile, getArray, getNumber, getObject, getString, isRecord, optionalAverage, providerGroup, providerKey } from '../benchmark-utils'
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
  await ensureDirectory(runDir, 'Video run directory')

  const runJsonPath = join(runDir, 'run.json')
  await ensureFile(runJsonPath, `Video run directory is missing run.json: ${runJsonPath}`)

  let rawJson: unknown
  try {
    rawJson = JSON.parse(await Bun.file(runJsonPath).text()) as unknown
  } catch (error) {
    throw CLIUsageError(`Video benchmark run.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!isRecord(rawJson)) {
    throw CLIUsageError('Video benchmark run.json must be a JSON object.')
  }

  const kind = getString(rawJson, 'kind')
  if (kind !== 'video') {
    throw CLIUsageError(`run.json kind is "${kind ?? 'unknown'}", expected "video"`)
  }

  const metadata = getObject(rawJson, 'metadata')
  if (!metadata) {
    throw CLIUsageError('Video benchmark run.json is missing metadata.')
  }

  const input = getString(metadata, 'input')
  if (!input) {
    throw CLIUsageError('Video benchmark source prompt is missing. This run.json must contain metadata.input.')
  }

  const videoEntries = getArray(metadata, 'video')
  if (videoEntries.length === 0) {
    throw CLIUsageError('Video benchmark run.json must contain metadata.video[].')
  }

  const video = videoEntries.map((entry, index) => {
    if (!isRecord(entry)) {
      throw CLIUsageError(`Video benchmark metadata.video[${index}] must be an object.`)
    }
    return parseVideoRunEntry(entry, rawJson, index)
  })

  return {
    kind: 'video',
    metadata: {
      input,
      video
    },
    raw: rawJson
  }
}

export const resolveVideoProviders = async (
  runDir: string,
  runJson: VideoRunJson
): Promise<VideoBenchmarkProvider[]> => {
  const groups = new Map<string, Array<{
    entry: VideoRunEntry
    video: VideoFileReference
  }>>()

  for (const entry of runJson.metadata.video) {
    if (isAbsolute(entry.videoFileName)) {
      throw CLIUsageError(`Video benchmark videoFileName must be relative to the run directory: ${entry.videoFileName}`)
    }

    const videoPath = resolve(runDir, entry.videoFileName)
    await ensureFile(videoPath, `Video benchmark video file not found: ${videoPath}`)

    const key = providerKey(entry.videoGenService, entry.videoGenModel)
    const group = groups.get(key) ?? []
    group.push({
      entry,
      video: {
        fileName: entry.videoFileName,
        path: videoPath,
        ...(entry.videoDuration !== undefined ? { metadataDurationSeconds: entry.videoDuration } : {})
      }
    })
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, entries]) => {
      const first = entries[0]
      if (!first) {
        throw InternalError(`Internal error: empty video provider group ${key}`, { stage: 'benchmark:video' })
      }

      const processingTimeMs = optionalAverage(entries
        .map(({ entry }) => entry.processingTimeMs)
        .filter((value): value is number => value !== undefined))
      const costCents = optionalAverage(entries
        .map(({ entry }) => entry.costCents)
        .filter((value): value is number => value !== undefined))

      return {
        providerKey: key,
        provider: first.entry.videoGenService,
        model: first.entry.videoGenModel,
        group: providerGroup(first.entry.videoGenService),
        ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
        ...(costCents !== undefined ? { costCents } : {}),
        videos: entries.map(({ video }) => video)
      }
    })
    .sort((left, right) => left.providerKey.localeCompare(right.providerKey))
}
