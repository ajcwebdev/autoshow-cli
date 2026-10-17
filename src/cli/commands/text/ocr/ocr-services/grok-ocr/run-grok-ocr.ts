import type { DocumentMetadata } from '~/types'
import { createChatImageOcrRunner } from '~/cli/commands/text/ocr/ocr-utils/chat-image-ocr'
import { OcrOutputLimitError, OcrStructuredResponseError } from '~/cli/commands/text/ocr/ocr-structured-response-error'
import { normalizeGrokChatUsage } from '~/utils/openai/grok-chat-usage'
import {
  getGrokOcrClientConfig,
  GROK_OCR_IMAGE_BYTES
} from './grok-ocr'

const GROK_OCR_MAX_COMPLETION_TOKENS = 4096
const GROK_OCR_IMAGE_MIME_TYPES: Partial<Record<DocumentMetadata['format'], string>> = {
  png: 'image/png',
  jpg: 'image/jpeg'
}

const buildOcrPrompt = (): string => [
  'Perform OCR on the provided page image.',
  'Return only the text visible on the page.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If the page is blank or unreadable, return an empty string.'
].join(' ')

export const runGrokOcr = createChatImageOcrRunner({
  extractionMethod: 'grok-ocr',
  service: 'grok',
  providerLabel: 'Grok OCR',
  maxImageBytes: GROK_OCR_IMAGE_BYTES,
  imageLimitLabel: '20 MiB',
  supportedMimeTypes: GROK_OCR_IMAGE_MIME_TYPES,
  prompt: buildOcrPrompt(),
  errorMessagePrefix: 'Grok OCR request failed',
  getConfig: getGrokOcrClientConfig,
  mapUsage: normalizeGrokChatUsage,
  buildBody: ({ model, messages, reasoningPolicy }) => ({
    model,
    max_completion_tokens: GROK_OCR_MAX_COMPLETION_TOKENS,
    ...(reasoningPolicy.effective === 'low' || reasoningPolicy.effective === 'medium' || reasoningPolicy.effective === 'high' || reasoningPolicy.effective === 'xhigh'
      ? { reasoning_effort: reasoningPolicy.effective }
      : {}),
    messages
  }),
  checkResponse: (response, text, page) => {
    const choice = response.choices?.[0]
    let error: OcrStructuredResponseError | undefined
    if (choice?.finish_reason === 'length' || choice?.finish_reason === 'max_tokens') {
      error = new OcrOutputLimitError(`Grok OCR ${page} reached its visible output token limit.`, text)
    } else if (typeof choice?.message?.['refusal'] === 'string' && choice.message['refusal'].length > 0) {
      error = new OcrStructuredResponseError(`Grok OCR refused ${page}.`, JSON.stringify(response))
    } else if (choice?.finish_reason !== undefined && choice.finish_reason !== 'stop') {
      error = new OcrStructuredResponseError(`Grok OCR ${page} returned an incomplete response (${choice.finish_reason}).`, JSON.stringify(response))
    } else if (typeof choice?.message?.content !== 'string') {
      error = new OcrStructuredResponseError(`Grok OCR ${page} returned no text content.`, JSON.stringify(response))
    }
    if (error) {
      Object.assign(error.metadata, { rawResponse: response, rawProviderUsage: response.usage, returnedModel: response.model })
      throw error
    }
  }
})
