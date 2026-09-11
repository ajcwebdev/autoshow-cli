import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { grokWrite } from './cases'

defineLLMWriteTest({
  ...grokWrite,
  models: ['grok-4.3'],
  llmService: 'grok',
  promptProfiles: { 'grok-4.3': 'shortSummary' },
})
