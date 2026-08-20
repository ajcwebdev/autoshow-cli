import { basename, join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as v from 'valibot'
import * as l from '~/utils/app-logger/app-logger'
import type { DocumentMetadata, HostedOcrSchedulerRetryPressureHandler, NormalizedReasoningEffort, PageResult } from '~/types'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { splitPdfPages } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { getAnthropicClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-anthropic/anthropic-utils'
import { OCR_SCHEMA_RETRY_ATTEMPTS, withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import { OCR_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'
import { InfraError, InternalError, ValidationError } from '~/utils/error-handler'
import { applyAnthropicReasoning } from '~/cli/commands/setup-and-utilities/models/reasoning-request-mappers'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { buildHostedOcrJsonPrompt, HOSTED_OCR_PAGES_JSON_SCHEMA, HostedOcrEnvelopeSchema, normalizeHostedOcrPages } from '../../ocr-utils/hosted-ocr-json'
import {
  createAnthropicMessage,
  deleteAnthropicFile,
  uploadAnthropicFile
} from '~/utils/anthropic/anthropic-client'
import {
  ANTHROPIC_OCR_FILES_BETA,
  ANTHROPIC_OCR_FILES_UPLOAD_BYTES,
  ANTHROPIC_OCR_IMAGE_BYTES,
  ANTHROPIC_OCR_MAX_TOKENS
} from './anthropic-ocr'

const getImageMimeType = (format: DocumentMetadata['format']): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' => {
  switch (format) {
    case 'jpg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      throw InternalError(`Unsupported Anthropic OCR image format: ${format}`, { stage: 'ocr:anthropic' })
  }
}

const buildOcrPrompt = (expectedPageCount: number): string => [
  buildHostedOcrJsonPrompt(expectedPageCount),
  `Use this exact JSON schema: ${JSON.stringify(HOSTED_OCR_PAGES_JSON_SCHEMA)}`
].join(' ')

const extractAnthropicText = (content: Array<{ type: string, text?: string | undefined }>): string =>
  content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')

const normalizePages = (
  value: unknown,
  expectedPageCount: number,
  pageLabel: string
): PageResult[] => {
  const parsed = v.safeParse(HostedOcrEnvelopeSchema, value)
  if (!parsed.success) {
    throw ValidationError(`Anthropic OCR response for ${pageLabel} did not match the expected page schema.`, { stage: 'ocr:anthropic' })
  }

  return normalizeHostedOcrPages(parsed.output.pages, expectedPageCount, {
    countMismatchMessage: (actual, expected) => `Anthropic OCR returned ${actual} pages for ${pageLabel}, expected ${expected}. Split the document into smaller chunks and retry.`,
    nonContiguousMessage: `Anthropic OCR returned non-contiguous page numbers for ${pageLabel}. Split the document into smaller chunks and retry.`
  })
}

const parseOcrResponse = (
  rawText: string,
  expectedPageCount: number,
  pageLabel: string
): PageResult[] => {
  const validation = parseAndValidateStructured(HostedOcrEnvelopeSchema, rawText)
  if (!validation.success) {
    throw new OcrStructuredResponseError(`Anthropic OCR returned malformed JSON for ${pageLabel}. Split the document into smaller chunks and retry.`, rawText)
  }

  try {
    return normalizePages(validation.value, expectedPageCount, pageLabel)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new OcrStructuredResponseError(message, rawText)
  }
}

const callAnthropicMessage = async (
  requestBody: Record<string, unknown>,
  operationName: string,
  beta?: string | string[] | undefined,
  onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
) => {
  const config = getAnthropicClientConfig()
  return await withOcrCreateRetry(
    operationName,
    async (signal) => await createAnthropicMessage(config, requestBody, {
      signal,
      beta
    }),
    { onRetryable }
  )
}

const runMessageWithSchemaRetry = async (
  requestBody: Record<string, unknown>,
  expectedPageCount: number,
  pageLabel: string,
  operationName: string,
  beta?: string | string[] | undefined,
  onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
): Promise<{ pages: PageResult[], promptTokens?: number, completionTokens?: number }> => {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < OCR_SCHEMA_RETRY_ATTEMPTS; attempt++) {
    const message = await callAnthropicMessage(requestBody, operationName, beta, onRetryable)
    const rawText = extractAnthropicText(message.content ?? [])

    try {
      if (!rawText.trim()) {
        if (expectedPageCount === 1) {
          return {
            pages: [{
              pageNumber: 1,
              method: 'ocr',
              text: ''
            }],
            ...(typeof message.usage?.input_tokens === 'number' ? { promptTokens: message.usage.input_tokens } : {}),
            ...(typeof message.usage?.output_tokens === 'number' ? { completionTokens: message.usage.output_tokens } : {})
          }
        }
        throw new OcrStructuredResponseError(`Anthropic OCR returned no text output for ${pageLabel}.`, rawText)
      }

      const pages = parseOcrResponse(rawText, expectedPageCount, pageLabel)
      return {
        pages,
        ...(typeof message.usage?.input_tokens === 'number' ? { promptTokens: message.usage.input_tokens } : {}),
        ...(typeof message.usage?.output_tokens === 'number' ? { completionTokens: message.usage.output_tokens } : {})
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < OCR_SCHEMA_RETRY_ATTEMPTS - 1) {
        l.warn(`Anthropic OCR returned malformed output for ${pageLabel}; retrying`)
        continue
      }
    }
  }

  throw lastError ?? InfraError(`Anthropic OCR failed for ${pageLabel}.`, { stage: 'ocr:anthropic' })
}

const createImageRequestBody = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string
): Promise<Record<string, unknown>> => {
  const file = Bun.file(filePath)
  if (file.size > ANTHROPIC_OCR_IMAGE_BYTES) {
    throw ValidationError(`Anthropic OCR image input exceeds the 5 MB per-image limit for ${basename(filePath)}.`, { stage: 'ocr:anthropic' })
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  return {
    model,
    max_tokens: ANTHROPIC_OCR_MAX_TOKENS,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: buildOcrPrompt(1)
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: getImageMimeType(step1Metadata.format),
            data: base64
          }
        }
      ]
    }]
  }
}

const createPdfChunk = async (
  inputPath: string,
  outputPath: string,
  pageRange: string
): Promise<void> => {
  const result = await splitPdfPages(inputPath, outputPath, pageRange, undefined, { logLabel: 'Anthropic OCR' })
  if (result.exitCode !== 0 && !(result.exitCode === 3 && result.tool === 'qpdf')) {
    throw InfraError(result.stderr || result.stdout || `PDF page split failed for pages ${pageRange}`, { stage: 'ocr:anthropic' })
  }
}

const runPdfChunk = async (
  filePath: string,
  model: string,
  startPage: number,
  endPage: number,
  options: {
    inputAlreadySinglePageChunk?: boolean | undefined
    onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
    effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
  } = {}
): Promise<{ pages: PageResult[], promptTokens: number, completionTokens: number }> => {
  const pageLabel = `pages ${startPage}-${endPage}`
  const useInputAsChunk = options.inputAlreadySinglePageChunk === true
    && startPage === 1
    && endPage === 1
  const tempDir = useInputAsChunk ? undefined : await mkdtemp(join(tmpdir(), 'autoshow-anthropic-ocr-'))
  const chunkPath = useInputAsChunk
    ? filePath
    : join(tempDir as string, `chunk-${startPage}-${endPage}.pdf`)
  const config = getAnthropicClientConfig()
  let uploadedFileId: string | undefined

  try {
    if (!useInputAsChunk) {
      await createPdfChunk(filePath, chunkPath, `${startPage}-${endPage}`)
    }
    const chunkFile = Bun.file(chunkPath)
    if (chunkFile.size > ANTHROPIC_OCR_FILES_UPLOAD_BYTES) {
      throw ValidationError(`Anthropic OCR PDF chunk ${pageLabel} exceeds the 500 MB Files API upload limit. Split the document into smaller chunks and retry.`, { stage: 'ocr:anthropic' })
    }
    const uploadFile = new File([await chunkFile.arrayBuffer()], basename(chunkPath), {
      type: 'application/pdf'
    })

    const uploaded = await withOcrCreateRetry(
      'anthropic-ocr-file-upload',
      async (signal) => await uploadAnthropicFile(config, uploadFile, {
        signal,
        beta: ANTHROPIC_OCR_FILES_BETA
      }),
      { onRetryable: options.onRetryable }
    )

    uploadedFileId = uploaded.id
    const expectedPageCount = endPage - startPage + 1
    const requestBody: Record<string, unknown> = {
      model,
      max_tokens: ANTHROPIC_OCR_MAX_TOKENS,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildOcrPrompt(expectedPageCount)
          },
          {
            type: 'document',
            title: basename(chunkPath),
            source: {
              type: 'file',
              file_id: uploadedFileId
            }
          }
        ]
      }]
    }

    if (options.effectiveReasoningEffort) {
      applyAnthropicThinkingToBody(requestBody, options.effectiveReasoningEffort)
    }

    const result = await runMessageWithSchemaRetry(
      requestBody,
      expectedPageCount,
      pageLabel,
      'anthropic-ocr',
      ANTHROPIC_OCR_FILES_BETA,
      options.onRetryable
    )

    return {
      pages: result.pages.map((page) => ({
        ...page,
        pageNumber: page.pageNumber + startPage - 1
      })),
      promptTokens: result.promptTokens ?? 0,
      completionTokens: result.completionTokens ?? 0
    }
  } finally {
    if (uploadedFileId) {
      try {
        await deleteAnthropicFile(config, uploadedFileId, {
          signal: AbortSignal.timeout(OCR_REQUEST_TIMEOUT_MS),
          beta: ANTHROPIC_OCR_FILES_BETA
        })
      } catch (error) {
        l.warn(`Failed to delete Anthropic OCR upload ${uploadedFileId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    if (tempDir !== undefined) {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

const applyAnthropicThinkingToBody = (requestBody: Record<string, unknown>, effective: NormalizedReasoningEffort): void =>
  applyAnthropicReasoning(requestBody, effective)

export const runAnthropicOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  options: {
    onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
    reasoningEffort?: NormalizedReasoningEffort | undefined
  } = {}
): Promise<{
  pages: PageResult[]
  extractionMethod: 'anthropic-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
}> => {
  const policy = resolveReasoningPolicy({
    step: 'extract',
    service: 'anthropic',
    model,
    requestedReasoningEffort: options.reasoningEffort
  })

  if (step1Metadata.format !== 'pdf') {
    const requestBody = await createImageRequestBody(filePath, step1Metadata, model)
    applyAnthropicThinkingToBody(requestBody, policy.effective)
    const result = await runMessageWithSchemaRetry(requestBody, 1, 'page 1', 'anthropic-ocr', undefined, options.onRetryable)
    return {
      pages: result.pages,
      extractionMethod: 'anthropic-ocr',
      totalPages: 1,
      ...(typeof result.promptTokens === 'number' ? { promptTokens: result.promptTokens } : {}),
      ...(typeof result.completionTokens === 'number' ? { completionTokens: result.completionTokens } : {}),
      ...(policy.requested !== undefined ? { requestedReasoningEffort: policy.requested } : {}),
      effectiveReasoningEffort: policy.effective
    }
  }

  const totalPages = Math.max(1, step1Metadata.pageCount)
  const chunk = await runPdfChunk(filePath, model, 1, totalPages, {
    inputAlreadySinglePageChunk: totalPages === 1,
    onRetryable: options.onRetryable,
    effectiveReasoningEffort: policy.effective
  })

  return {
    pages: chunk.pages,
    extractionMethod: 'anthropic-ocr',
    totalPages,
    ...(chunk.promptTokens > 0 ? { promptTokens: chunk.promptTokens } : {}),
    ...(chunk.completionTokens > 0 ? { completionTokens: chunk.completionTokens } : {}),
    ...(policy.requested !== undefined ? { requestedReasoningEffort: policy.requested } : {}),
    effectiveReasoningEffort: policy.effective
  }
}
