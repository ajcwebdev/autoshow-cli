import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureDeepgramSttSetup = ensureApiKeySetup('DEEPGRAM_API_KEY', 'stt:deepgram', 'Deepgram transcription')
