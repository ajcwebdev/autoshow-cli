import type { LlmApiCallResult, Step3Metadata, StructuredRequestOptions } from '~/types'
import { executeLlmRequest } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-request-scaffold'
import { classifyFetchRetry } from '~/utils/retries'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { applyOpenAIResponsesReasoning } from '~/cli/commands/setup-and-utilities/models/reasoning-request-mappers'

export const runOpenAIModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const policy = resolveReasoningPolicy({
    step: 'llm',
    service: 'openai',
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

  return await executeLlmRequest(prompt, model, updatedOpts, {
    service: 'openai',
    providerLabel: 'OpenAI',
    operationName: 'openai-llm',
    emptyResponseStage: 'write:openai',
    classifier: (error) => classifyFetchRetry(error, 'runtime_http_create_conservative'),
    prepare: getOpenAIClientConfig,
    execute: async (createSignal, config): Promise<LlmApiCallResult> => {
      const requestBody: Record<string, unknown> = {
        model,
        input: prompt,
        stream: false
      }

      applyOpenAIResponsesReasoning(requestBody, policy.effective)

      if (structuredOpts && Object.keys(structuredOpts.schema ?? {}).length > 0) {
        requestBody['text'] = {
          format: {
            type: 'json_schema',
            name: structuredOpts.schemaName,
            schema: structuredOpts.schema,
            strict: structuredOpts.strict
          }
        }
      }

      const response = await createOpenAIResponse(config, requestBody, {
        signal: createSignal()
      })

      const text = extractOpenAIResponseText(response) ?? ''
      return {
        text,
        usage: response.usage,
        rawProviderUsage: response.usage,
        returnedModel: response.model
      }
    }
  })
}
