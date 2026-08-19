import { existsSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import type { MediaKindSpec, MediaReferenceBytes, ReferenceValidationOptions } from '~/types'

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const parseDataUrlValue = (value: string): { mimeType: string, base64: string } | undefined => {
  const match = /^data:([^;,]+);base64,(.*)$/is.exec(value)
  if (!match?.[1] || match[2] === undefined) return undefined
  return { mimeType: match[1], base64: match[2] }
}

export const createMediaReferenceEngine = (spec: MediaKindSpec): {
  isHttpUrl: (value: string) => boolean
  isDataUrl: (value: string) => boolean
  parseDataUrl: (value: string) => { mimeType: string, base64: string } | undefined
  getLocalMimeType: (value: string) => string | undefined
  getUrlMimeType: (value: string) => string | undefined
  getReferenceMimeType: (value: string) => string | undefined
  validateReferences: (inputs: readonly string[] | undefined, options: ReferenceValidationOptions) => void
  resolveBytes: (value: string) => Promise<MediaReferenceBytes>
  referenceToUrlOrDataUrl: (value: string) => Promise<string>
  referenceToUrlOrBase64: (value: string) => Promise<string>
} => {
  const normalizeMimeType = (value: string | undefined): string | undefined => {
    const mimeType = value?.split(';')[0]?.trim().toLowerCase()
    return mimeType ? spec.mimeAliases[mimeType] ?? mimeType : undefined
  }

  const parseDataUrl = (value: string): { mimeType: string, base64: string } | undefined => {
    const parsed = parseDataUrlValue(value)
    const mimeType = normalizeMimeType(parsed?.mimeType)
    return parsed && mimeType ? { mimeType, base64: parsed.base64 } : undefined
  }

  const isDataUrl = (value: string): boolean => spec.dataUrlPattern.test(value)
  const getLocalMimeType = (value: string): string | undefined => spec.mimeByExtension[extname(value).toLowerCase()]
  const getUrlMimeType = (value: string): string | undefined => {
    try {
      return spec.mimeByExtension[extname(new URL(value).pathname).toLowerCase()]
    } catch {
      return undefined
    }
  }
  const getReferenceMimeType = (value: string): string | undefined => {
    if (isDataUrl(value)) return parseDataUrl(value)?.mimeType
    if (isHttpUrl(value)) return getUrlMimeType(value)
    return getLocalMimeType(value)
  }

  const assertSupportedMimeType = (value: string, allowedMimeTypes: readonly string[], error: (value: string) => string): void => {
    const mimeType = getReferenceMimeType(value)
    if (mimeType === undefined || !allowedMimeTypes.includes(mimeType)) {
      throw CLIUsageError(error(value))
    }
  }

  const validateReferences = (inputs: readonly string[] | undefined, options: ReferenceValidationOptions): void => {
    const values = inputs ?? []
    if (options.maxInputs !== undefined && values.length > options.maxInputs) {
      throw CLIUsageError(options.maxInputsError?.(options.maxInputs) ?? `Expected at most ${options.maxInputs} media references.`)
    }
    const allowedMimeTypes = options.allowedMimeTypes ?? spec.allowedMimeTypes
    for (const value of values) {
      if (isHttpUrl(value)) {
        if (getUrlMimeType(value) !== undefined) {
          assertSupportedMimeType(value, allowedMimeTypes, options.unsupportedMimeError)
        }
        continue
      }
      if (isDataUrl(value)) {
        assertSupportedMimeType(value, allowedMimeTypes, options.unsupportedMimeError)
        continue
      }
      if (!existsSync(value)) {
        throw CLIUsageError(options.missingFileError(value))
      }
      assertSupportedMimeType(value, allowedMimeTypes, options.unsupportedMimeError)
    }
  }

  const dataUrlToBytes = (value: string): MediaReferenceBytes => {
    const parsed = parseDataUrl(value)
    if (!parsed || (spec.policy.mode === 'strict' && !spec.allowedMimeTypes.includes(parsed.mimeType))) {
      throw CLIUsageError(spec.errors.unsupportedDataUrl())
    }
    return {
      bytes: new Uint8Array(Buffer.from(parsed.base64, 'base64')),
      mimeType: parsed.mimeType,
      fileName: spec.defaultFileName(parsed.mimeType)
    }
  }

  const fetchBytes = async (url: string): Promise<MediaReferenceBytes> => {
    const response = await fetch(url, { headers: { accept: spec.accept } })
    if (!response.ok) {
      throw InfraError(spec.errors.download(response.status, url), {
        stage: spec.downloadError.stage,
        status: response.status
      })
    }
    const responseMimeType = normalizeMimeType(response.headers.get('content-type') ?? undefined)
    const acceptsResponseMime = responseMimeType !== undefined && (
      spec.policy.mode === 'lenient'
        ? responseMimeType.startsWith(spec.policy.contentTypePrefix)
        : spec.allowedMimeTypes.includes(responseMimeType)
    )
    const mimeType = acceptsResponseMime
      ? responseMimeType
      : getUrlMimeType(url) ?? (spec.policy.mode === 'lenient' ? spec.policy.fallbackMimeType : undefined)
    if (!mimeType || (spec.policy.mode === 'strict' && !spec.allowedMimeTypes.includes(mimeType))) {
      throw CLIUsageError(spec.errors.unsupportedUrl(url))
    }
    const urlName = basename(new URL(url).pathname)
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mimeType,
      fileName: urlName.length > 0 ? urlName : spec.defaultFileName(mimeType)
    }
  }

  const localFileToBytes = async (value: string): Promise<MediaReferenceBytes> => {
    const detectedMimeType = getLocalMimeType(value)
    const mimeType = detectedMimeType ?? (spec.policy.mode === 'lenient' ? spec.policy.fallbackMimeType : undefined)
    if (!mimeType || (spec.policy.mode === 'strict' && !spec.allowedMimeTypes.includes(mimeType))) {
      throw CLIUsageError(spec.errors.unsupportedLocal(value))
    }
    return {
      bytes: new Uint8Array(await Bun.file(value).arrayBuffer()),
      mimeType,
      fileName: basename(value)
    }
  }

  const resolveBytes = async (value: string): Promise<MediaReferenceBytes> => {
    if (isDataUrl(value)) return dataUrlToBytes(value)
    if (isHttpUrl(value)) return await fetchBytes(value)
    return await localFileToBytes(value)
  }

  return {
    isHttpUrl,
    isDataUrl,
    parseDataUrl,
    getLocalMimeType,
    getUrlMimeType,
    getReferenceMimeType,
    validateReferences,
    resolveBytes,
    referenceToUrlOrDataUrl: async (value) => {
      if (isHttpUrl(value) || isDataUrl(value)) return value
      const { bytes, mimeType } = await localFileToBytes(value)
      return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`
    },
    referenceToUrlOrBase64: async (value) => {
      if (isHttpUrl(value)) return value
      const { bytes } = isDataUrl(value) ? dataUrlToBytes(value) : await localFileToBytes(value)
      return Buffer.from(bytes).toString('base64')
    }
  }
}
