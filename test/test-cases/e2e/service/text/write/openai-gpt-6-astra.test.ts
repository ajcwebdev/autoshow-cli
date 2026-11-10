import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { openaiWrite } from './cases'

defineLLMWriteTest({
  ...openaiWrite,
  models: ['gpt-6-astra'],
  llmService: 'openai',
  promptProfiles: { 'gpt-6-astra': 'shortSummary' },
})
