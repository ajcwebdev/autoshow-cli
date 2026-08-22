import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureGroqSttSetup = async (): Promise<void> => { requireProviderKey('groq', 'stt:groq', 'Groq STT models') }
