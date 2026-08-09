import type { LLMService, ProviderStructuredCapability, StructuredStrategy } from '~/types'

const CAPABILITIES: Record<LLMService, ProviderStructuredCapability> = {
  'openai': {
    nativeStructuredOutput: true,
    strictMode: true,
    validationRetryBudget: 0
  },
  'groq': {
    nativeStructuredOutput: true,
    strictMode: true,
    validationRetryBudget: 0
  },
  'anthropic': {
    nativeStructuredOutput: true,
    strictMode: false,
    validationRetryBudget: 1
  },
  'gemini': {
    nativeStructuredOutput: true,
    strictMode: false,
    validationRetryBudget: 1
  },
  'minimax': {
    nativeStructuredOutput: false,
    strictMode: false,
    validationRetryBudget: 2
  },
  'grok': {
    nativeStructuredOutput: true,
    strictMode: true,
    validationRetryBudget: 0
  },
  'glm': {
    nativeStructuredOutput: true,
    strictMode: false,
    validationRetryBudget: 1
  },
  'kimi': {
    nativeStructuredOutput: true,
    strictMode: false,
    validationRetryBudget: 1
  },
  'together': {
    nativeStructuredOutput: true,
    strictMode: true,
    validationRetryBudget: 1
  },
  'cerebras': {
    nativeStructuredOutput: true,
    strictMode: true,
    validationRetryBudget: 1
  },
  'llama.cpp': {
    nativeStructuredOutput: true,
    strictMode: false,
    validationRetryBudget: 2
  },
  'llamafile': {
    nativeStructuredOutput: true,
    strictMode: false,
    validationRetryBudget: 2
  }
}

export const resolveStructuredStrategy = (service: LLMService): StructuredStrategy => {
  return CAPABILITIES[service].nativeStructuredOutput ? 'native' : 'schema-guided'
}

export const shouldApplyStrictMode = (
  service: LLMService,
  requestedStrict: boolean
): boolean => {
  return requestedStrict && CAPABILITIES[service].strictMode
}

export const resolveValidationRetryBudget = (service: LLMService): number => {
  return CAPABILITIES[service].validationRetryBudget
}
