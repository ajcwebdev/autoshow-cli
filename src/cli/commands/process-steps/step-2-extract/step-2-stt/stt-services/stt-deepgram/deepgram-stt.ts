import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureDeepgramSttSetup = async (): Promise<void> => { requireProviderKey('deepgram', 'stt:deepgram', 'Deepgram transcription') }
