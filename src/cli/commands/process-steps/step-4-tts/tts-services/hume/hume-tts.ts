import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureHumeTtsSetup = async (): Promise<void> => { requireProviderKey('hume', 'tts:hume', 'Hume TTS') }
