import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureDeepinfraSttSetup = async (): Promise<void> => { requireProviderKey('deepinfra', 'stt:deepinfra', 'DeepInfra transcription') }
