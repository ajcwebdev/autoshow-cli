import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { createOpenAICompatibleReasoningRunner } from '../openai-compatible-chat'

export const runGrokModel = createOpenAICompatibleReasoningRunner({
  service: 'grok',
  providerLabel: 'Grok',
  envVar: 'XAI_API_KEY',
  envPurpose: '--grok models',
  baseURL: XAI_DEFAULT_BASE_URL
})
