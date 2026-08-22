import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureMinimaxMusicGenSetup = async (): Promise<void> => { requireProviderKey('minimax', 'music:minimax', 'MiniMax music generation') }
