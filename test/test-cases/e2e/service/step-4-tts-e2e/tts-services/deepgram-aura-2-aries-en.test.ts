import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { deepgramTts } from './cases'

defineTTSServiceTest({ ...deepgramTts, models: ['aura-2-aries-en'], ttsService: 'deepgram' })
