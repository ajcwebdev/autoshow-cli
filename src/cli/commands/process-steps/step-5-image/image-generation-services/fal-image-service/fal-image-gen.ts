import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureFalImageGenSetup = async (): Promise<string> => resolveCredential('fal', 'require', { stage: 'image:fal', description: 'fal.ai image generation' })
