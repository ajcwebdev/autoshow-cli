import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { openaiWrite } from './cases'

defineLLMWriteTest({
  ...openaiWrite,
  models: ['gpt-5.5'],
  llmService: 'openai',
  promptProfiles: { 'gpt-5.5': 'shortSummary' },
})
