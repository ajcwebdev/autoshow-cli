import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureDeepgramSttSetup = ensureProvider('deepgram', 'stt:deepgram', 'Deepgram transcription')
