import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureCartesiaTtsSetup = async (): Promise<void> => { resolveCredential('cartesia', 'require', { stage: 'tts:cartesia', description: 'Cartesia TTS' }) }
