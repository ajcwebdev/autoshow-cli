import type { ComputeEstimatedProcessingTimesInput } from '~/types'
import { isHostedOcrTimingProvider } from './timing-shared'

type ExtractTarget = NonNullable<ComputeEstimatedProcessingTimesInput['extractTargets']>[number]

const LEGACY_OCR_TARGET_FIELDS = [
  { provider: 'mistral', field: 'mistralOcrModels' },
  { provider: 'glm', field: 'glmOcrModels' },
  { provider: 'kimi', field: 'kimiOcrModels' },
  { provider: 'openai', field: 'openaiOcrModels' },
  { provider: 'grok', field: 'grokOcrModels' },
  { provider: 'anthropic', field: 'anthropicOcrModels' },
  { provider: 'gemini', field: 'geminiOcrModels' },
  { provider: 'deepinfra', field: 'deepinfraOcrModels' }
] as const

export const resolveExtractTimingTargets = (
  input: ComputeEstimatedProcessingTimesInput
): ExtractTarget[] => {
  if (input.extractTargets && input.extractTargets.length > 0) return input.extractTargets
  if (typeof input.extractPageCount !== 'number') return []
  return LEGACY_OCR_TARGET_FIELDS.flatMap(({ provider, field }) => {
    const model = input[field]?.[0]
    return model ? [{ provider, model, pageCount: input.extractPageCount as number }] : []
  })
}

export const countHostedExtractTargetsByProvider = (
  targets: readonly ExtractTarget[]
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>()
  for (const target of targets) {
    if (isHostedOcrTimingProvider(target.provider)) {
      counts.set(target.provider, (counts.get(target.provider) ?? 0) + 1)
    }
  }
  return counts
}
