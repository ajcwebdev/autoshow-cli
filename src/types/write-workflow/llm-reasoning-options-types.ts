import type { MappedReasoningPolicy, StructuredRequestOptions } from '~/types'

export type LlmReasoningOptions = {
  policy: MappedReasoningPolicy
  updatedOpts: StructuredRequestOptions | undefined
}
