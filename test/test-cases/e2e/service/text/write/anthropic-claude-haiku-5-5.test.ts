import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { anthropicWrite } from './cases'

defineLLMWriteTest({
  ...anthropicWrite,
  models: ['claude-haiku-5-5'],
  llmService: 'anthropic',
  promptProfiles: { 'claude-haiku-5-5': 'shortSummary' },
})
