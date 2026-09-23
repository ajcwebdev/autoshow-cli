export type NormalizedReasoningEffort =
  (typeof import('~/cli/commands/setup-and-utilities/models/reasoning-efforts').NORMALIZED_REASONING_EFFORTS)[number]

export type ReasoningSupport = 'unsupported' | 'optional' | 'required'

export type ReasoningCapabilities = {
  support: ReasoningSupport
  allowDisabled?: boolean | undefined
  supportedEfforts?: NormalizedReasoningEffort[] | undefined
}

export type MappedReasoningPolicy = {
  requested: NormalizedReasoningEffort | undefined
  effective: NormalizedReasoningEffort
}
