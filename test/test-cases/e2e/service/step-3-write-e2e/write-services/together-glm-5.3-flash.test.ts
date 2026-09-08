import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { togetherWrite } from './cases'

defineLLMWriteTest({
  ...togetherWrite,
  models: ['glm-5.3-flash'],
  llmService: 'together',
  promptProfiles: { 'glm-5.3-flash': 'shortSummary' },
})
