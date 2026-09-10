import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { geminiWrite } from './cases'

defineLLMWriteTest({
  ...geminiWrite,
  models: ['gemini-3.8-flash'],
  llmService: 'gemini',
  promptProfiles: { 'gemini-3.8-flash': 'shortSummary' },
})
