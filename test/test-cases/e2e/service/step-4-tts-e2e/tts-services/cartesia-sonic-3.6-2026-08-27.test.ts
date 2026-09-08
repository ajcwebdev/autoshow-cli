import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { cartesiaTts } from './cases'

defineTTSServiceTest({
  ...cartesiaTts,
  models: ['sonic-3.6-2026-08-27'],
  ttsService: 'cartesia',
  inputPath: 'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/fixtures/natural-short.txt',
  inputTitle: 'natural-short',
})
