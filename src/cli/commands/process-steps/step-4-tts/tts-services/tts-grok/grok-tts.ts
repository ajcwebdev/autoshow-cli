import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureGrokTtsSetup = async (): Promise<void> => { resolveCredential('grok', 'require', { stage: 'tts:grok', description: 'Grok TTS' }) }
