import { requireProviderKey } from '~/utils/validate/env-utils'

export const ANTHROPIC_OCR_LIMIT_SOURCE = 'https://platform.claude.com/docs/en/build-with-claude/pdf-support.md'
export const ANTHROPIC_OCR_IMAGE_BYTES = 5 * 1024 * 1024
export const ANTHROPIC_OCR_FILES_UPLOAD_BYTES = 500 * 1024 * 1024

export const ANTHROPIC_OCR_FILES_BETA = 'files-api-2025-04-14'
export const ANTHROPIC_OCR_MAX_TOKENS = 64000

export const ensureAnthropicOcrSetup = async (): Promise<void> => { requireProviderKey('anthropic', 'ocr:anthropic', 'Anthropic OCR') }
