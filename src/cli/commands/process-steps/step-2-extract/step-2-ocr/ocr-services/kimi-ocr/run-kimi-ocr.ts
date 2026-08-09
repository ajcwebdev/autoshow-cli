import type { DocumentMetadata, OpenAIChatCompletionResponse } from '~/types'
import { createChatImageOcrRunner } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/chat-image-ocr'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import {
  KIMI_OCR_IMAGE_BYTES,
  acceptsKimiThinkingField,
  ensureKimiApiKey,
  resolveKimiBaseUrl
} from './kimi'

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

export const runKimiOcr = createChatImageOcrRunner({
  service: 'kimi',
  extractionMethod: 'kimi-ocr',
  tempDirPrefix: 'autoshow-kimi-ocr-',
  providerLabel: 'Kimi OCR',
  maxImageBytes: KIMI_OCR_IMAGE_BYTES,
  imageLimitLabel: '100 MB',
  supportedMimeTypes: KIMI_OCR_IMAGE_MIME_TYPES,
  prompt: buildOcrPrompt(),
  errorMessagePrefix: 'Kimi OCR request failed',
  getConfig: () => ({
    apiKey: ensureKimiApiKey('Kimi OCR'),
    baseURL: resolveKimiBaseUrl()
  }),
  buildBody: ({ model, messages }) => ({
    model,
    stream: false,
    max_completion_tokens: KIMI_OCR_DEFAULT_MAX_COMPLETION_TOKENS,
    ...(acceptsKimiThinkingField(model) ? { thinking: { type: 'disabled' } } : {}),
    messages
  }),
  checkResponse: (response: OpenAIChatCompletionResponse, rawText: string, pageLabel: string) => {
    if (isLengthFinishReason(response.choices?.[0]?.finish_reason)) {
      throw buildTruncatedResponseError(rawText, pageLabel)
    }
  }
})
