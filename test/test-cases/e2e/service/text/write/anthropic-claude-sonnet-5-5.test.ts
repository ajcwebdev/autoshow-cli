import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { anthropicWrite } from './cases'

defineLLMWriteTest({
  ...anthropicWrite,
  models: ['claude-sonnet-5-5'],
  llmService: 'anthropic',
  promptProfiles: { 'claude-sonnet-5-5': 'shortSummary' },
})
