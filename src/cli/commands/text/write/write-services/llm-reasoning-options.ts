import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { UsageError } from '~/utils/error-handler'
import type { LlmReasoningOptions, StructuredRequestOptions } from '~/types'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

export const resolveLlmReasoningOptions = (
  service: string,
  model: string,
  structuredOpts: StructuredRequestOptions | undefined
): LlmReasoningOptions => {
  if (!getModelRegistry().llm[service]?.models[model]) throw UsageError(`Unsupported write model ${service}/${model}. Select an active model explicitly.`)
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
