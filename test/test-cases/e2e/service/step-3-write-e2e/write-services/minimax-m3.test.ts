import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { minimaxWrite } from './cases'

defineLLMWriteTest({
  ...minimaxWrite,
  models: ['MiniMax-M3'],
  llmService: 'minimax',
  promptProfiles: { 'MiniMax-M3': 'shortSummary' },
})
