import type { LlmApiCallResult, Step3Metadata, StructuredRequestOptions } from '~/types'
import { requireProviderKey } from '~/utils/validate/env-utils'
import { executeLlmRequest } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-request-scaffold'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/gemini-utils'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { resolveLlmReasoningOptions } from '../llm-reasoning-options'

const buildGeminiThinkingLevel = (effective: string): string | undefined => {
  switch (effective) {
    case 'low': return 'LOW'
    case 'medium': return 'MEDIUM'
    case 'high': return 'HIGH'
    case 'minimal': return 'MINIMAL'
    default: return undefined
  }
}

export const runGeminiModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const { policy, updatedOpts } = resolveLlmReasoningOptions('gemini', model, structuredOpts)

  return await executeLlmRequest(prompt, model, updatedOpts, {
    service: 'gemini',
    providerLabel: 'Gemini',
    operationName: 'gemini-llm',
    emptyResponseStage: 'write:gemini',
    classifier: classifyGeminiRetry,
    prepare: () => requireProviderKey('gemini', 'write:gemini'),
    execute: async (createSignal, apiKey): Promise<LlmApiCallResult> => {
      const thinkingLevel = buildGeminiThinkingLevel(policy.effective)
      const generationConfig: Record<string, unknown> = {
        ...(structuredOpts ? {
          responseMimeType: 'application/json',
          responseJsonSchema: structuredOpts.schema
        } : {}),
        ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {})
      }

      const response = await geminiGenerateContent(apiKey, {
        model,
        contents: prompt,
        ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
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
