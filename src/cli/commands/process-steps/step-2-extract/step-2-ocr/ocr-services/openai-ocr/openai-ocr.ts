import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureOpenAIOcrSetup = ensureApiKeySetup('OPENAI_API_KEY', 'ocr:openai', 'OpenAI OCR')
