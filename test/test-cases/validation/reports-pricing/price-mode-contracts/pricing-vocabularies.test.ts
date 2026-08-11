import { describe, expect, test } from 'bun:test'
import {
  COST_SOURCES,
  isCostSource,
  isTokenPricedOcrProvider,
  TOKEN_PRICED_OCR_PROVIDERS
} from '~/types'
import type { CostSource, TokenPricedOcrProvider } from '~/types'

const EXPECTED_COST_SOURCES = [
  'provider_usage',
  'provider_quote',
  'response_header',
  'computed_usage',
  'registry_fallback',
  'partial_provider_usage',
  'heuristic',
  'local_zero'
] as const satisfies readonly CostSource[]

const EXPECTED_TOKEN_PRICED_OCR_PROVIDERS = [
  'glm',
  'kimi',
  'openai',
  'grok',
  'anthropic',
  'gemini',
  'deepinfra'
] as const satisfies readonly TokenPricedOcrProvider[]

describe('pricing vocabulary contracts', () => {
  test('cost-source tuple, type, and guard remain one complete vocabulary', () => {
    expect(COST_SOURCES).toEqual(EXPECTED_COST_SOURCES)
    expect(new Set(COST_SOURCES).size).toBe(COST_SOURCES.length)
    expect(COST_SOURCES.every(isCostSource)).toBe(true)
    expect(isCostSource('unknown')).toBe(false)
  })

  test('token-priced OCR tuple, type, and guard remain one complete vocabulary', () => {
    expect(TOKEN_PRICED_OCR_PROVIDERS).toEqual(EXPECTED_TOKEN_PRICED_OCR_PROVIDERS)
    expect(new Set(TOKEN_PRICED_OCR_PROVIDERS).size).toBe(TOKEN_PRICED_OCR_PROVIDERS.length)
    expect(TOKEN_PRICED_OCR_PROVIDERS.every(isTokenPricedOcrProvider)).toBe(true)
    expect(isTokenPricedOcrProvider('mistral')).toBe(false)
  })
})
