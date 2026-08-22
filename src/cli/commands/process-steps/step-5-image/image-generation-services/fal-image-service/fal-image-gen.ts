import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureFalImageGenSetup = async (): Promise<string> => requireProviderKey('fal', 'image:fal', 'fal.ai image generation')
