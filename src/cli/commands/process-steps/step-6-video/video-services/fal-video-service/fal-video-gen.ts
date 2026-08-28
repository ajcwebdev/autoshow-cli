import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureFalVideoGenSetup = async (): Promise<string> => resolveCredential('fal', 'require', { stage: 'video:fal', description: 'fal.ai video generation' })
