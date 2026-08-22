import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureGrokTtsSetup = async (): Promise<void> => { requireProviderKey('grok', 'tts:grok', 'Grok TTS') }
