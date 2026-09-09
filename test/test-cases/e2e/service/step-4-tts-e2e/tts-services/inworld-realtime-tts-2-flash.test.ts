import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { inworldTts } from './cases'

defineTTSServiceTest({
  ...inworldTts,
  models: ['realtime-tts-2-flash'],
  ttsService: 'inworld',
  inputPath: 'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/fixtures/natural-short.txt',
  inputTitle: 'natural-short',
})
