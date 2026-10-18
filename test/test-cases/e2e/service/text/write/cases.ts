export const openaiWrite = {
  provider: 'openai',
  llmService: 'openai',
  requiresEnvVar: { key: 'OPENAI_API_KEY', description: 'OpenAI models' },
} as const

export const anthropicWrite = {
  provider: 'anthropic',
  llmService: 'anthropic',
  requiresEnvVar: { key: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude models' },
} as const

export const geminiWrite = {
  provider: 'gemini',
  llmService: 'gemini',
  requiresEnvVar: { key: 'GEMINI_API_KEY', description: 'Gemini API' },
} as const

export const minimaxWrite = {
  provider: 'minimax',
  llmService: 'minimax',
  requiresEnvVar: { key: 'MINIMAX_API_KEY', description: 'MiniMax models' },
} as const

export const grokWrite = {
  provider: 'grok',
  llmService: 'grok',
  requiresEnvVar: { key: 'XAI_API_KEY', description: 'Grok models' },
} as const
