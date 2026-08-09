import { requireApiKey } from '~/utils/validate/env-utils'

export const ensureFalImageGenSetup = async (): Promise<string> => requireApiKey('FAL_API_KEY', 'image:fal', 'fal.ai image generation')
