import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureGroqSttSetup = async (): Promise<void> => { resolveCredential('groq', 'require', { stage: 'stt:groq', description: 'Groq STT models' }) }
