import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureGeminiSttSetup = async (): Promise<void> => { resolveCredential('gemini', 'require', { stage: 'stt:gemini', description: 'Gemini transcription' }) }
