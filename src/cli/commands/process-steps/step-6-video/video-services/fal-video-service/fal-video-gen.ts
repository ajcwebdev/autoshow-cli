import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureFalVideoGenSetup = async (): Promise<string> => requireProviderKey('fal', 'video:fal', 'fal.ai video generation')
