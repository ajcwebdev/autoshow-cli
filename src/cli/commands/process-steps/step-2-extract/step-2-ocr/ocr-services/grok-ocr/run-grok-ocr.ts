import type { DocumentMetadata } from '~/types'
import { createChatImageOcrRunner } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/chat-image-ocr'
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
  service: 'grok',
  extractionMethod: 'grok-ocr',
  tempDirPrefix: 'autoshow-grok-ocr-',
  providerLabel: 'Grok OCR',
  maxImageBytes: GROK_OCR_IMAGE_BYTES,
  imageLimitLabel: '20 MiB',
  supportedMimeTypes: GROK_OCR_IMAGE_MIME_TYPES,
  prompt: buildOcrPrompt(),
  errorMessagePrefix: 'Grok OCR request failed',
  getConfig: getGrokOcrClientConfig,
  buildBody: ({ model, messages }) => ({
    model,
    max_completion_tokens: GROK_OCR_MAX_COMPLETION_TOKENS,
    messages
  })
})
