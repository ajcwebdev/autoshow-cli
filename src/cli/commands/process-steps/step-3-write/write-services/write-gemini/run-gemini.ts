import * as l from '~/utils/app-logger/app-logger'
import type { LlmApiCallResult, Step3Metadata, StructuredRequestOptions } from '~/types'
import { requireApiKey } from '~/utils/validate/env-utils'
import { ValidationError } from '~/utils/error-handler'
import { withRetry } from '~/utils/retries'
import { runWithLLMInstrumentation, buildStep3Metadata } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/gemini-utils'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { LLM_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'

const createCombinedSignal = (signal?: AbortSignal): AbortSignal => {
  const timeoutSignal = AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS)
  return AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])
}

export const runGeminiModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const apiKey = requireApiKey('GEMINI_API_KEY', 'write:gemini')

    const apiCall = (): Promise<LlmApiCallResult> => withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'gemini-llm',
        policy: { maxAttempts: 3 }
      },
      async (signal) => {
        const generationConfig: Record<string, unknown> | undefined = structuredOpts
          ? {
              responseMimeType: 'application/json',
              responseJsonSchema: structuredOpts.schema
            }
          : undefined

        const response = await geminiGenerateContent(apiKey, {
          model,
          contents: prompt,
          ...(generationConfig ? { generationConfig } : {}),
          abortSignal: createCombinedSignal(signal)
        })

        const text = response.text ?? ''
        if (!text) {
          throw ValidationError('No response text from model', { stage: 'write:gemini' })
        }
        return {
          text,
          usage: response.usageMetadata,
          rawProviderUsage: response.usageMetadata,
          returnedModel: response.modelVersion
        }
      },
      classifyGeminiRetry
    )

    const instrumentation = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata('gemini', model, instrumentation, structuredOpts)

    return { result: instrumentation.responseText, metadata }
  } catch (error) {
    l.error(`Failed to run Gemini model`, error)
    throw error
  }
}
