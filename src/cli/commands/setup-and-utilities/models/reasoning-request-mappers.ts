import type { NormalizedReasoningEffort } from './reasoning-resolver'

const isNamedEffort = (
  effort: NormalizedReasoningEffort
): effort is Exclude<NormalizedReasoningEffort, 'default' | 'disabled'> =>
  effort !== 'default' && effort !== 'disabled'

const getRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

export const applyOpenAIResponsesReasoning = (
  requestBody: Record<string, unknown>,
  effective: NormalizedReasoningEffort
): void => {
  if (effective === 'disabled') {
    requestBody['reasoning'] = { effort: 'none' }
    return
  }

  if (isNamedEffort(effective)) {
    requestBody['reasoning'] = { effort: effective }
  }
}

export const applyAnthropicReasoning = (
  requestBody: Record<string, unknown>,
  effective: NormalizedReasoningEffort
): void => {
  if (effective === 'disabled') {
    requestBody['thinking'] = { type: 'disabled' }
    return
  }

  if (isNamedEffort(effective)) {
    requestBody['output_config'] = {
      ...getRecord(requestBody['output_config']),
      effort: effective
    }
  }
}
