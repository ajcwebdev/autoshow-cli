import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureTogetherSttSetup = async (): Promise<void> => { requireProviderKey('together', 'stt:together', 'Together transcription') }
