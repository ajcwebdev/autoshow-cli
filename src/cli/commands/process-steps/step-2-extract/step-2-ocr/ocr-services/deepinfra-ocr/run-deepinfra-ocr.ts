import type { DocumentMetadata } from '~/types'
import { createChatImageOcrRunner } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/chat-image-ocr'
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

export const runDeepinfraOcr = createChatImageOcrRunner({
  extractionMethod: 'deepinfra-ocr',
  service: 'deepinfra',
  providerLabel: 'DeepInfra OCR',
  maxImageBytes: DEEPINFRA_OCR_IMAGE_BYTES,
  imageLimitLabel: '20 MB',
  supportedMimeTypes: DEEPINFRA_OCR_IMAGE_MIME_TYPES,
  prompt: buildOcrPrompt(),
  errorMessagePrefix: 'DeepInfra OCR request failed',
  getConfig: getDeepinfraOcrClientConfig,
  buildBody: ({ model, messages }) => ({
    model,
    max_tokens: DEEPINFRA_OCR_MAX_TOKENS,
    messages
  })
})
