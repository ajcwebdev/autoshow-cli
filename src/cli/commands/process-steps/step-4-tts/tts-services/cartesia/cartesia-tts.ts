import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureCartesiaTtsSetup = async (): Promise<void> => { requireProviderKey('cartesia', 'tts:cartesia', 'Cartesia TTS') }
