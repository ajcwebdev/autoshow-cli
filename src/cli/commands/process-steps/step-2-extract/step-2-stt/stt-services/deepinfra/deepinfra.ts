import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureDeepinfraSttSetup = ensureProvider('deepinfra', 'stt:deepinfra', 'DeepInfra transcription')
