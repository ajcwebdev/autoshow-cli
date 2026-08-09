import { requireApiKey } from '~/utils/validate/env-utils'

export const ensureFalVideoGenSetup = async (): Promise<string> => requireApiKey('FAL_API_KEY', 'video:fal', 'fal.ai video generation')
