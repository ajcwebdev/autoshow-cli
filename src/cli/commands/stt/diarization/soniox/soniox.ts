import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureSonioxSttSetup = async (): Promise<void> => { resolveCredential('soniox', 'require', { stage: 'stt:soniox', description: 'Soniox transcription' }) }
