import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureMistralOcrSetup = ensureApiKeySetup('MISTRAL_API_KEY', 'ocr:mistral', 'Mistral OCR')
