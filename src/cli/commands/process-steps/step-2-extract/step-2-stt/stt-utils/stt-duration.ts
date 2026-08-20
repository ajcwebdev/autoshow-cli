import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadAudio } from '~/cli/commands/process-steps/step-1-download/audio/dl-audio'
import { extractSourceMetadata, getVideoInfo } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { getAudioDuration } from './audio-splitter'
import { fileExists } from '~/utils/cli-utils'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { MEDIA_EXTENSIONS } from '~/cli/commands/process-steps/step-0-metadata/formats/metadata-media-extensions'
import { DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { prepareSttMedia } from '../media'
import type { SttTarget } from '~/types'

const isLikelyUrl = (input: string): boolean => {
  try {
    const parsed = new URL(input)
    return !!parsed.protocol && !!parsed.host
  } catch {
    return false
  }
}

const hasKnownExtension = (pathOrUrl: string, extensions: readonly string[]): boolean => {
  const lower = pathOrUrl.toLowerCase()
  return extensions.some(ext => lower.endsWith(ext))
}

const isDirectMediaUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return hasKnownExtension(pathname, MEDIA_EXTENSIONS)
  } catch {
    return false
  }
}

const isDocumentLikePath = (path: string): boolean => {
  const lower = path.toLowerCase()
  return hasKnownExtension(lower, [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS])
}

const isDocumentUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return isDocumentLikePath(pathname)
  } catch {
    return false
  }
}

const normalizeDurationSeconds = (value: number): number | null => {
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

const tryProbeDurationSeconds = async (mediaPathOrUrl: string): Promise<number | null> => {
  try {
    const durationSeconds = await getAudioDuration(mediaPathOrUrl)
    return normalizeDurationSeconds(durationSeconds)
  } catch {
    return null
  }
}

const resolveByTemporaryDownload = async (
  source: { url?: string, filePath?: string },
  logLabel: string
): Promise<number> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-price-'))
  try {
    l.write('info', `Resolving media duration for STT pricing via temporary ${logLabel} download`, { category: 'pricing', metadata: { source: logLabel } })
    const metadata = await extractSourceMetadata(source)
    const { audioPath } = await downloadAudio({
      ...(source.url ? { url: source.url } : {}),
      ...(source.filePath ? { filePath: source.filePath } : {}),
      outputDir: tempDir
    }, metadata)

    const durationSeconds = await tryProbeDurationSeconds(audioPath)
    if (durationSeconds === null) {
      throw InfraError('Could not resolve media duration after temporary download', { stage: 'stt:duration' })
    }
    return durationSeconds
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export const resolveSttInputDurationSeconds = async (
  input: string,
  targets?: SttTarget[] | undefined
): Promise<number> => {
  if (!isLikelyUrl(input)) {
    const exists = await fileExists(input)
    if (!exists) {
      throw CLIUsageError(`Input does not exist: ${input}. Run: bun autoshow help extract`)
    }
    if (isDocumentLikePath(input)) {
      throw CLIUsageError(`--price requires media input (audio/video). Got document/image input: ${input}`)
    }

    const localDuration = await tryProbeDurationSeconds(input)
    if (localDuration !== null) {
      return localDuration
    }

    if (targets && targets.length > 0) {
      const prepared = await prepareSttMedia({
        source: { filePath: input },
        targets
      })
      try {
        if (prepared.durationSeconds > 0) {
          return prepared.durationSeconds
        }
      } finally {
        await prepared.cleanup?.()
      }
    }

    return await resolveByTemporaryDownload({ filePath: input }, 'local-media')
  }

  if (isDocumentUrl(input)) {
    throw CLIUsageError(`--price requires media input (audio/video). Got document/image URL: ${input}`)
  }

  if (!isDirectMediaUrl(input)) {
    const videoInfo = await getVideoInfo(input)
    const ytdlpDuration = normalizeDurationSeconds(videoInfo?.duration ?? Number.NaN)
    if (ytdlpDuration !== null) {
      return ytdlpDuration
    }
  }

  const probedDuration = await tryProbeDurationSeconds(input)
  if (probedDuration !== null) {
    return probedDuration
  }

  if (targets && targets.length > 0) {
    const prepared = await prepareSttMedia({
      source: { url: input },
      targets
    })
    try {
      if (prepared.durationSeconds > 0) {
        return prepared.durationSeconds
      }
    } finally {
      await prepared.cleanup?.()
    }
  }

  return await resolveByTemporaryDownload({ url: input }, 'remote-media')
}
