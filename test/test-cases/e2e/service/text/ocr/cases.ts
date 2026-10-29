export const hostedOcrImageInput = 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png'

export const mistralOcr = {
  provider: 'mistral',
  extractionMethod: 'mistral-ocr',
  imageExtractionMethod: 'image+mistral-ocr',
  envVarKey: 'MISTRAL_API_KEY',
} as const

export const openaiOcr = {
  provider: 'openai',
  extractionMethod: 'openai-ocr',
  imageExtractionMethod: 'image+openai-ocr',
  envVarKey: 'OPENAI_API_KEY',
} as const

export const anthropicOcr = {
  provider: 'anthropic',
  extractionMethod: 'anthropic-ocr',
  imageExtractionMethod: 'image+anthropic-ocr',
  envVarKey: 'ANTHROPIC_API_KEY',
} as const

export const geminiOcr = {
  provider: 'gemini',
  extractionMethod: 'gemini-ocr',
  imageExtractionMethod: 'image+gemini-ocr',
  envVarKey: 'GEMINI_API_KEY',
} as const

export const grokOcr = {
  provider: 'grok',
  extractionMethod: 'grok-ocr',
  imageExtractionMethod: 'image+grok-ocr',
  envVarKey: 'XAI_API_KEY',
  inputMode: 'image-only',
  imageInput: hostedOcrImageInput,
  assertProviderMetadata: true,
} as const
