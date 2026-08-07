import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { elevenlabsTts } from './cases'

defineTTSServiceTest({ ...elevenlabsTts, models: ['eleven_multilingual_v2'], ttsService: 'elevenlabs' })
