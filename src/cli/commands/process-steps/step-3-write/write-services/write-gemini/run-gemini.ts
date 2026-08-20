import type { LlmApiCallResult, Step3Metadata, StructuredRequestOptions } from '~/types'
import { requireApiKey } from '~/utils/validate/env-utils'
import { executeLlmRequest } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-request-scaffold'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/gemini-utils'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

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
  const policy = resolveReasoningPolicy({
    step: 'llm',
    service: 'gemini',
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
    service: 'gemini',
    providerLabel: 'Gemini',
    operationName: 'gemini-llm',
    emptyResponseStage: 'write:gemini',
    classifier: classifyGeminiRetry,
    prepare: () => requireApiKey('GEMINI_API_KEY', 'write:gemini'),
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
