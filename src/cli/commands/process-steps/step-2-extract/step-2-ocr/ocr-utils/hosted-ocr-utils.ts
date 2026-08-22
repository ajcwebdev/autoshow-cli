import { isRecord } from '~/utils/rest-client'
import { statPath as stat } from '~/utils/bun-file-io'
import { basename } from 'node:path'
import type { DocumentMetadata, HostedOcrImageResult, HostedOcrRun, PageResult } from '~/types'
import { ValidationError } from '~/utils/error-handler'

export const buildHostedOcrImageResult = (
  pageNumber: number,
  rawText: string,
  usage: {
    promptTokens?: number | undefined
    completionTokens?: number | undefined
  } = {}
): HostedOcrImageResult => ({
  page: {
    pageNumber,
    method: 'ocr',
    text: rawText.trim()
  },
  ...(typeof usage.promptTokens === 'number' ? { promptTokens: usage.promptTokens } : {}),
  ...(typeof usage.completionTokens === 'number' ? { completionTokens: usage.completionTokens } : {})
})

const getHostedOcrImageMimeType = (
  format: DocumentMetadata['format'],
  providerLabel: string,
  supported: Partial<Record<DocumentMetadata['format'], string>>
): string => {
  const mimeType = supported[format]
  if (!mimeType) {
    throw ValidationError(`Unsupported ${providerLabel} image format: ${format}`, { stage: 'ocr:hosted' })
  }
  return mimeType
}

export const assertHostedOcrImageWithinLimits = async (
  filePath: string,
  pageLabel: string,
  options: {
    providerLabel: string
    maxBytes: number
    limitLabel: string
  }
): Promise<void> => {
  const fileStats = await stat(filePath)
  if (fileStats.size > options.maxBytes) {
    throw ValidationError(`${options.providerLabel} image input exceeds the ${options.limitLabel} image limit for ${basename(filePath)} (${pageLabel}).`, { stage: 'ocr:hosted' })
  }
}

export const readHostedOcrImageDataUrl = async (
  filePath: string,
  format: DocumentMetadata['format'],
  options: {
    providerLabel: string
    supportedMimeTypes: Partial<Record<DocumentMetadata['format'], string>>
  }
): Promise<string> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  return `data:${getHostedOcrImageMimeType(format, options.providerLabel, options.supportedMimeTypes)};base64,${base64}`
}

const isPageResult = (value: unknown): value is PageResult =>
  isRecord(value)
  && typeof value['pageNumber'] === 'number'
  && (value['method'] === 'text' || value['method'] === 'ocr' || value['method'] === 'skipped')
  && typeof value['text'] === 'string'
  && (value['confidence'] === undefined || typeof value['confidence'] === 'number')

export const isHostedOcrRun = (value: unknown): value is HostedOcrRun =>
  isRecord(value)
  && Array.isArray(value['pages'])
  && value['pages'].every(isPageResult)
  && typeof value['extractionMethod'] === 'string'
  && typeof value['ocrService'] === 'string'
  && typeof value['ocrModel'] === 'string'

export const getUsageNumber = (
  entry: Record<string, unknown>,
  keys: readonly string[]
): number | undefined => {
  for (const key of keys) {
    const value = entry[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}
