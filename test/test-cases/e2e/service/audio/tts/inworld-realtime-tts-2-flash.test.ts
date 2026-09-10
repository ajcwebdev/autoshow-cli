import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { inworldTts } from './cases'

defineTTSServiceTest({
  ...inworldTts,
  models: ['realtime-tts-2-flash'],
  ttsService: 'inworld',
  inputPath: 'test/test-cases/e2e/service/audio/tts/fixtures/natural-short.txt',
  inputTitle: 'natural-short',
})
