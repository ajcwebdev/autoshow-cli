import { validateDeepinfraOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import { OcrOutputLimitError } from '../../ocr-structured-response-error'
import type { DocumentMetadata } from '~/types'
import { createChatImageOcrRunner } from '~/cli/commands/text/ocr/ocr-utils/chat-image-ocr'
import {
  DEEPINFRA_OCR_IMAGE_BYTES,
  getDeepinfraOcrClientConfig
} from './deepinfra-ocr'

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
    max_tokens: 8192,
    reasoning_effort: reasoningPolicy.effective === 'disabled' || reasoningPolicy.effective === 'default' ? 'none' : reasoningPolicy.effective,
    messages
  }),
  checkResponse: (response, text, page) => {
    if (response.choices?.[0]?.finish_reason === 'length') throw new OcrOutputLimitError(`DeepInfra OCR ${page} reached its output token limit.`, text)
  },
})

export const runDeepinfraOcr: typeof runDeepinfraChatOcr = async (...args) => {
  validateDeepinfraOcrModel(args[2])
  return await runDeepinfraChatOcr(...args)
}
