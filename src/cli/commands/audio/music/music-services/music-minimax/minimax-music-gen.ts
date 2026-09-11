import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureMinimaxMusicGenSetup = async (): Promise<void> => { resolveCredential('minimax', 'require', { stage: 'music:minimax', description: 'MiniMax music generation' }) }
