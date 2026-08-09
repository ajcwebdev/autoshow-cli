import * as l from '~/utils/app-logger/app-logger'
import { requireApiKey } from '~/utils/validate/env-utils'
import { InfraError, ValidationError } from '~/utils/error-handler'
import type { LlmApiCallResult, MiniMaxChatCompletionResponse, Step3Metadata, StructuredRequestOptions } from '~/types'
import { runWithLLMInstrumentation, buildStep3Metadata } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { LLM_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'
import { createOpenAIChatCompletion, extractOpenAIChatCompletionText } from '~/utils/openai/openai-client'
import { MINIMAX_DEFAULT_BASE_URL } from '~/utils/base-urls'
const createCombinedSignal = (signal?: AbortSignal): AbortSignal => {
  const timeoutSignal = AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS)
  return AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])
}

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
  try {
    const apiKey = requireApiKey('MINIMAX_API_KEY', 'write:minimax')

    const config = {
      apiKey,
      provider: 'minimax',
      baseURL: MINIMAX_TEXT_BASE_URL
    }

    const apiCall = (): Promise<LlmApiCallResult> => withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName: 'minimax-llm' },
      async (signal) => {
        const response = await createOpenAIChatCompletion(config, {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 16000,
          stream: false
        }, {
          signal: createCombinedSignal(signal),
          errorMessagePrefix: 'MiniMax Chat Completions request failed'
        }) as MiniMaxChatCompletionResponse

        ensureMiniMaxBaseRespSuccess(response.base_resp, 'MiniMax chat completion')

        const text = extractOpenAIChatCompletionText(response) ?? ''
        if (!text) {
          throw ValidationError('No response text from model', { stage: 'write:minimax' })
        }
        return {
          text,
          usage: response.usage,
          rawProviderUsage: response.usage,
          returnedModel: response.model
        }
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
    )

    const instrumentation = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata('minimax', model, instrumentation, structuredOpts)

    return { result: instrumentation.responseText, metadata }
  } catch (error) {
    l.error('Failed to run MiniMax model', error)
    throw error
  }
}
