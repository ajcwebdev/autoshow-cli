import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { openaiTts } from './cases'

defineTTSServiceTest({
  ...openaiTts,
  models: ['tts-1'],
  ttsService: 'openai',
})
