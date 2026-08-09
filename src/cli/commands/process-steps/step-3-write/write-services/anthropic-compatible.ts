import { executeLlmRequest } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-request-scaffold'
import type { AnthropicRestConfig, RunAnthropicCompatibleModelOptions, Step3Metadata } from '~/types'
import { createAnthropicMessage } from '~/utils/anthropic/anthropic-client'
import { classifyFetchRetry } from '~/utils/retries'

const extractAnthropicText = (content: Array<{ type: string, text?: string | undefined }>): string =>
  content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')

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

      if (supportsStructuredOutput && structuredOpts) {
        requestBody['output_config'] = {
          format: {
            type: 'json_schema',
            schema: structuredOpts.schema
          }
        }
      }

      const message = await createAnthropicMessage(resolvedConfig, requestBody, {
        signal: createSignal()
      })

      const text = extractAnthropicText(message.content ?? [])
      return {
        text,
        usage: message.usage,
        rawProviderUsage: message.usage,
        returnedModel: message.model
      }
    }
  })
}
