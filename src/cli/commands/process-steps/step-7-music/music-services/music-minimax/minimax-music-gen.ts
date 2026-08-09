import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureMinimaxMusicGenSetup = ensureApiKeySetup('MINIMAX_API_KEY', 'music:minimax', 'MiniMax music generation')
