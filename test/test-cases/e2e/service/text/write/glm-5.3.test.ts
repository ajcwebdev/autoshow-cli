import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { glmWrite } from './cases'

defineLLMWriteTest({
  ...glmWrite,
  models: ['glm-5.3'],
  llmService: 'glm',
  promptProfiles: { 'glm-5.3': 'shortSummary' },
})
