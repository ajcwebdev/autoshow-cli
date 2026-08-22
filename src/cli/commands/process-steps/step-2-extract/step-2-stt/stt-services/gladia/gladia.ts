import { GLADIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireProviderKey } from '~/utils/validate/env-utils'

export const getGladiaBaseUrl = (): string => GLADIA_DEFAULT_BASE_URL

export const ensureGladiaSttSetup = async (): Promise<void> => { requireProviderKey('gladia', 'stt:gladia', 'Gladia transcription') }
