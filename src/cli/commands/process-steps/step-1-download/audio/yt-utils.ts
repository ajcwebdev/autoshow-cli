import { rm } from 'node:fs/promises'
import { extname, join } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { exec } from '~/utils/cli-utils'
import { MEDIA_EXTENSIONS } from '~/cli/commands/process-steps/step-0-metadata/formats/metadata-media-extensions'
import { buildYtDlpDownloadArgs, buildYtDlpFailureMessage } from '~/cli/commands/process-steps/shared/shared-yt-dlp-options'
import { logAudioDownload } from './audio-logging'
import { walkPaths } from '~/utils/filesystem'
import { getYtDlpBinary } from '~/cli/commands/process-steps/shared/shared-yt-dlp-binary'
import { InfraError } from '~/utils/error-handler'

const DOWNLOADED_MEDIA_EXTENSIONS: ReadonlySet<string> = new Set(MEDIA_EXTENSIONS)

const getMediaFilePaths = (text: string): string[] =>
  text
    .trim()
    .split('\n')
    .map(filePath => filePath.trim())
    .filter(f => f.length > 0)
    .filter((filePath) => DOWNLOADED_MEDIA_EXTENSIONS.has(extname(filePath).toLowerCase()))

const assertSingleDownloadedMedia = (
  list: string[],
  source: 'yt-dlp output tracking' | 'output directory scan',
  strictSingleOutput: boolean
): string | undefined => {
  const first = list[0]
  if (!first) {
    return undefined
  }
  if (strictSingleOutput && list.length > 1) {
    throw InfraError(`${source} found multiple media files after yt-dlp passthrough. Use raw mode for multi-output yt-dlp workflows.`, { stage: 'download:audio' })
  }
  return first
}

const buildNoPrimaryMediaError = (
  source: 'yt-dlp output tracking' | 'output directory scan'
): Error =>
  InfraError(`${source} found no primary media file after yt-dlp passthrough. Use raw mode for yt-dlp workflows that do not produce exactly one media file.`, { stage: 'download:audio' })

const findTrackedDownloadedAudio = async (
  downloadedPathLogFile: string,
  strictSingleOutput: boolean
): Promise<string | undefined> => {
  const logFile = Bun.file(downloadedPathLogFile)
  if (!await logFile.exists()) {
    return undefined
  }

  const trackedFiles = getMediaFilePaths(await logFile.text())
  const trackedPath = assertSingleDownloadedMedia(trackedFiles, 'yt-dlp output tracking', strictSingleOutput)
  if (!trackedPath) {
    return undefined
  }

  if (await Bun.file(trackedPath).exists()) {
    return trackedPath
  }
  return undefined
}

const findDownloadedAudio = async (
  outputDir: string,
  options: { strictSingleOutput?: boolean } = {}
): Promise<string> => {
  const list = getMediaFilePaths((await walkPaths(outputDir, { kind: 'file' })).join('\n'))
  const first = assertSingleDownloadedMedia(list, 'output directory scan', options.strictSingleOutput === true)
  if (!first) {
    if (options.strictSingleOutput === true) {
      throw buildNoPrimaryMediaError('output directory scan')
    }
    l.error(`No files found in ${outputDir}`, { category: 'artifact', metadata: { outputDir } })
    throw InfraError('No downloaded files found', { stage: 'download:audio' })
  }
  return first
}

export const downloadVideo = async (
  url: string,
  outputDir: string,
  options: { bestQuality?: boolean, ytDlpPassthroughArgs?: string[] | undefined } = {}
): Promise<string> => {
  const strictSingleOutput = (options.ytDlpPassthroughArgs?.length ?? 0) > 0
  const downloadedPathLogFile = join(outputDir, `.autoshow-yt-dlp-files-${crypto.randomUUID()}.txt`)
  try {
    const args = await buildYtDlpDownloadArgs(url, outputDir, {
      ...options,
      downloadedPathLogFile
    })
    logAudioDownload(l, {
      source: 'yt-dlp',
      status: 'started',
      target: outputDir
    })
    const result = await exec(getYtDlpBinary(), args, {
      retry: { operationName: 'yt-dlp download' }
    })

    if (result.exitCode !== 0) {
      const details = result.stderr || result.stdout || 'unknown yt-dlp error'
      const message = buildYtDlpFailureMessage('download', details)
      l.error(message, { category: 'pipeline' })
      throw InfraError(message, { stage: 'download:audio' })
    }

    const downloadedPath = await findTrackedDownloadedAudio(downloadedPathLogFile, strictSingleOutput)
      ?? await findDownloadedAudio(outputDir, { strictSingleOutput })
    logAudioDownload(l, {
      source: 'yt-dlp',
      status: 'downloaded',
      target: downloadedPath
    })
    return downloadedPath
  } catch (error) {
    throw error instanceof Error
      ? error
      : InfraError(String(error), { stage: 'download:audio' })
  } finally {
    await rm(downloadedPathLogFile, { force: true })
  }
}
