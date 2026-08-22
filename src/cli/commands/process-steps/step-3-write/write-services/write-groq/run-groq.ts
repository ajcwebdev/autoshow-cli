import { GROQ_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { createOpenAICompatibleReasoningRunner } from '../openai-compatible-chat'

export const runGroqModel = createOpenAICompatibleReasoningRunner({
  service: 'groq',
  providerLabel: 'Groq',
  envPurpose: '--groq models',
  baseURL: GROQ_DEFAULT_BASE_URL
})
