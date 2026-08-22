import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureSpeechifyTtsSetup = async (): Promise<void> => { requireProviderKey('speechify', 'tts:speechify', 'Speechify TTS') }
