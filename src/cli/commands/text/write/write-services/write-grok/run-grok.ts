import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { normalizeGrokChatUsage } from '~/utils/openai/grok-chat-usage'
import { ValidationError } from '~/utils/error-handler'
import { createOpenAICompatibleReasoningRunner } from '../openai-compatible-chat'

export const runGrokModel = createOpenAICompatibleReasoningRunner({
  service: 'grok',
  providerLabel: 'Grok',
  envPurpose: '--grok models',
  baseURL: XAI_DEFAULT_BASE_URL,
  mapUsage: normalizeGrokChatUsage,
  checkResponse: (response) => {
    const choice = response.choices?.[0]
    const refusal = choice?.message?.['refusal']
    if ((choice?.finish_reason !== undefined && choice.finish_reason !== 'stop')
      || (typeof refusal === 'string' && refusal.length > 0)
      || typeof choice?.message?.content !== 'string'
      || !choice.message.content.trim()) {
      throw ValidationError(`Grok returned an incomplete or unusable Chat Completions response${choice?.finish_reason ? ` (${choice.finish_reason})` : ''}.`, {
        stage: 'write:grok',
        retryable: false,
        metadata: { rawResponse: response, rawProviderUsage: response.usage, returnedModel: response.model }
      })
    }
  }
})
