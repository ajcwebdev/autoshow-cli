export const openaiImage = {
  provider: 'openai',
  imageService: 'openai',
  envVarKey: 'OPENAI_API_KEY',
} as const

export const bflImage = {
  provider: 'bfl',
  imageService: 'bfl',
  envVarKey: 'BFL_API_KEY',
  imageExtension: 'jpg',
} as const

export const grokImage = {
  provider: 'grok',
  imageService: 'grok',
  envVarKey: 'XAI_API_KEY',
  imageExtension: 'jpg',
} as const

export const recraftImage = {
  provider: 'recraft',
  imageService: 'recraft',
  envVarKey: 'RECRAFT_API_TOKEN',
} as const

export const replicateImage = {
  provider: 'replicate',
  imageService: 'replicate',
  envVarKey: 'REPLICATE_API_TOKEN',
} as const

export const lumalabsImage = {
  provider: 'lumalabs',
  imageService: 'lumalabs',
  envVarKey: 'LUMA_AGENTS_API_KEY',
} as const
