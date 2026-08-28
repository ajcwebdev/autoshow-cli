import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runAnthropicCompatibleModel } from '../anthropic-compatible'
import { getAnthropicClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-anthropic/anthropic-utils'
import { resolveLlmReasoningOptions } from '../llm-reasoning-options'

export const runAnthropicModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const { updatedOpts } = resolveLlmReasoningOptions('anthropic', model, structuredOpts)

  return await runAnthropicCompatibleModel({
    prompt,
    model,
    structuredOpts: updatedOpts,
    config: getAnthropicClientConfig,
    service: 'anthropic',
    providerLabel: 'Anthropic',
    operationName: 'anthropic-llm',
    supportsStructuredOutput: true
  })
}
