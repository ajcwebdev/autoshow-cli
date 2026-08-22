import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureCartesiaTtsSetup = ensureProvider('cartesia', 'tts:cartesia', 'Cartesia TTS')
