import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureCartesiaTtsSetup = ensureApiKeySetup('CARTESIA_API_KEY', 'tts:cartesia', 'Cartesia TTS')
