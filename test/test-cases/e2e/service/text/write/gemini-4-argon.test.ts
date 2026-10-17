import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { geminiWrite } from './cases'

defineLLMWriteTest({
  ...geminiWrite,
  models: ['gemini-4-argon'],
  llmService: 'gemini',
  promptProfiles: { 'gemini-4-argon': 'shortSummary' },
})
