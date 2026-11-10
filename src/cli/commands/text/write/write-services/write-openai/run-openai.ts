import type { LlmApiCallResult, Step3Metadata, StructuredRequestOptions } from '~/types'
import { executeLlmRequest } from '~/cli/commands/text/write/write-utils/llm-request-scaffold'
import { classifyFetchRetry } from '~/utils/retries'
import { getOpenAIClientConfig } from '~/cli/commands/text/write/write-services/write-openai/openai-utils'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { applyOpenAIResponsesReasoning } from '~/cli/commands/setup-and-utilities/models/reasoning-request-mappers'
import { resolveLlmReasoningOptions } from '../llm-reasoning-options'
import { llmRequestSettings } from '~/cli/commands/text/write/write-utils/llm-request-settings'
import { isAppError, ValidationError } from '~/utils/error-handler'
import { isRecord } from '~/utils/value-helpers'

export const runOpenAIModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const { policy, updatedOpts } = resolveLlmReasoningOptions('openai', model, structuredOpts)

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

      const requestSettings = llmRequestSettings(requestBody)
      const responseEvidence = {
        rawResponse: response,
        requestedModel: model,
        ...(isRecord(response) ? { rawProviderUsage: response['usage'], returnedModel: response['model'] } : {}),
        requestSettings
      }
      if (!isRecord(response) || (response.output !== undefined && !Array.isArray(response.output))) {
        throw ValidationError('OpenAI returned a malformed Responses envelope.', {
          stage: 'write:openai', retryable: false, metadata: responseEvidence
        })
      }
      let text: string | undefined
      try {
        text = extractOpenAIResponseText(response)
      } catch (error) {
        if (isAppError(error)) {
          Object.assign(error.metadata, responseEvidence)
        }
        throw error
      }
      if (!text?.trim()) {
        throw ValidationError('OpenAI returned no response text from model.', {
          stage: 'write:openai',
          retryable: false,
          metadata: responseEvidence
        })
      }
      return {
        text,
        usage: response.usage,
        rawProviderUsage: response.usage,
        returnedModel: response.model,
        requestSettings
      }
    }
  })
}
