import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureSonioxSttSetup = async (): Promise<void> => { requireProviderKey('soniox', 'stt:soniox', 'Soniox transcription') }
