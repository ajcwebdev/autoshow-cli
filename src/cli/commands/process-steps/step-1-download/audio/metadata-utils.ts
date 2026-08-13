import * as l from '~/utils/app-logger/app-logger'
import { validateData, validateDataSafe } from '~/utils/validate/validation'
import { exec } from '~/utils/cli-utils'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'
import { YtDlpVideoInfoSchema, VideoMetadataSchema } from '~/types'
import { MEDIA_EXTENSIONS } from '~/cli/commands/process-steps/step-0-metadata/formats/metadata-media-extensions'
import { buildYtDlpFailureMessage, buildYtDlpMetadataArgs } from '~/cli/commands/process-steps/shared/shared-yt-dlp-options'
import { getYtDlpBinary } from '~/cli/commands/process-steps/shared/shared-yt-dlp-binary'
import type { Step1SourceRef, VideoMetadata, YtDlpVideoInfo } from '~/types'
import { fileFingerprintsMatch, getFileFingerprint, readJsonCacheMap, writeJsonCacheEntry, type FileFingerprint } from '~/utils/file-fingerprint-cache'

import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const VIDEO_INFO_CACHE_FILE = join(tmpdir(), 'autoshow-yt-video-info-cache.json')
const VIDEO_INFO_CACHE_LOCK = 'yt-video-info-cache'

const writeVideoInfoCache = async (url: string, data: YtDlpVideoInfo): Promise<void> => {
  try {
    await writeJsonCacheEntry({
      cachePath: VIDEO_INFO_CACHE_FILE,
      lockName: VIDEO_INFO_CACHE_LOCK,
      key: url,
      value: data
    })
  } catch {
  }
}

export const getVideoInfo = async (url: string): Promise<YtDlpVideoInfo | null> => {
  const cached = validateDataSafe(
    YtDlpVideoInfoSchema,
    (await readJsonCacheMap<YtDlpVideoInfo>(VIDEO_INFO_CACHE_FILE))[url]
  )
  if (cached) {
    return cached
  }

  try {
    const args = await buildYtDlpMetadataArgs(url)

    const result = await exec(getYtDlpBinary(), args)

    if (result.exitCode !== 0) {
      l.warn(buildYtDlpFailureMessage('metadata', result.stderr || result.stdout || 'unknown yt-dlp error'))
      return null
    }

    const parsed = JSON.parse(result.stdout)
    const validated = validateDataSafe(YtDlpVideoInfoSchema, parsed)

    const videoInfoData = validated ?? (parsed as YtDlpVideoInfo)
    if (validated) {
      await writeVideoInfoCache(url, validated)
    }

    return videoInfoData

  } catch (error) {
    l.error(`Failed to get video info`, error)
    return null
  }
}

const extractVideoMetadata = async (url: string): Promise<VideoMetadata> => {
  try {
    const videoInfo = await getVideoInfo(url)
    
    if (videoInfo) {
      return buildVideoMetadataFromInfo(url, videoInfo)
    }
    
    return getFallbackMetadata(url)
  } catch (error) {
    l.error(`Failed to extract video metadata`, error)
    return getFallbackMetadata(url)
  }
}

const formatUploadDate = (dateString: string): string => {
  if (!dateString || dateString.length !== 8) {
    return dateString
  }
  
  const year = dateString.substring(0, 4)
  const month = dateString.substring(4, 6)
  const day = dateString.substring(6, 8)
  
  return `${year}-${month}-${day}`
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const getFallbackMetadata = (url: string): VideoMetadata => {
  const videoId = url.match(/[?&]v=([^&]+)/)?.[1] || 'unknown'
  const fallback = {
    title: `video_${videoId}`,
    duration: 'Unknown',
    channel: 'Unknown',
    description: '',
    url,
    publishDate: undefined,
    thumbnail: undefined,
    channelURL: undefined
  }
  
  return validateData(VideoMetadataSchema, fallback, 'fallback video metadata')
}

export const buildVideoMetadataFromInfo = (
  url: string,
  videoInfo: YtDlpVideoInfo
): VideoMetadata => {
  const uploadDate = videoInfo.upload_date ? formatUploadDate(videoInfo.upload_date) : undefined

  const chapters = videoInfo.chapters?.flatMap(ch => {
    if (typeof ch.start_time !== 'number' || typeof ch.end_time !== 'number' || typeof ch.title !== 'string') return []
    return [{ startTime: ch.start_time, endTime: ch.end_time, title: ch.title }]
  })

  return validateData(VideoMetadataSchema, {
    title: videoInfo.title || 'Unknown Title',
    duration: videoInfo.duration ? formatDuration(videoInfo.duration) : 'Unknown',
    channel: videoInfo.uploader || videoInfo.channel || 'Unknown',
    description: videoInfo.description || '',
    url,
    publishDate: uploadDate,
    thumbnail: videoInfo.thumbnail,
    channelURL: videoInfo.channel_url,
    ...(chapters !== undefined && chapters.length > 0 ? { chapters } : {})
  }, 'video metadata')
}

export const sanitizeTitleSlug = (title: string, maxLength = 200): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, maxLength)

const stripFinalExtension = (value: string): string =>
  value.replace(/\.[^.]+$/, '')

const tryDecodeUrlSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export const getSourceBasenameWithoutExtension = (source: Step1SourceRef): string | undefined => {
  if (source.filePath) {
    const filename = source.filePath.split(/[\\/]/).pop()?.trim()
    if (!filename) return undefined
    const withoutExtension = stripFinalExtension(filename)
    return withoutExtension.length > 0 ? withoutExtension : filename
  }

  if (!source.url) {
    return undefined
  }

  try {
    const pathname = new URL(source.url).pathname
    const encodedFilename = pathname.split('/').filter(Boolean).pop()
    if (!encodedFilename || !encodedFilename.includes('.')) {
      return undefined
    }
    const filename = tryDecodeUrlSegment(encodedFilename).trim()
    if (!filename) return undefined
    const withoutExtension = stripFinalExtension(filename)
    return withoutExtension.length > 0 ? withoutExtension : undefined
  } catch {
    return undefined
  }
}

export const buildMediaStep1Slug = (
  source: Step1SourceRef,
  metadata: Pick<VideoMetadata, 'title' | 'publishDate'>
): string => {
  const rawBasename = getSourceBasenameWithoutExtension(source)
  if (rawBasename) {
    return rawBasename
  }

  const datePrefix = metadata.publishDate ? `${metadata.publishDate}-` : ''
  return `${datePrefix}${sanitizeTitleSlug(metadata.title, 180)}`
}

export const buildDocumentStep1Slug = (source: Step1SourceRef, title: string): string =>
  getSourceBasenameWithoutExtension(source) ?? sanitizeTitleSlug(title, 180)

export const createUniqueDirectoryName = (title: string): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0')
  const dateTimeId = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${milliseconds}`
  return `${dateTimeId}_${sanitizeTitleSlug(title)}`
}

const LOCAL_FILE_METADATA_CACHE_FILE = join(tmpdir(), 'autoshow-local-file-metadata-cache.json')
const LOCAL_FILE_METADATA_CACHE_LOCK = 'local-file-metadata-cache'

type LocalFileMetadataCacheEntry = {
  data: VideoMetadata
  fingerprint: FileFingerprint
}

const getCachedLocalFileMetadata = async (filePath: string): Promise<VideoMetadata | undefined> => {
  const cache = await readJsonCacheMap<LocalFileMetadataCacheEntry>(LOCAL_FILE_METADATA_CACHE_FILE)
  const entry = cache[resolve(filePath)]
  if (!entry || !entry.data || !entry.fingerprint) {
    return undefined
  }
  const validated = validateDataSafe(VideoMetadataSchema, entry.data)
  return validated && fileFingerprintsMatch(await getFileFingerprint(filePath), entry.fingerprint)
    ? validated
    : undefined
}

const writeLocalFileMetadataCache = async (
  filePath: string,
  data: VideoMetadata,
  fingerprint: FileFingerprint
): Promise<void> => {
  try {
    await writeJsonCacheEntry({
      cachePath: LOCAL_FILE_METADATA_CACHE_FILE,
      lockName: LOCAL_FILE_METADATA_CACHE_LOCK,
      key: resolve(filePath),
      value: { data, fingerprint }
    })
  } catch {
  }
}

export const extractLocalFileMetadata = async (filePath: string): Promise<VideoMetadata> => {
  const cached = await getCachedLocalFileMetadata(filePath)
  if (cached) {
    return cached
  }

  try {
    const fingerprintBeforeProbe = await getFileFingerprint(filePath)
    const ffprobe = await exec(getFfprobeBinary(), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ])
    if (ffprobe.exitCode !== 0) {
      throw InfraError('ffprobe failed', { stage: 'download:media' })
    }
    const seconds = parseFloat((ffprobe.stdout || '').trim() || '0')
    const duration = seconds > 0 ? formatDuration(seconds) : 'Unknown'
    const base = filePath.split('/').pop() || 'local-media'
    const title = base.replace(/\.[^/.]+$/, '')
    const metadata: VideoMetadata = {
      title,
      duration,
      channel: 'Local',
      description: '',
      url: `file://${filePath}`,
      publishDate: undefined,
      thumbnail: undefined,
      channelURL: undefined
    }
    const validated = validateData(VideoMetadataSchema, metadata, 'local file metadata')
    const fingerprintAfterProbe = await getFileFingerprint(filePath)
    if (fingerprintAfterProbe && fileFingerprintsMatch(fingerprintBeforeProbe, fingerprintAfterProbe)) {
      await writeLocalFileMetadataCache(filePath, validated, fingerprintAfterProbe)
    }
    return validated
  } catch {
    const base = filePath.split('/').pop() || 'local-media'
    const fallback = validateData(VideoMetadataSchema, {
      title: base.replace(/\.[^/.]+$/, ''),
      duration: 'Unknown',
      channel: 'Local',
      description: '',
      url: `file://${filePath}`,
      publishDate: undefined,
      thumbnail: undefined,
      channelURL: undefined
    }, 'local file metadata fallback')
    return fallback
  }
}

export const isDirectMediaUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return MEDIA_EXTENSIONS.some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

const extractDirectMediaUrlMetadata = (url: string): VideoMetadata => {
  const pathname = new URL(url).pathname
  const base = pathname.split('/').pop() || 'audio'
  const title = base.replace(/\.[^/.]+$/, '')
  return validateData(VideoMetadataSchema, {
    title,
    duration: 'Unknown',
    channel: 'Unknown',
    description: '',
    url,
    publishDate: undefined,
    thumbnail: undefined,
    channelURL: undefined
  }, 'direct media url metadata')
}

export const extractSourceMetadata = async (source: { url?: string, filePath?: string }): Promise<VideoMetadata> => {
  if (source.filePath) return await extractLocalFileMetadata(source.filePath)
  const url = source.url as string
  if (isDirectMediaUrl(url)) return extractDirectMediaUrlMetadata(url)
  return await extractVideoMetadata(url)
}
