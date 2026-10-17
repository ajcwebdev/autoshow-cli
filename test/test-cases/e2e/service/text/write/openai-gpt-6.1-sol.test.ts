import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { openaiWrite } from './cases'

defineLLMWriteTest({
  ...openaiWrite,
  models: ['gpt-6.1-sol'],
  llmService: 'openai',
  promptProfiles: { 'gpt-6.1-sol': 'shortSummary' },
})
