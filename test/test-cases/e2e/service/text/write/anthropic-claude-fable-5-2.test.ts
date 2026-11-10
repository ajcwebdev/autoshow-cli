import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { anthropicWrite } from './cases'

defineLLMWriteTest({
  ...anthropicWrite,
  models: ['claude-fable-5-2'],
  llmService: 'anthropic',
  promptProfiles: { 'claude-fable-5-2': 'shortSummary' },
})
