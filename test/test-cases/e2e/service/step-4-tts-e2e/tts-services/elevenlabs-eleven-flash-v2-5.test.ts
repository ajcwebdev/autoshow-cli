import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { elevenlabsTts } from './cases'

defineTTSServiceTest({ ...elevenlabsTts, models: ['eleven_flash_v2_5'], ttsService: 'elevenlabs' })
