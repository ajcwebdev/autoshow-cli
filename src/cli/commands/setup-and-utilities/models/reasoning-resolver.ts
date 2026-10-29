import type { MappedReasoningPolicy, NormalizedReasoningEffort, ReasoningCapabilities, ReasoningSupport } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { getModelRegistry } from './model-loader/registry'
import { getRetiredModelReplacement } from './model-loader/retired-model-rates'
import { formatModelSelector } from './model-validation'
import { formatQuotedChoiceList } from '~/utils/value-helpers'

import { NORMALIZED_REASONING_EFFORTS } from './reasoning-efforts'
export { NORMALIZED_REASONING_EFFORTS } from './reasoning-efforts'

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
  if (step === 'extract') {
    if (service === 'gemini' && /^gemini-3(?:[.-]|$)/i.test(model)) {
      return 'low'
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
  if (['glm', 'kimi'].includes(service) || (step === 'llm' && service === 'together')) {
    throw UsageError(`Provider "${service}" is no longer supported for ${step === 'llm' ? 'writing' : 'OCR'}. Select an active provider explicitly. AutoShow will not silently substitute a different model identity.`)
  }
  const replacement = getRetiredModelReplacement(step, service, model)
  if (replacement !== undefined && getModelRegistry()[step][service]?.models[model] === undefined) {
    const selector = formatModelSelector(step === 'extract' ? `${service}-ocr` : service)
    throw UsageError(
      `Model "${model}" is retired for ${selector}. Use "${replacement}" instead. AutoShow will not silently substitute a different model identity.`
    )
  }
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
