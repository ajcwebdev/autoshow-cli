import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureMinimaxMusicGenSetup = ensureProvider('minimax', 'music:minimax', 'MiniMax music generation')
