import { ensureProvider } from '~/utils/validate/env-utils'

export const ANTHROPIC_OCR_LIMIT_SOURCE = 'project/links/claude-general-ocr-text-links.md'
export const ANTHROPIC_OCR_IMAGE_BYTES = 5 * 1024 * 1024
export const ANTHROPIC_OCR_FILES_UPLOAD_BYTES = 500 * 1024 * 1024

export const ANTHROPIC_OCR_FILES_BETA = 'files-api-2025-04-14'
export const ANTHROPIC_OCR_MAX_TOKENS = 64000

export const ensureAnthropicOcrSetup = ensureProvider('anthropic', 'ocr:anthropic', 'Anthropic OCR')
