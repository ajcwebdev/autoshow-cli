import { executeLlmRequest } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-request-scaffold'
import { isStructuredFallbackError } from '~/cli/commands/process-steps/step-3-write/write-utils/structured-error-utils'
import type { LlmApiCallResult, OpenAICompatibleChatService, OpenAIRestConfig, RunOpenAICompatibleChatModelOptions, Step3Metadata, StructuredRequestOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createOpenAIChatCompletion, extractOpenAIChatCompletionText } from '~/utils/openai/openai-client'
import { classifyFetchRetry } from '~/utils/retries'
import { resolveCredential } from '~/utils/validate/env-utils'
import { resolveLlmReasoningOptions } from './llm-reasoning-options'

export const runOpenAICompatibleChatModel = async ({
  prompt,
  model,
  structuredOpts,
  config,
  service,
  providerLabel,
  operationName,
  customizeRequestBody,
  buildStructuredResponseFormat
}: RunOpenAICompatibleChatModelOptions): Promise<{ result: string, metadata: Step3Metadata }> => {
  return await executeLlmRequest<OpenAIRestConfig>(prompt, model, structuredOpts, {
    service,
    providerLabel,
    operationName,
    emptyResponseStage: 'write:openai-chat',
    classifier: (error) => classifyFetchRetry(error, 'runtime_http_create_conservative'),
    prepare: () => typeof config === 'function' ? config() : config,
    execute: async (createSignal, resolvedConfig) => {
      const requestBody: Record<string, unknown> = {
        model,
        messages: [{ role: 'user', content: prompt }]
      }
      customizeRequestBody?.(requestBody, model)

      const executeRequest = async (body: Record<string, unknown>): Promise<LlmApiCallResult> => {
        const response = await createOpenAIChatCompletion(resolvedConfig, body, {
          signal: createSignal()
        })

        const text = extractOpenAIChatCompletionText(response) ?? ''
        return {
          text,
          usage: response.usage,
          rawProviderUsage: response.usage,
          returnedModel: response.model
        }
      }

      if (!structuredOpts || Object.keys(structuredOpts.schema).length === 0) {
        return await executeRequest(requestBody)
      }

      const structuredRequestBody: Record<string, unknown> = {
        ...requestBody,
        response_format: buildStructuredResponseFormat?.(structuredOpts) ?? {
          type: 'json_schema',
          json_schema: {
            name: structuredOpts.schemaName,
            schema: structuredOpts.schema,
            strict: structuredOpts.strict
          }
        }
      }

      try {
        return await executeRequest(structuredRequestBody)
      } catch (error) {
        if (!isStructuredFallbackError(error)) {
          throw error
        }
        l.warn(`${providerLabel} structured output failed for ${model}; retrying without response_format`, {
      category: 'pipeline',
      metadata: { provider: providerLabel, model, fallback: 'no-response-format' }
    })
        return await executeRequest(requestBody)
      }
    }
  })
}

export const createOpenAICompatibleReasoningRunner = (descriptor: {
  service: OpenAICompatibleChatService
  providerLabel: string
  envPurpose: string
  baseURL: string
}) => {
  const config = (): { apiKey: string, baseURL: string } => ({
    apiKey: resolveCredential(descriptor.service, 'require', { stage: `write:${descriptor.service}`, description: descriptor.envPurpose }),
    baseURL: descriptor.baseURL
  })

  return async (
    prompt: string,
    model: string,
    structuredOpts?: StructuredRequestOptions
  ): Promise<{ result: string, metadata: Step3Metadata }> => {
    const { policy, updatedOpts } = resolveLlmReasoningOptions(descriptor.service, model, structuredOpts)

    return await runOpenAICompatibleChatModel({
      prompt,
      model,
      structuredOpts: updatedOpts,
      config,
      service: descriptor.service,
      providerLabel: descriptor.providerLabel,
      operationName: `${descriptor.service}-llm`,
      customizeRequestBody: (requestBody) => {
        if (policy.effective === 'low' || policy.effective === 'medium' || policy.effective === 'high') {
          requestBody['reasoning_effort'] = policy.effective
        }
      }
    })
  }
}
