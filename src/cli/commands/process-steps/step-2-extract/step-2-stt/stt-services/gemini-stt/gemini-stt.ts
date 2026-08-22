import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureGeminiSttSetup = async (): Promise<void> => { requireProviderKey('gemini', 'stt:gemini', 'Gemini transcription') }
