import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureMistralOcrSetup = ensureProvider('mistral', 'ocr:mistral', 'Mistral OCR')
