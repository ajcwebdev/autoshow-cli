import type { OpenAIChatCompletionResponse } from '~/types'
import { isRecord } from '~/utils/rest-client'

// xAI Chat Completions reports visible completion and reasoning separately.
// Its REST example has 32 prompt + 9 completion + 94 reasoning = 135 total.
// https://docs.x.ai/developers/rest-api-reference/inference/chat-completions
// This mapper is deliberately opt-in: other OpenAI-compatible providers can
// include reasoning in completion_tokens already. Keep raw usage separately.
export const normalizeGrokChatUsage = (
  usage: OpenAIChatCompletionResponse['usage']
): OpenAIChatCompletionResponse['usage'] => {
  const completionTokens = usage?.completion_tokens
  const details = usage?.['completion_tokens_details']
  const reasoningTokens = isRecord(details) ? details['reasoning_tokens'] : undefined
  if (typeof completionTokens !== 'number' || !Number.isFinite(completionTokens) || completionTokens < 0
    || typeof reasoningTokens !== 'number' || !Number.isFinite(reasoningTokens) || reasoningTokens < 0) return usage
  return { ...usage, completion_tokens: completionTokens + reasoningTokens }
}
