import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { openaiTts } from './cases'

defineTTSServiceTest({
  ...openaiTts,
  models: ['gpt-4o-mini-tts-2025-12-15'],
  ttsService: 'openai',
})

