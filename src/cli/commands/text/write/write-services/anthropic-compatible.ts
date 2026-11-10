import { executeLlmRequest } from '~/cli/commands/text/write/write-utils/llm-request-scaffold'
import type { AnthropicRestConfig, RunAnthropicCompatibleModelOptions, Step3Metadata } from '~/types'
import { createAnthropicMessage } from '~/utils/anthropic/anthropic-client'
import { classifyFetchRetry } from '~/utils/retries'
import { applyAnthropicReasoning } from '~/cli/commands/setup-and-utilities/models/reasoning-request-mappers'
import { llmRequestSettings } from '~/cli/commands/text/write/write-utils/llm-request-settings'
import { ValidationError } from '~/utils/error-handler'
import { transformAnthropicJsonSchema } from '~/utils/anthropic/anthropic-json-schema'
import { isRecord } from '~/utils/value-helpers'

const extractAnthropicText = (content: unknown): string | undefined => {
  if (!Array.isArray(content)) return undefined
  let text = ''
  for (const block of content) {
    if (!isRecord(block) || typeof block['type'] !== 'string') return undefined
    if (block['type'] !== 'text') continue
    if (typeof block['text'] !== 'string') return undefined
    text += block['text']
  }
  return text
}

export const runAnthropicCompatibleModel = async ({
  prompt,
  model,
  structuredOpts,
  config,
  service,
  providerLabel,
  operationName,
  supportsStructuredOutput = false
}: RunAnthropicCompatibleModelOptions): Promise<{ result: string, metadata: Step3Metadata }> => {
  return await executeLlmRequest<AnthropicRestConfig>(prompt, model, structuredOpts, {
    service,
    providerLabel,
    operationName,
    emptyResponseStage: 'write:anthropic',
    classifier: (error) => classifyFetchRetry(error, 'runtime_http_create_conservative'),
    prepare: () => typeof config === 'function' ? config() : config,
    execute: async (createSignal, resolvedConfig) => {
      const requestBody: Record<string, unknown> = {
        model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }]
      }

      if (structuredOpts?.effectiveReasoningEffort) {
        applyAnthropicReasoning(requestBody, structuredOpts.effectiveReasoningEffort)
      }

      if (supportsStructuredOutput && structuredOpts && Object.keys(structuredOpts.schema ?? {}).length > 0) {
        requestBody['output_config'] = {
          ...(requestBody['output_config'] as Record<string, unknown> | undefined),
          format: {
            type: 'json_schema',
            schema: transformAnthropicJsonSchema(structuredOpts.schema)
          }
        }
      }

      const message = await createAnthropicMessage(resolvedConfig, requestBody, {
        signal: createSignal()
      })

      const responseEvidence = {
        rawResponse: message,
        requestedModel: model,
        ...(isRecord(message) ? { rawProviderUsage: message['usage'], returnedModel: message['model'] } : {})
      }
      if (!isRecord(message)) {
        throw ValidationError(`${providerLabel} returned a malformed message.`, { stage: 'write:anthropic', metadata: responseEvidence })
      }
      if (message['stop_reason'] === 'refusal' || message['stop_reason'] === 'max_tokens' || message['stop_reason'] === 'pause_turn') {
        throw ValidationError(`${providerLabel} returned an incomplete response (${message['stop_reason']}).`, {
          stage: 'write:anthropic',
          metadata: responseEvidence
        })
      }

      const text = extractAnthropicText(message.content)
      if (text === undefined || !text.trim()) {
        throw ValidationError(text === undefined ? `${providerLabel} returned malformed content blocks.` : 'No response text from model', {
          stage: 'write:anthropic', metadata: responseEvidence
        })
      }
      return {
        text,
        usage: message.usage,
        rawProviderUsage: message.usage,
        returnedModel: message.model,
        requestSettings: llmRequestSettings(requestBody)
      }
    }
  })
}
