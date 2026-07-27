import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { anthropicWrite } from './cases'

defineLLMWriteTest({
  ...anthropicWrite,
  models: ['claude-opus-4-8'],
  llmService: 'anthropic',
  promptProfiles: { 'claude-opus-4-8': 'shortSummary' },
})
