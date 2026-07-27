import { existsSync } from 'node:fs'
import { basename, extname } from 'node:path'
import type { AudioProbeResult, GeminiInlineMedia, GeminiVideoImageMedia, GrokUrlMedia, VideoMediaKind } from '~/types'
import { exec } from '~/utils/cli-utils'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { getFfprobeBinary, hasRuntimeTool } from '~/utils/runtime-paths'

const MIME_BY_EXTENSION: Record<string, string> = {
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

const normalizeMimeType = (value: string | undefined): string | undefined => {
  const mimeType = value?.split(';')[0]?.trim().toLowerCase()
  if (!mimeType) return undefined
  return mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
}

const allowedMimeTypes = (kind: VideoMediaKind): readonly string[] =>
  kind === 'image' ? IMAGE_MIME_TYPES : kind === 'video' ? VIDEO_MIME_TYPES : AUDIO_MIME_TYPES

const prettyMimeList = (kind: VideoMediaKind): string =>
  kind === 'image' ? 'JPEG, PNG, BMP, or WebP' : kind === 'video' ? 'MP4' : 'MP3 or WAV'

const isHttpMediaUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const isVideoMediaDataUrl = (value: string): boolean =>
  /^data:(image\/(?:jpeg|jpg|png|bmp|webp)|video\/mp4|audio\/(?:mpeg|mp3|wav|x-wav|wave));base64,/i.test(value)

const getLocalMimeType = (value: string): string | undefined =>
  MIME_BY_EXTENSION[extname(value).toLowerCase()]

const getUrlMimeType = (value: string): string | undefined => {
  try {
    return MIME_BY_EXTENSION[extname(new URL(value).pathname).toLowerCase()]
  } catch {
    return undefined
  }
}

const parseDataUrl = (value: string): { mimeType: string, base64: string } | undefined => {
  const match = /^data:([^;,]+);base64,(.*)$/is.exec(value)
  if (!match) return undefined
  const mimeType = normalizeMimeType(match[1])
  const base64 = match[2]
  if (!mimeType || base64 === undefined) return undefined
  return { mimeType, base64 }
}

const parseDurationSeconds = (value: string): number | undefined => {
  const durationSeconds = Number.parseFloat(value.trim())
  return Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : undefined
}

const getReferenceMimeType = (value: string): string | undefined => {
  if (isVideoMediaDataUrl(value)) return parseDataUrl(value)?.mimeType
  if (isHttpMediaUrl(value)) return getUrlMimeType(value)
  return getLocalMimeType(value)
}

export const isSupportedVideoImageDataUrl = (value: string): boolean => {
  const mimeType = parseDataUrl(value)?.mimeType
  return mimeType !== undefined && IMAGE_MIME_TYPES.includes(mimeType as typeof IMAGE_MIME_TYPES[number])
}

export const isSupportedVideoImageUrl = (value: string): boolean =>
  isHttpMediaUrl(value) && IMAGE_MIME_TYPES.includes(getUrlMimeType(value) as typeof IMAGE_MIME_TYPES[number])

export const isSupportedVideoImagePathLike = (value: string): boolean =>
  IMAGE_MIME_TYPES.includes(getLocalMimeType(value) as typeof IMAGE_MIME_TYPES[number])

export const isFirstClassVideoImageInput = (value: string): boolean =>
  isSupportedVideoImageDataUrl(value) || isSupportedVideoImageUrl(value) || isSupportedVideoImagePathLike(value)

const assertSupportedMimeType = (
  flagName: string,
  value: string,
  provider: string,
  model: string,
  kind: VideoMediaKind,
  mimeType: string | undefined
): void => {
  if (mimeType === undefined || !allowedMimeTypes(kind).includes(mimeType)) {
    throw CLIUsageError(
      `Unsupported ${flagName} value "${value}" for ${provider}/${model}. Expected ${prettyMimeList(kind)} ${kind} files, URLs, or data URLs.`
    )
  }
}

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
  const values = inputs ?? []
  if (options.maxInputs !== undefined && values.length > options.maxInputs) {
    throw CLIUsageError(`${options.flagName} supports at most ${options.maxInputs} ${options.kind === 'image' ? 'images' : 'videos'} for ${options.provider}/${options.model}.`)
  }

  for (const value of values) {
    if (isHttpMediaUrl(value)) {
      const mimeType = getReferenceMimeType(value)
      if (mimeType !== undefined) {
        assertSupportedMimeType(options.flagName, value, options.provider, options.model, options.kind, mimeType)
      }
      continue
    }

    if (isVideoMediaDataUrl(value)) {
      assertSupportedMimeType(options.flagName, value, options.provider, options.model, options.kind, getReferenceMimeType(value))
      continue
    }

    if (!existsSync(value)) {
      throw CLIUsageError(`${options.flagName} file "${value}" does not exist for ${options.provider}/${options.model}.`)
    }
    assertSupportedMimeType(options.flagName, value, options.provider, options.model, options.kind, getLocalMimeType(value))
  }
}

const fetchMediaBytes = async (
  url: string,
  kind: VideoMediaKind
): Promise<{ bytes: Uint8Array, mimeType: string, fileName: string }> => {
  const accept = kind === 'image'
    ? 'image/*,*/*;q=0.8'
    : kind === 'video'
      ? 'video/mp4,*/*;q=0.8'
      : 'audio/mpeg,audio/wav,*/*;q=0.8'
  const response = await fetch(url, { headers: { accept } })
  if (!response.ok) {
    throw InfraError(`Video media input download failed (${response.status}): ${url}`, { stage: 'video:media-inputs' })
  }

  const responseMimeType = normalizeMimeType(response.headers.get('content-type') ?? undefined)
  const fallbackMimeType = getUrlMimeType(url)
  const mimeType = responseMimeType && allowedMimeTypes(kind).includes(responseMimeType)
    ? responseMimeType
    : fallbackMimeType

  if (!mimeType || !allowedMimeTypes(kind).includes(mimeType)) {
    throw CLIUsageError(`Unsupported media URL "${url}". Expected ${prettyMimeList(kind)} content for ${kind} input.`)
  }

  const urlName = basename(new URL(url).pathname)
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType,
    fileName: urlName.length > 0 ? urlName : kind === 'image' ? 'image.png' : kind === 'video' ? 'video.mp4' : 'audio.mp3'
  }
}

const dataUrlToBytes = (value: string, kind: VideoMediaKind): { bytes: Uint8Array, mimeType: string, fileName: string } => {
  const parsed = parseDataUrl(value)
  if (!parsed || !allowedMimeTypes(kind).includes(parsed.mimeType)) {
    throw CLIUsageError(`Unsupported media data URL. Expected ${prettyMimeList(kind)} content for ${kind} input.`)
  }

  return {
    bytes: new Uint8Array(Buffer.from(parsed.base64, 'base64')),
    mimeType: parsed.mimeType,
    fileName: kind === 'image' ? 'image.png' : kind === 'video' ? 'video.mp4' : 'audio.mp3'
  }
}

export const videoMediaReferenceToGeminiInlineData = async (
  value: string,
  kind: VideoMediaKind
): Promise<GeminiInlineMedia> => {
  if (isVideoMediaDataUrl(value)) {
    const { bytes, mimeType } = dataUrlToBytes(value, kind)
    return {
      inlineData: {
        mimeType,
        data: Buffer.from(bytes).toString('base64')
      }
    }
  }

  if (isHttpMediaUrl(value)) {
    const { bytes, mimeType } = await fetchMediaBytes(value, kind)
    return {
      inlineData: {
        mimeType,
        data: Buffer.from(bytes).toString('base64')
      }
    }
  }

  const mimeType = getLocalMimeType(value)
  if (!mimeType || !allowedMimeTypes(kind).includes(mimeType)) {
    throw CLIUsageError(`Unsupported local media input "${value}". Expected ${prettyMimeList(kind)} content for ${kind} input.`)
  }
  const bytes = await Bun.file(value).arrayBuffer()
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
  if (isVideoMediaDataUrl(value)) {
    const { bytes, mimeType } = dataUrlToBytes(value, kind)
    return {
      mimeType,
      bytesBase64Encoded: Buffer.from(bytes).toString('base64')
    }
  }

  if (isHttpMediaUrl(value)) {
    const { bytes, mimeType } = await fetchMediaBytes(value, kind)
    return {
      mimeType,
      bytesBase64Encoded: Buffer.from(bytes).toString('base64')
    }
  }

  const mimeType = getLocalMimeType(value)
  if (!mimeType || !allowedMimeTypes(kind).includes(mimeType)) {
    throw CLIUsageError(`Unsupported local media input "${value}". Expected ${prettyMimeList(kind)} content for ${kind} input.`)
  }
  const bytes = await Bun.file(value).arrayBuffer()
  return {
    mimeType,
    bytesBase64Encoded: Buffer.from(bytes).toString('base64')
  }
}

export const videoMediaReferenceToGrokUrlObject = async (
  value: string,
  kind: VideoMediaKind
): Promise<GrokUrlMedia> => {
  return { url: await videoMediaReferenceToUrlOrDataUrl(value, kind) }
}

export const tryResolveLocalVideoDurationSeconds = async (value: string): Promise<number | undefined> => {
  if (isHttpMediaUrl(value) || isVideoMediaDataUrl(value) || !existsSync(value) || !hasRuntimeTool('ffprobe')) {
    return undefined
  }

  const result = await exec(getFfprobeBinary(), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    value
  ])
  if (result.exitCode !== 0) {
    return undefined
  }

  return parseDurationSeconds(result.stdout)
}

export const tryResolveLocalAudioProbe = async (value: string): Promise<AudioProbeResult | undefined> => {
  if (isHttpMediaUrl(value) || isVideoMediaDataUrl(value) || !existsSync(value)) {
    return undefined
  }
  const mimeType = getLocalMimeType(value)
  if (!mimeType || !allowedMimeTypes('audio').includes(mimeType)) {
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
): Promise<string> => {
  if (isHttpMediaUrl(value)) {
    return value
  }

  if (isVideoMediaDataUrl(value)) {
    const { bytes } = dataUrlToBytes(value, kind)
    return Buffer.from(bytes).toString('base64')
  }

  const mimeType = getLocalMimeType(value)
  if (!mimeType || !allowedMimeTypes(kind).includes(mimeType)) {
    throw CLIUsageError(`Unsupported local media input "${value}". Expected ${prettyMimeList(kind)} content for ${kind} input.`)
  }
  const bytes = await Bun.file(value).arrayBuffer()
  return Buffer.from(bytes).toString('base64')
}

export const videoMediaReferenceToUrlOrDataUrl = async (
  value: string,
  kind: VideoMediaKind
): Promise<string> => {
  if (isHttpMediaUrl(value) || isVideoMediaDataUrl(value)) {
    return value
  }

  const mimeType = getLocalMimeType(value)
  if (!mimeType || !allowedMimeTypes(kind).includes(mimeType)) {
    throw CLIUsageError(`Unsupported local media input "${value}". Expected ${prettyMimeList(kind)} content for ${kind} input.`)
  }
  const bytes = await Bun.file(value).arrayBuffer()
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`
}
