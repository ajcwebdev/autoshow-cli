import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureOpenAIOcrSetup = async (): Promise<void> => { requireProviderKey('openai', 'ocr:openai', 'OpenAI OCR') }
