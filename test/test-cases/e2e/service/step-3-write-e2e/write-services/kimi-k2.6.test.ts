import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { kimiWrite } from './cases'

defineLLMWriteTest({
  ...kimiWrite,
  models: ['kimi-k2.6'],
  llmService: 'kimi',
  inputPath: 'input/examples/audio/0-audio-short.mp3',
  inputTitle: '0-audio-short',
  promptProfiles: { 'kimi-k2.6': 'shortSummary' },
})
