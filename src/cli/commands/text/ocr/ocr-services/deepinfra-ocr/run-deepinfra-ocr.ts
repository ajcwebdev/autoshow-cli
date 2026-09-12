import { validateDeepinfraOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import { OcrStructuredResponseError } from '../../ocr-structured-response-error'
import type { DocumentMetadata } from '~/types'
import { createChatImageOcrRunner } from '~/cli/commands/text/ocr/ocr-utils/chat-image-ocr'
import {
  DEEPINFRA_OCR_IMAGE_BYTES,
  getDeepinfraOcrClientConfig
} from './deepinfra-ocr'

const DEEPINFRA_OCR_MAX_TOKENS = 4092
const DEEPINFRA_OCR_IMAGE_MIME_TYPES: Partial<Record<DocumentMetadata['format'], string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp'
}

const buildOcrPrompt = (): string => [
  'Perform OCR on the provided page image.',
  'Return only the text visible on the page.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If the page is blank or unreadable, return an empty string.'
].join(' ')

const runDeepinfraChatOcr = createChatImageOcrRunner({
  extractionMethod: 'deepinfra-ocr',
  service: 'deepinfra',
  providerLabel: 'DeepInfra OCR',
  maxImageBytes: DEEPINFRA_OCR_IMAGE_BYTES,
  imageLimitLabel: '20 MB',
  supportedMimeTypes: DEEPINFRA_OCR_IMAGE_MIME_TYPES,
  prompt: buildOcrPrompt(),
  errorMessagePrefix: 'DeepInfra OCR request failed',
  getConfig: getDeepinfraOcrClientConfig,
  buildBody: ({ model, messages, reasoningPolicy }) => ({
    model,
    max_tokens: model.startsWith('google/gemma-4-') ? 8192 : DEEPINFRA_OCR_MAX_TOKENS,
    ...(model.startsWith('google/gemma-4-') ? { reasoning_effort: reasoningPolicy.effective === 'disabled' ? 'none' : reasoningPolicy.effective === 'default' ? 'none' : reasoningPolicy.effective } : {}),
    messages
  }),
  checkResponse: (response, text, page) => {
    if (response.choices?.[0]?.finish_reason === 'length') throw new OcrStructuredResponseError(`DeepInfra OCR ${page} reached its output token limit.`, text)
  },
})

export const runDeepinfraOcr: typeof runDeepinfraChatOcr = async (...args) => {
  validateDeepinfraOcrModel(args[2])
  return await runDeepinfraChatOcr(...args)
}
