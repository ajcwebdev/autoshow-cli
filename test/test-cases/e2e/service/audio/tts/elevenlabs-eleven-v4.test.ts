import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { elevenlabsTts } from './cases'

defineTTSServiceTest({
  ...elevenlabsTts,
  models: ['eleven_v4'],
  ttsService: 'elevenlabs',
})
