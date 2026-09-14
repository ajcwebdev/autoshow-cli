import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { kimiWrite } from './cases'

defineLLMWriteTest({
  ...kimiWrite,
  models: ['kimi-k3'],
  llmService: 'kimi',
  promptProfiles: { 'kimi-k3': 'shortSummary' },
})
