import type { LlmReasoningOptions, StructuredRequestOptions } from '~/types'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

/**
 * Resolves the reasoning policy for one LLM adapter and folds it back into the structured
 * request options. Every write-service adapter opened with a byte-identical copy of this,
 * differing only in the service name, so the fabricated default below — which is what a
 * caller gets when it passes no structured options at all — now has exactly one definition.
 */
export const resolveLlmReasoningOptions = (
  service: string,
  model: string,
  structuredOpts: StructuredRequestOptions | undefined
): LlmReasoningOptions => {
  const policy = resolveReasoningPolicy({
    step: 'llm',
    service,
    model,
    requestedReasoningEffort: structuredOpts?.requestedReasoningEffort
  })
  const updatedOpts: StructuredRequestOptions | undefined = structuredOpts
    ? { ...structuredOpts, requestedReasoningEffort: policy.requested, effectiveReasoningEffort: policy.effective }
    : {
        schemaName: '',
        schema: {},
        strict: false,
        strategy: 'native',
        requestedReasoningEffort: policy.requested,
        effectiveReasoningEffort: policy.effective
      }
  return { policy, updatedOpts }
}
