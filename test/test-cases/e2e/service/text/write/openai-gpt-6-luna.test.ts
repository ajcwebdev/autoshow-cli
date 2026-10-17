import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { openaiWrite } from './cases'

defineLLMWriteTest({
  ...openaiWrite,
  models: ['gpt-6-luna'],
  llmService: 'openai',
  promptProfiles: { 'gpt-6-luna': 'shortSummary' },
})
