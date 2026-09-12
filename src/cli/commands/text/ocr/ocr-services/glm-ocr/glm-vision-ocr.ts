import type { ChatImageOcrBodyInput } from '~/types'
import { createChatImageOcrRunner } from '../../ocr-utils/chat-image-ocr'
import { OcrStructuredResponseError } from '../../ocr-structured-response-error'
import { ensureGlmApiKey, resolveGlmBaseUrl } from './glm'

export const buildGlmVisionOcrBody = ({ model, messages, reasoningPolicy }: ChatImageOcrBodyInput): Record<string, unknown> => ({
  model,
  messages,
  stream: false,
  max_tokens: 32768,
  thinking: { type: 'enabled' },
  ...(reasoningPolicy.effective !== 'default' ? { reasoning_effort: reasoningPolicy.effective } : {}),
})

export const runGlmVisionOcr = createChatImageOcrRunner({
  service: 'glm',
  extractionMethod: 'glm-ocr',
  providerLabel: 'GLM Flash vision OCR',
  // Deliberately bounded by AutoShow below the host's image limit, one rendered page per request.
  maxImageBytes: 10 * 1024 * 1024,
  imageLimitLabel: '10 MB AutoShow limit',
  supportedMimeTypes: { png: 'image/png', jpg: 'image/jpeg' },
  prompt: 'Transcribe only visible text from this single page. Preserve reading order and paragraph boundaries. Do not summarize, translate, explain, or emit reasoning. Return an empty string for a blank page.',
  errorMessagePrefix: 'GLM Flash vision OCR request failed',
  getConfig: () => ({ apiKey: ensureGlmApiKey('GLM Flash vision OCR', 'ocr:glm'), baseURL: resolveGlmBaseUrl() }),
  buildBody: buildGlmVisionOcrBody,
  checkResponse: (response, text, page) => {
    if (response.choices?.[0]?.finish_reason === 'length') throw new OcrStructuredResponseError(`GLM Flash OCR ${page} reached its output token limit.`, text)
  },
})
