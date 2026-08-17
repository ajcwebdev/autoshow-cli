import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureReplicateOcrSetup = ensureApiKeySetup('REPLICATE_API_TOKEN', 'ocr:replicate', 'Replicate OCR')
