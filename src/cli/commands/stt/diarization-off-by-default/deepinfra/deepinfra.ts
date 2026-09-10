import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureDeepinfraSttSetup = async (): Promise<void> => { resolveCredential('deepinfra', 'require', { stage: 'stt:deepinfra', description: 'DeepInfra transcription' }) }
