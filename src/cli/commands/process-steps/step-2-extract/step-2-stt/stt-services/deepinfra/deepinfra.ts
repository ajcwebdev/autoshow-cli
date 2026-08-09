import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureDeepinfraSttSetup = ensureApiKeySetup('DEEPINFRA_API_KEY', 'stt:deepinfra', 'DeepInfra transcription')
