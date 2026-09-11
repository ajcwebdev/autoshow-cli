import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureOpenAIOcrSetup = async (): Promise<void> => { resolveCredential('openai', 'require', { stage: 'ocr:openai', description: 'OpenAI OCR' }) }
