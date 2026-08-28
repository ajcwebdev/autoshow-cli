import { GLADIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { resolveCredential } from '~/utils/validate/env-utils'

export const getGladiaBaseUrl = (): string => GLADIA_DEFAULT_BASE_URL

export const ensureGladiaSttSetup = async (): Promise<void> => { resolveCredential('gladia', 'require', { stage: 'stt:gladia', description: 'Gladia transcription' }) }
