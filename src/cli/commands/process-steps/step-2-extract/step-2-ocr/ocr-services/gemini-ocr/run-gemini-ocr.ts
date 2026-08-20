import { basename } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import type { DocumentMetadata, GeminiContent, GeminiGenerateContentUsageMetadata, HostedOcrRun, HostedOcrSchedulerRetryPressureHandler, NormalizedReasoningEffort, PageResult, RetryDecision } from '~/types'
import { requireApiKey } from '~/utils/validate/env-utils'
import { InfraError, InternalError } from '~/utils/error-handler'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/gemini-utils'
import { classifyOcrCreateRetry, OCR_SCHEMA_RETRY_ATTEMPTS, withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { getCachedCloudStagingObject } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/preparation-cache'
import { buildHostedOcrJsonPrompt, createHostedOcrResponseParser, HOSTED_OCR_PAGES_JSON_SCHEMA } from '../../ocr-utils/hosted-ocr-json'
import { geminiDeleteFile, geminiFileDataPart, geminiGenerateContent, geminiGetFile, geminiUploadFile, geminiUserContent, getGeminiFileState } from '~/utils/gemini/gemini-rest'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import {
  GEMINI_FILE_UPLOAD_BYTES,
  GEMINI_INLINE_NON_PDF_BYTES,
  GEMINI_INLINE_PDF_BYTES
} from './gemini-ocr'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'

const GEMINI_OCR_MIN_OUTPUT_TOKENS = 24_576
const GEMINI_OCR_SINGLE_PAGE_IMAGE_MAX_OUTPUT_TOKENS = 8_192
const GEMINI_OCR_MAX_OUTPUT_TOKENS = 65_536

const parseOcrResponse = createHostedOcrResponseParser('Gemini OCR', 'ocr:gemini')

const getGeminiMimeType = (format: DocumentMetadata['format']): string => {
  switch (format) {
    case 'pdf':
      return 'application/pdf'
    case 'bmp':
      return 'image/bmp'
    case 'jpg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    default:
      throw InternalError(`Unsupported Gemini OCR format: ${format}`, { stage: 'ocr:gemini' })
  }
}

const buildInlineContents = async (
  filePath: string,
  mimeType: string,
  prompt: string
): Promise<GeminiContent> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  return geminiUserContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64
      }
    }
  ])
}

const shouldUploadFile = (fileSizeBytes: number, format: DocumentMetadata['format']): boolean => {
  const inlineLimit = format === 'pdf'
    ? GEMINI_INLINE_PDF_BYTES
    : GEMINI_INLINE_NON_PDF_BYTES
  return fileSizeBytes > inlineLimit
}

const classifyGeminiOcrRetry = (error: unknown): RetryDecision => {
  const ocrDecision = classifyOcrCreateRetry(error)
  if (ocrDecision.shouldRetry) {
    return ocrDecision
  }
  return classifyGeminiRetry(error)
}

const hasGeminiUsageMetadata = (
  usage: GeminiGenerateContentUsageMetadata | undefined
): usage is GeminiGenerateContentUsageMetadata =>
  usage !== undefined && Object.keys(usage).length > 0

const getGeminiPromptTokens = (usage: GeminiGenerateContentUsageMetadata | undefined): number | undefined =>
  typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : undefined

const getGeminiCompletionTokens = (usage: GeminiGenerateContentUsageMetadata | undefined): number | undefined =>
  typeof usage?.candidatesTokenCount === 'number' || typeof usage?.thoughtsTokenCount === 'number'
    ? (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0)
    : undefined

const buildGeminiOcrMaxOutputTokens = (expectedPageCount: number): number => {
  const pages = Number.isFinite(expectedPageCount)
    ? Math.max(1, Math.floor(expectedPageCount))
    : 1
  return Math.min(
    GEMINI_OCR_MAX_OUTPUT_TOKENS,
    Math.max(GEMINI_OCR_MIN_OUTPUT_TOKENS, pages * GEMINI_OCR_MIN_OUTPUT_TOKENS)
  )
}

const buildGeminiThinkingLevel = (effective: string): string | undefined => {
  switch (effective) {
    case 'low': return 'LOW'
    case 'medium': return 'MEDIUM'
    case 'high': return 'HIGH'
    case 'minimal': return 'MINIMAL'
    default: return undefined
  }
}

const buildGeminiOcrGenerationConfig = (
  expectedPageCount: number,
  format: DocumentMetadata['format'],
  effectiveReasoningEffort: string
): Record<string, unknown> => {
  const thinkingLevel = buildGeminiThinkingLevel(effectiveReasoningEffort)
  return {
    responseMimeType: 'application/json',
    responseJsonSchema: HOSTED_OCR_PAGES_JSON_SCHEMA,
    maxOutputTokens: expectedPageCount === 1 && format !== 'pdf'
      ? GEMINI_OCR_SINGLE_PAGE_IMAGE_MAX_OUTPUT_TOKENS
      : buildGeminiOcrMaxOutputTokens(expectedPageCount),
    ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {})
  }
}

const buildGeminiOcrUsageEntry = (
  usage: GeminiGenerateContentUsageMetadata | undefined,
  model: string,
  attempt: number,
  usageRole: 'success' | 'schema-retry',
  diagnostic?: {
    expectedPageCount: number
    pageNumber?: number | undefined
    failureReason?: string | undefined
  } | undefined
): NonNullable<HostedOcrRun['providerUsage']>[number] | undefined => {
  if (!hasGeminiUsageMetadata(usage)) {
    return undefined
  }

  const promptTokens = getGeminiPromptTokens(usage)
  const completionTokens = getGeminiCompletionTokens(usage)
  return {
    provider: 'gemini',
    model,
    attempt,
    usageRole,
    purpose: usageRole === 'schema-retry' ? 'ocr-schema-retry' : 'ocr-page',
    ...(usageRole === 'schema-retry'
      ? {
          pageCount: diagnostic?.expectedPageCount,
          ...(typeof diagnostic?.pageNumber === 'number'
            ? { pageNumber: diagnostic.pageNumber }
            : diagnostic?.expectedPageCount === 1 ? { pageNumber: 1 } : {}),
          ...(diagnostic?.failureReason ? { failureReason: diagnostic.failureReason } : {})
        }
      : {}),
    ...(typeof promptTokens === 'number' ? { promptTokens } : {}),
    ...(typeof completionTokens === 'number' ? { completionTokens } : {}),
    usageMetadata: usage
  }
}

const addOptionalTokenCounts = (
  left: number | undefined,
  right: number | undefined
): number | undefined =>
  typeof left === 'number' || typeof right === 'number'
    ? (left ?? 0) + (right ?? 0)
    : undefined

const formatGeminiOcrRetryUsage = (
  usage: GeminiGenerateContentUsageMetadata | undefined
): string => {
  const completionTokens = getGeminiCompletionTokens(usage)
  if (typeof completionTokens === 'number') {
    return ` (${completionTokens} output tokens)`
  }
  const promptTokens = getGeminiPromptTokens(usage)
  return typeof promptTokens === 'number'
    ? ` (${promptTokens} input tokens)`
    : ''
}

const formatGeminiOcrMalformedRetryWarning = (
  filePath: string,
  attempt: number,
  usage: GeminiGenerateContentUsageMetadata | undefined,
  failureReason: string
): string =>
  `Gemini OCR returned malformed output for ${basename(filePath)} on attempt ${attempt}/${OCR_SCHEMA_RETRY_ATTEMPTS}${formatGeminiOcrRetryUsage(usage)} (${failureReason}); retrying`

const buildGeminiOcrSchemaRetryPrompt = (expectedPageCount: number): string => {
  if (expectedPageCount === 1) {
    return [
      'Return only valid JSON for this single OCR page.',
      'Use exactly this shape: {"pages":[{"pageNumber":1,"text":"..."}]}.',
      'Do not include markdown, explanations, extra keys, or text outside the JSON object.'
    ].join('\n')
  }

  return [
    `Return only valid JSON for these ${expectedPageCount} OCR pages.`,
    'Use exactly this shape: {"pages":[{"pageNumber":1,"text":"..."},{"pageNumber":2,"text":"..."}]}.',
    `Include exactly ${expectedPageCount} page objects with contiguous pageNumber values starting at 1.`,
    'Do not include markdown, explanations, extra keys, or text outside the JSON object.'
  ].join('\n')
}

const sanitizeGeminiSchemaFailureReason = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error)
  const sanitized = sanitizeLogText(raw).replace(/\s+/g, ' ').trim()
  if (!sanitized) {
    return 'structured response validation failed'
  }
  return sanitized.length > 180 ? `${sanitized.slice(0, 177)}...` : sanitized
}

const normalizeGeminiDiagnosticPageNumber = (
  pageNumber: number | undefined
): number | undefined =>
  typeof pageNumber === 'number' && Number.isFinite(pageNumber)
    ? Math.max(1, Math.floor(pageNumber))
    : undefined

const waitForGeminiFile = async (
  apiKey: string,
  fileName: string
): Promise<void> => {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const file = await geminiGetFile(apiKey, fileName)
    const state = getGeminiFileState(file)
    if (state === undefined || state === 'ACTIVE') {
      return
    }
    if (state === 'FAILED') {
      throw InfraError(`Gemini Files API upload failed for ${fileName}`, { stage: 'ocr:gemini' })
    }
    await Bun.sleep(1000)
  }
  throw InfraError(`Gemini Files API upload did not become active for ${fileName}`, { stage: 'ocr:gemini' })
}

export const runGeminiOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  opts: {
    ocrPreparationCache?: import('~/types').OcrPreparationCache | undefined
    onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
    documentPageNumber?: number | undefined
    reasoningEffort?: NormalizedReasoningEffort | undefined
  } = {}
): Promise<{
  pages: PageResult[]
  extractionMethod: 'gemini-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
  providerUsage?: HostedOcrRun['providerUsage']
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
}> => {
  const policy = resolveReasoningPolicy({
    step: 'extract',
    service: 'gemini',
    model,
    requestedReasoningEffort: opts.reasoningEffort
  })
  const apiKey = requireApiKey('GEMINI_API_KEY', 'ocr:gemini', 'Gemini OCR')

  const expectedPageCount = Math.max(1, step1Metadata.pageCount)
  const diagnosticPageNumber = expectedPageCount === 1
    ? normalizeGeminiDiagnosticPageNumber(opts.documentPageNumber) ?? 1
    : undefined
  const mimeType = getGeminiMimeType(step1Metadata.format)
  const initialPrompt = buildHostedOcrJsonPrompt(expectedPageCount)
  const fileSizeBytes = Bun.file(filePath).size
  if (fileSizeBytes > GEMINI_FILE_UPLOAD_BYTES) {
    throw InfraError(`Gemini OCR input exceeds the 2 GB file upload limit for ${basename(filePath)}.`, { stage: 'ocr:gemini' })
  }

  let lastSchemaError: Error | undefined
  let retryPromptTokens: number | undefined
  let retryCompletionTokens: number | undefined
  const retryUsage: NonNullable<HostedOcrRun['providerUsage']> = []

  for (let attempt = 0; attempt < OCR_SCHEMA_RETRY_ATTEMPTS; attempt++) {
    const prompt = attempt === 0
      ? initialPrompt
      : buildGeminiOcrSchemaRetryPrompt(expectedPageCount)
    const response = await withOcrCreateRetry(
      'gemini-ocr',
      async (signal) => {
        let uploadedFileName: string | undefined
        try {
          const contents = shouldUploadFile(fileSizeBytes, step1Metadata.format)
            ? await (async () => {
                const staged = await getCachedCloudStagingObject(
                  opts.ocrPreparationCache,
                  {
                    provider: 'gemini',
                    filePath,
                    mimeType,
                    displayName: basename(filePath)
                  },
                  async () => {
                    const uploadedFile = await geminiUploadFile(apiKey, filePath, {
                      mimeType,
                      displayName: basename(filePath),
                      ...(signal ? { abortSignal: signal } : {})
                    })
                    const name = uploadedFile.name ?? undefined
                    if (name) {
                      await waitForGeminiFile(apiKey, name)
                    }
                    const fileMimeType = uploadedFile.mimeType ?? mimeType
                    if (typeof uploadedFile.uri !== 'string' || uploadedFile.uri.length === 0) {
                      throw InfraError('Gemini Files API upload did not return a file URI.', { stage: 'ocr:gemini' })
                    }
                    return {
                      uri: uploadedFile.uri,
                      mimeType: fileMimeType,
                      name,
                      cleanup: async () => {
                        if (name) {
                          await geminiDeleteFile(apiKey, name)
                        }
                      }
                    }
                  }
                )
                uploadedFileName = opts.ocrPreparationCache ? undefined : staged.name
                return geminiUserContent([
                  { text: prompt },
                  geminiFileDataPart(staged.uri, staged.mimeType)
                ])
              })()
            : await buildInlineContents(filePath, mimeType, prompt)

          return await geminiGenerateContent(apiKey, {
            model,
            contents,
            generationConfig: buildGeminiOcrGenerationConfig(expectedPageCount, step1Metadata.format, policy.effective),
            ...(signal ? { abortSignal: signal } : {})
          })
        } finally {
          if (uploadedFileName) {
            try {
              await geminiDeleteFile(apiKey, uploadedFileName)
            } catch (error) {
              l.warn(`Failed to delete Gemini OCR upload ${uploadedFileName}: ${error instanceof Error ? error.message : String(error)}`)
            }
          }
        }
      },
      {
        classifier: classifyGeminiOcrRetry,
        onRetryable: opts.onRetryable
      }
    )

    const rawText = response.text ?? ''
    const usage = response.usageMetadata
    try {
      if (!rawText.trim()) {
        if (expectedPageCount === 1) {
          const successUsage = buildGeminiOcrUsageEntry(usage, model, attempt + 1, 'success')
          const promptTokens = addOptionalTokenCounts(retryPromptTokens, getGeminiPromptTokens(usage))
          const completionTokens = addOptionalTokenCounts(retryCompletionTokens, getGeminiCompletionTokens(usage))
          return {
            pages: [{
              pageNumber: 1,
              method: 'ocr',
              text: ''
            }],
            extractionMethod: 'gemini-ocr',
            totalPages: 1,
            ...(typeof promptTokens === 'number' ? { promptTokens } : {}),
            ...(typeof completionTokens === 'number' ? { completionTokens } : {}),
            ...([...retryUsage, ...(successUsage ? [successUsage] : [])].length > 0
              ? { providerUsage: [...retryUsage, ...(successUsage ? [successUsage] : [])] }
              : {}),
            ...(policy.requested !== undefined ? { requestedReasoningEffort: policy.requested } : {}),
            effectiveReasoningEffort: policy.effective
          }
        }
        throw new OcrStructuredResponseError('Gemini OCR returned no text output.', rawText)
      }

      const successUsage = buildGeminiOcrUsageEntry(usage, model, attempt + 1, 'success')
      const promptTokens = addOptionalTokenCounts(retryPromptTokens, getGeminiPromptTokens(usage))
      const completionTokens = addOptionalTokenCounts(retryCompletionTokens, getGeminiCompletionTokens(usage))
      return {
        pages: parseOcrResponse(rawText, expectedPageCount),
        extractionMethod: 'gemini-ocr',
        totalPages: expectedPageCount,
        ...(typeof promptTokens === 'number' ? { promptTokens } : {}),
        ...(typeof completionTokens === 'number' ? { completionTokens } : {}),
        ...([...retryUsage, ...(successUsage ? [successUsage] : [])].length > 0
          ? { providerUsage: [...retryUsage, ...(successUsage ? [successUsage] : [])] }
          : {}),
        ...(policy.requested !== undefined ? { requestedReasoningEffort: policy.requested } : {}),
        effectiveReasoningEffort: policy.effective
      }
    } catch (error) {
      const failureReason = sanitizeGeminiSchemaFailureReason(error)
      const retryUsageEntry = buildGeminiOcrUsageEntry(usage, model, attempt + 1, 'schema-retry', {
        expectedPageCount,
        pageNumber: diagnosticPageNumber,
        failureReason
      })
      if (retryUsageEntry !== undefined) {
        retryUsage.push(retryUsageEntry)
        retryPromptTokens = addOptionalTokenCounts(retryPromptTokens, getGeminiPromptTokens(usage))
        retryCompletionTokens = addOptionalTokenCounts(retryCompletionTokens, getGeminiCompletionTokens(usage))
      }
      lastSchemaError = error instanceof Error ? error : new Error(String(error))
      if (attempt < OCR_SCHEMA_RETRY_ATTEMPTS - 1) {
        l.write('warn', formatGeminiOcrMalformedRetryWarning(filePath, attempt + 1, usage, failureReason), {
          metadata: {
            provider: 'gemini',
            pageCount: expectedPageCount,
            ...(typeof diagnosticPageNumber === 'number' ? { pageNumber: diagnosticPageNumber } : {}),
            attempt: attempt + 1,
            ...(typeof getGeminiPromptTokens(usage) === 'number' ? { promptTokens: getGeminiPromptTokens(usage) } : {}),
            ...(typeof getGeminiCompletionTokens(usage) === 'number' ? { completionTokens: getGeminiCompletionTokens(usage) } : {}),
            failureReason
          }
        })
      }
    }
  }

  throw lastSchemaError ?? InfraError('Gemini OCR failed', { stage: 'ocr:gemini' })
}
