import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureTogetherSttSetup = async (): Promise<void> => { resolveCredential('together', 'require', { stage: 'stt:together', description: 'Together transcription' }) }
