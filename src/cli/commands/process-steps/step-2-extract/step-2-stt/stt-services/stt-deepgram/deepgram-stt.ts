import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureDeepgramSttSetup = async (): Promise<void> => { resolveCredential('deepgram', 'require', { stage: 'stt:deepgram', description: 'Deepgram transcription' }) }
