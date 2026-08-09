import type { LlmApiCallResult, Step3Metadata, StructuredRequestOptions } from '~/types'
import { requireApiKey } from '~/utils/validate/env-utils'
import { executeLlmRequest } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-request-scaffold'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/gemini-utils'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'

export const runGeminiModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  return await executeLlmRequest(prompt, model, structuredOpts, {
    service: 'gemini',
    providerLabel: 'Gemini',
    operationName: 'gemini-llm',
    emptyResponseStage: 'write:gemini',
    classifier: classifyGeminiRetry,
    policy: { maxAttempts: 3 },
    prepare: () => requireApiKey('GEMINI_API_KEY', 'write:gemini'),
    execute: async (createSignal, apiKey): Promise<LlmApiCallResult> => {
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
        abortSignal: createSignal()
      })

      const text = response.text ?? ''
      return {
        text,
        usage: response.usageMetadata,
        rawProviderUsage: response.usageMetadata,
        returnedModel: response.modelVersion
      }
    }
  })
}
