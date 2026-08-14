import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const FAL_OCR_LIMIT_SOURCE = 'https://fal.ai/models/fal-ai/florence-2-large/ocr/api'
export const ensureFalOcrSetup = ensureApiKeySetup('FAL_API_KEY', 'ocr:fal', 'fal.ai OCR')
