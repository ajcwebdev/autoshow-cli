import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { geminiTts } from './cases'

defineTTSServiceTest({
  ...geminiTts,
  models: ['gemini-3.1-flash-tts-preview'],
  ttsService: 'gemini',
  inputPath: 'input/examples/tts/0-tts-short.txt',
  inputTitle: '0-tts-short',
})
