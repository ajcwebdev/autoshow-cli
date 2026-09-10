import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { togetherWrite } from './cases'

defineLLMWriteTest({
  ...togetherWrite,
  models: ['kimi-k3'],
  llmService: 'together',
  promptProfiles: { 'kimi-k3': 'shortSummary' },
})
