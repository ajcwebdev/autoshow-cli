export const elevenlabsMusic = {
  provider: 'elevenlabs',
  musicService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
} as const

export const minimaxMusic = {
  provider: 'minimax',
  musicService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
} as const

export const geminiMusic = {
  provider: 'gemini',
  musicService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
} as const
