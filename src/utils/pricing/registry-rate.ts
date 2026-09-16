import { InternalError } from '~/utils/error-handler'

export type RegistryRateContext = {
  category: string
  service: string
  model: string
  field: string
}

/**
 * The JSON model registries are the only source of provider rates. A missing rate means the registry
 * and the estimator have drifted, so fail loudly rather than quoting a stale hardcoded number.
 */
export const requireRegistryRate = (
  value: number | undefined,
  context: RegistryRateContext
): number => {
  if (typeof value !== 'number') {
    throw InternalError(
      `Missing ${context.field} for ${context.service}/${context.model} in the ${context.category} model registry.`,
      { stage: `${context.category}:pricing`, metadata: { ...context } }
    )
  }
  return value
}
