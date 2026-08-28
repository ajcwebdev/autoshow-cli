import type { MappedReasoningPolicy, NormalizedReasoningEffort, ReasoningCapabilities, ReasoningSupport } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { getModelRegistry } from './model-loader/registry'
import { formatQuotedChoiceList } from '~/utils/value-helpers'

export const NORMALIZED_REASONING_EFFORTS = [
  'default',
  'disabled',
  'minimal',
  'low',
  'medium',
  'high',
  'max'
] as const

export const isNormalizedReasoningEffort = (value: unknown): value is NormalizedReasoningEffort =>
  typeof value === 'string' && (NORMALIZED_REASONING_EFFORTS as readonly string[]).includes(value)

export const parseReasoningEffort = (value: string | undefined): NormalizedReasoningEffort | undefined => {
  if (value === undefined) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (isNormalizedReasoningEffort(normalized)) {
    return normalized as NormalizedReasoningEffort
  }
  throw UsageError(`Invalid --reasoning-effort value "${value}". Expected ${formatQuotedChoiceList(NORMALIZED_REASONING_EFFORTS)}.`)
}

const getReasoningCapabilities = (
  step: 'llm' | 'extract',
  service: string,
  model: string
): ReasoningCapabilities => {
  const modelMeta = getModelRegistry()[step][service]?.models[model]
  if (modelMeta?.reasoning) {
    return {
      support: modelMeta.reasoning.support as ReasoningSupport,
      ...(typeof modelMeta.reasoning.allowDisabled === 'boolean' ? { allowDisabled: modelMeta.reasoning.allowDisabled } : {}),
      ...(Array.isArray(modelMeta.reasoning.supportedEfforts)
        ? { supportedEfforts: modelMeta.reasoning.supportedEfforts as NormalizedReasoningEffort[] }
        : {})
    }
  }

  return { support: 'unsupported' }
}

const getAdapterDefaultReasoningEffort = (
  step: 'llm' | 'extract',
  service: string,
  model: string
): NormalizedReasoningEffort => {
  if (step === 'llm') {
    if (service === 'groq' && model.startsWith('openai/gpt-oss-')) {
      return 'low'
    }
    if (service === 'kimi') {
      return model === 'kimi-k3' ? 'low' : 'disabled'
    }
    if (service === 'glm') {
      return 'disabled'
    }
  }

  if (step === 'extract') {
    if (service === 'gemini' && /^gemini-3(?:[.-]|$)/i.test(model)) {
      return 'low'
    }
    if (service === 'kimi') {
      return model === 'kimi-k3' ? 'low' : 'disabled'
    }
  }

  return 'default'
}

export const resolveReasoningPolicy = (options: {
  step: 'llm' | 'extract'
  service: string
  model: string
  requestedReasoningEffort: NormalizedReasoningEffort | undefined
}): MappedReasoningPolicy => {
  const { step, service, model, requestedReasoningEffort } = options
  const capabilities = getReasoningCapabilities(step, service, model)
  const adapterDefault = getAdapterDefaultReasoningEffort(step, service, model)

  if (requestedReasoningEffort === undefined) {
    return {
      requested: undefined,
      effective: adapterDefault
    }
  }

  if (requestedReasoningEffort === 'default') {
    return {
      requested: 'default',
      effective: 'default'
    }
  }

  if (capabilities.support === 'unsupported') {
    throw UsageError(
      `Model "${model}" for ${service} does not support reasoning effort configuration.`
    )
  }

  if (requestedReasoningEffort === 'disabled') {
    if (capabilities.support === 'required' || capabilities.allowDisabled !== true) {
      throw UsageError(
        `Model "${model}" for ${service} does not support disabling reasoning.`
      )
    }
    return {
      requested: 'disabled',
      effective: 'disabled'
    }
  }

  const supportedEfforts = capabilities.supportedEfforts ?? []
  if (!supportedEfforts.includes(requestedReasoningEffort)) {
    const supportedDescription = supportedEfforts.length > 0
      ? `Supported effort levels: ${supportedEfforts.join(', ')}.`
      : 'This model exposes no named effort levels.'
    throw UsageError(
      `Model "${model}" for ${service} does not support reasoning effort "${requestedReasoningEffort}". ${supportedDescription}`
    )
  }

  return {
    requested: requestedReasoningEffort,
    effective: requestedReasoningEffort
  }
}
