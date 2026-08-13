import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { geminiWrite } from './cases'

defineLLMWriteTest({
  ...geminiWrite,
  models: ['gemini-3.5-flash-lite'],
  llmService: 'gemini',
})
