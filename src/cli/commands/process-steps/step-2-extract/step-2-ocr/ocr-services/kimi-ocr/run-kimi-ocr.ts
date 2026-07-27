import type { DocumentMetadata, ExtractionOptions, HostedOcrImageResult, HostedOcrSchedulerRetryPressureHandler, OpenAIRestConfig, PageResult } from '~/types'
import { withOcrPageRequestRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { assertHostedOcrImageWithinLimits, buildHostedOcrImageResult, readHostedOcrImageDataUrl, runHostedOcrDocument } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-utils'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import {
  KIMI_OCR_IMAGE_BYTES,
  acceptsKimiThinkingField,
  ensureKimiApiKey,
  resolveKimiBaseUrl
} from './kimi'
import { createOpenAIChatCompletion, extractOpenAIChatCompletionText } from '~/utils/openai/openai-client'

const KIMI_OCR_DEFAULT_MAX_COMPLETION_TOKENS = 8192
const KIMI_OCR_IMAGE_MIME_TYPES: Partial<Record<DocumentMetadata['format'], string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif'
}

const buildOcrPrompt = (): string => [
  'Perform OCR on the provided single page image.',
  'Return only the visible text from the page.',
  'Do not summarize, explain, or translate.',
  'Do not wrap the text in JSON, Markdown, or code fences.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'Collapse long runs of spaces or tabs used only for visual alignment.',
  'If the page is blank or unreadable, return an empty response.'
].join(' ')

const isLengthFinishReason = (
  finishReason: string | null | undefined
): boolean =>
  finishReason === 'length' || finishReason === 'max_tokens'

const buildKimiOcrChatBody = (
  model: string,
  imageUrl: string
): Record<string, unknown> => ({
  model,
  stream: false,
  max_completion_tokens: KIMI_OCR_DEFAULT_MAX_COMPLETION_TOKENS,
  ...(acceptsKimiThinkingField(model) ? { thinking: { type: 'disabled' } } : {}),
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: buildOcrPrompt() },
      { type: 'image_url', image_url: { url: imageUrl } }
    ]
  }]
})

const buildTruncatedResponseError = (
  rawText: string,
  pageLabel: string
): OcrStructuredResponseError => {
  const error = new OcrStructuredResponseError(
    `Kimi OCR response for ${pageLabel} stopped at the max completion token limit before finishing.`,
    rawText
  )
  ;(error as OcrStructuredResponseError & { category: 'provider_limit' }).category = 'provider_limit'
  return error
}

const runKimiOcrImage = async (
  config: OpenAIRestConfig,
  imagePath: string,
  format: DocumentMetadata['format'],
  model: string,
  pageNumber: number,
  pageLabel: string,
  onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
): Promise<HostedOcrImageResult> => {
  await assertHostedOcrImageWithinLimits(imagePath, pageLabel, {
    providerLabel: 'Kimi OCR',
    maxBytes: KIMI_OCR_IMAGE_BYTES,
    limitLabel: '100 MB'
  })
  const imageUrl = await readHostedOcrImageDataUrl(imagePath, format, {
    providerLabel: 'Kimi OCR',
    supportedMimeTypes: KIMI_OCR_IMAGE_MIME_TYPES
  })

  return await withOcrPageRequestRetry(
    `kimi-ocr ${pageLabel}`,
    async (signal) => {
      const response = await createOpenAIChatCompletion(config, buildKimiOcrChatBody(model, imageUrl), { signal, errorMessagePrefix: 'Kimi OCR request failed' })
      const rawText = extractOpenAIChatCompletionText(response) ?? ''
      const finishReason = response.choices?.[0]?.finish_reason

      if (isLengthFinishReason(finishReason)) {
        throw buildTruncatedResponseError(rawText, pageLabel)
      }

      return buildHostedOcrImageResult(pageNumber, rawText, {
        ...(typeof response.usage?.prompt_tokens === 'number' ? { promptTokens: response.usage.prompt_tokens } : {}),
        ...(typeof response.usage?.completion_tokens === 'number' ? { completionTokens: response.usage.completion_tokens } : {})
      })
    },
    { onRetryable }
  )
}

export const runKimiOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  opts: Pick<ExtractionOptions, 'dpi' | 'password' | 'outputDir' | 'ocrPreparationCache' | 'ocrConcurrency' | 'ocrConcurrencyMode' | 'hostedOcrScheduler'>
): Promise<{
  pages: PageResult[]
  extractionMethod: 'kimi-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const apiKey = ensureKimiApiKey('Kimi OCR')
  const config = { apiKey, baseURL: resolveKimiBaseUrl() }
  return await runHostedOcrDocument(filePath, step1Metadata, opts, {
    service: 'kimi',
    extractionMethod: 'kimi-ocr',
    tempDirPrefix: 'autoshow-kimi-ocr-',
    providerLabel: 'Kimi OCR',
    model,
    runImage: async (imagePath, format, pageNumber, pageLabel, onRetryable) =>
      await runKimiOcrImage(config, imagePath, format, model, pageNumber, pageLabel, onRetryable)
  })
}
