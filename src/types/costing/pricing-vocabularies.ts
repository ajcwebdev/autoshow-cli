export const COST_SOURCES = [
  'provider_usage',
  'provider_quote',
  'response_header',
  'computed_usage',
  'registry_fallback',
  'partial_provider_usage',
  'heuristic',
  'local_zero'
] as const

export type CostSource = typeof COST_SOURCES[number]

const COST_SOURCE_SET = new Set<string>(COST_SOURCES)

export const isCostSource = (value: unknown): value is CostSource =>
  typeof value === 'string' && COST_SOURCE_SET.has(value)

export const TOKEN_PRICED_OCR_PROVIDERS = [
  'glm',
  'kimi',
  'openai',
  'grok',
  'anthropic',
  'gemini',
  'deepinfra'
] as const

export type TokenPricedOcrProvider = typeof TOKEN_PRICED_OCR_PROVIDERS[number]

const TOKEN_PRICED_OCR_PROVIDER_SET = new Set<string>(TOKEN_PRICED_OCR_PROVIDERS)

export const isTokenPricedOcrProvider = (value: unknown): value is TokenPricedOcrProvider =>
  typeof value === 'string' && TOKEN_PRICED_OCR_PROVIDER_SET.has(value)
