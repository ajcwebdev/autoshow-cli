import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureTogetherSttSetup = ensureApiKeySetup('TOGETHER_API_KEY', 'stt:together', 'Together transcription')
