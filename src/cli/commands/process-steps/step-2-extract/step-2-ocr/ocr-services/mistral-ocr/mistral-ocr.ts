import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureMistralOcrSetup = async (): Promise<void> => { resolveCredential('mistral', 'require', { stage: 'ocr:mistral', description: 'Mistral OCR' }) }
