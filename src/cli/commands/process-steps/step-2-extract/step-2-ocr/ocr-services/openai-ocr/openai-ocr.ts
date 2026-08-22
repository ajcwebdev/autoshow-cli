import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureOpenAIOcrSetup = ensureProvider('openai', 'ocr:openai', 'OpenAI OCR')
