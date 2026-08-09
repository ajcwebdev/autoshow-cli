import { existsSync } from 'node:fs'
import type { AudioProbeResult, GeminiInlineMedia, GeminiVideoImageMedia, GrokUrlMedia, VideoMediaKind } from '~/types'
import { exec } from '~/utils/cli-utils'
import type { MediaKindSpec } from '~/utils/media-reference-engine'
import { createMediaReferenceEngine } from '~/utils/media-reference-engine'
import { getFfprobeBinary, hasRuntimeTool } from '~/utils/runtime-paths'

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.wave': 'audio/wav'
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'] as const
const VIDEO_MIME_TYPES = ['video/mp4'] as const
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'] as const
const VIDEO_MEDIA_DATA_URL_PATTERN = /^data:(image\/(?:jpeg|jpg|png|bmp|webp)|video\/mp4|audio\/(?:mpeg|mp3|wav|x-wav|wave));base64,/i
const MIME_ALIASES = { 'image/jpg': 'image/jpeg' } as const

const videoMediaSpec = (
  kind: VideoMediaKind,
  allowedMimeTypes: readonly string[],
  accept: string,
  prettyMimeList: string,
  defaultFileName: string
): MediaKindSpec => ({
  allowedMimeTypes,
  mimeByExtension: MIME_BY_EXTENSION,
  mimeAliases: MIME_ALIASES,
  dataUrlPattern: VIDEO_MEDIA_DATA_URL_PATTERN,
  enforceAllowedDataMime: true,
  unknownLocalMime: { mode: 'throw' },
  fetchedContentType: { mode: 'allowed' },
  accept,
  defaultFileName: () => defaultFileName,
  prettyMimeList,
  errors: {
    download: (status, url) => `Video media input download failed (${status}): ${url}`,
    unsupportedLocal: value => `Unsupported local media input "${value}". Expected ${prettyMimeList} content for ${kind} input.`,
    unsupportedUrl: url => `Unsupported media URL "${url}". Expected ${prettyMimeList} content for ${kind} input.`,
    unsupportedDataUrl: () => `Unsupported media data URL. Expected ${prettyMimeList} content for ${kind} input.`
  },
  downloadError: { stage: 'video:media-inputs', includeStatus: false }
})

const VIDEO_MEDIA_KIND_SPECS = {
  image: videoMediaSpec('image', IMAGE_MIME_TYPES, 'image/*,*/*;q=0.8', 'JPEG, PNG, BMP, or WebP', 'image.png'),
  video: videoMediaSpec('video', VIDEO_MIME_TYPES, 'video/mp4,*/*;q=0.8', 'MP4', 'video.mp4'),
  audio: videoMediaSpec('audio', AUDIO_MIME_TYPES, 'audio/mpeg,audio/wav,*/*;q=0.8', 'MP3 or WAV', 'audio.mp3')
} satisfies Record<VideoMediaKind, MediaKindSpec>

const VIDEO_MEDIA_REFERENCE_ENGINES = {
  image: createMediaReferenceEngine(VIDEO_MEDIA_KIND_SPECS.image),
  video: createMediaReferenceEngine(VIDEO_MEDIA_KIND_SPECS.video),
  audio: createMediaReferenceEngine(VIDEO_MEDIA_KIND_SPECS.audio)
}

const mediaEngine = (kind: VideoMediaKind): typeof VIDEO_MEDIA_REFERENCE_ENGINES[VideoMediaKind] =>
  VIDEO_MEDIA_REFERENCE_ENGINES[kind]

const prettyMimeList = (kind: VideoMediaKind): string => VIDEO_MEDIA_KIND_SPECS[kind].prettyMimeList

const parseDurationSeconds = (value: string): number | undefined => {
  const durationSeconds = Number.parseFloat(value.trim())
  return Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : undefined
}

export const isSupportedVideoImageDataUrl = (value: string): boolean => {
  const mimeType = mediaEngine('image').parseDataUrl(value)?.mimeType
  return mimeType !== undefined && IMAGE_MIME_TYPES.includes(mimeType as typeof IMAGE_MIME_TYPES[number])
}

export const isSupportedVideoImageUrl = (value: string): boolean =>
  mediaEngine('image').isHttpUrl(value) && IMAGE_MIME_TYPES.includes(mediaEngine('image').getUrlMimeType(value) as typeof IMAGE_MIME_TYPES[number])

export const isSupportedVideoImagePathLike = (value: string): boolean =>
  IMAGE_MIME_TYPES.includes(mediaEngine('image').getLocalMimeType(value) as typeof IMAGE_MIME_TYPES[number])

export const isFirstClassVideoImageInput = (value: string): boolean =>
  isSupportedVideoImageDataUrl(value) || isSupportedVideoImageUrl(value) || isSupportedVideoImagePathLike(value)

export const validateVideoMediaReferences = (
  inputs: readonly string[] | undefined,
  options: {
    flagName: string
    provider: string
    model: string
    kind: VideoMediaKind
    maxInputs?: number | undefined
  }
): void => {
  const expected = prettyMimeList(options.kind)
  mediaEngine(options.kind).validateReferences(inputs, {
    maxInputs: options.maxInputs,
    maxInputsError: maxInputs => `${options.flagName} supports at most ${maxInputs} ${options.kind === 'image' ? 'images' : 'videos'} for ${options.provider}/${options.model}.`,
    missingFileError: value => `${options.flagName} file "${value}" does not exist for ${options.provider}/${options.model}.`,
    unsupportedMimeError: value => `Unsupported ${options.flagName} value "${value}" for ${options.provider}/${options.model}. Expected ${expected} ${options.kind} files, URLs, or data URLs.`
  })
}

export const videoMediaReferenceToGeminiInlineData = async (
  value: string,
  kind: VideoMediaKind
): Promise<GeminiInlineMedia> => {
  const { bytes, mimeType } = await mediaEngine(kind).resolveBytes(value)
  return {
    inlineData: {
      mimeType,
      data: Buffer.from(bytes).toString('base64')
    }
  }
}

export const videoMediaReferenceToGeminiVideoImage = async (
  value: string,
  kind: VideoMediaKind
): Promise<GeminiVideoImageMedia> => {
  const { bytes, mimeType } = await mediaEngine(kind).resolveBytes(value)
  return {
    mimeType,
    bytesBase64Encoded: Buffer.from(bytes).toString('base64')
  }
}

export const videoMediaReferenceToGrokUrlObject = async (
  value: string,
  kind: VideoMediaKind
): Promise<GrokUrlMedia> => ({ url: await videoMediaReferenceToUrlOrDataUrl(value, kind) })

export const tryResolveLocalVideoDurationSeconds = async (value: string): Promise<number | undefined> => {
  const engine = mediaEngine('video')
  if (engine.isHttpUrl(value) || engine.isDataUrl(value) || !existsSync(value) || !hasRuntimeTool('ffprobe')) {
    return undefined
  }
  const result = await exec(getFfprobeBinary(), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    value
  ])
  return result.exitCode === 0 ? parseDurationSeconds(result.stdout) : undefined
}

export const tryResolveLocalAudioProbe = async (value: string): Promise<AudioProbeResult | undefined> => {
  const engine = mediaEngine('audio')
  if (engine.isHttpUrl(value) || engine.isDataUrl(value) || !existsSync(value)) {
    return undefined
  }
  const mimeType = engine.getLocalMimeType(value)
  if (!mimeType || !AUDIO_MIME_TYPES.includes(mimeType as typeof AUDIO_MIME_TYPES[number])) {
    return undefined
  }
  const sizeBytes = Bun.file(value).size
  if (!hasRuntimeTool('ffprobe')) {
    return { sizeBytes }
  }
  const result = await exec(getFfprobeBinary(), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    value
  ])
  return {
    sizeBytes,
    ...(result.exitCode === 0 ? { durationSeconds: parseDurationSeconds(result.stdout) } : {})
  }
}

export const videoMediaReferenceToUrlOrBase64 = async (
  value: string,
  kind: VideoMediaKind
): Promise<string> => await mediaEngine(kind).referenceToUrlOrBase64(value)

export const videoMediaReferenceToUrlOrDataUrl = async (
  value: string,
  kind: VideoMediaKind
): Promise<string> => await mediaEngine(kind).referenceToUrlOrDataUrl(value)
