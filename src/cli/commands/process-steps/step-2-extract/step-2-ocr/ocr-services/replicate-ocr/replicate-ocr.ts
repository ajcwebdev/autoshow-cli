import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureReplicateOcrSetup = ensureProvider('replicate', 'ocr:replicate', 'Replicate OCR')
