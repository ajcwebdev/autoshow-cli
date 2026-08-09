import { requireApiKey } from '~/utils/validate/env-utils'
import { InfraError } from '~/utils/error-handler'
import type { LlmApiCallResult, MiniMaxChatCompletionResponse, Step3Metadata, StructuredRequestOptions } from '~/types'
import { executeLlmRequest } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-request-scaffold'
import { classifyFetchRetry } from '~/utils/retries'
import { createOpenAIChatCompletion, extractOpenAIChatCompletionText } from '~/utils/openai/openai-client'
import { MINIMAX_DEFAULT_BASE_URL } from '~/utils/base-urls'

const ensureMiniMaxBaseRespSuccess = (
  baseResp: MiniMaxChatCompletionResponse['base_resp'],
  context: string
): void => {
  if (baseResp?.status_code !== undefined && baseResp.status_code !== 0) {
    throw InfraError(`${context} failed (${baseResp.status_code}): ${baseResp.status_msg ?? 'Unknown error'}`, { stage: 'write:minimax', retryable: false })
  }
}

const MINIMAX_TEXT_BASE_URL = `${MINIMAX_DEFAULT_BASE_URL}/v1`

export const runMinimaxModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  return await executeLlmRequest(prompt, model, structuredOpts, {
    service: 'minimax',
    providerLabel: 'MiniMax',
    operationName: 'minimax-llm',
    emptyResponseStage: 'write:minimax',
    classifier: (error) => classifyFetchRetry(error, 'runtime_http_create_conservative'),
    prepare: () => ({
      apiKey: requireApiKey('MINIMAX_API_KEY', 'write:minimax'),
      provider: 'minimax',
      baseURL: MINIMAX_TEXT_BASE_URL
    }),
    execute: async (createSignal, config): Promise<LlmApiCallResult> => {
      const response = await createOpenAIChatCompletion(config, {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 16000,
        stream: false
      }, {
        signal: createSignal(),
        errorMessagePrefix: 'MiniMax Chat Completions request failed'
      }) as MiniMaxChatCompletionResponse

      ensureMiniMaxBaseRespSuccess(response.base_resp, 'MiniMax chat completion')

      const text = extractOpenAIChatCompletionText(response) ?? ''
      return {
        text,
        usage: response.usage,
        rawProviderUsage: response.usage,
        returnedModel: response.model
      }
    }
  })
}
