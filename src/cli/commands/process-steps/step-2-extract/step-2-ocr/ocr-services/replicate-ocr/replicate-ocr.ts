import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureReplicateOcrSetup = async (): Promise<void> => { requireProviderKey('replicate', 'ocr:replicate', 'Replicate OCR') }
