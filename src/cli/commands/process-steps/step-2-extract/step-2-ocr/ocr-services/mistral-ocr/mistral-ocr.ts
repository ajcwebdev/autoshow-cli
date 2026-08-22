import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureMistralOcrSetup = async (): Promise<void> => { requireProviderKey('mistral', 'ocr:mistral', 'Mistral OCR') }
