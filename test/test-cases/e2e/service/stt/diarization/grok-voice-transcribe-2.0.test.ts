import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { grokSpeechToText } from '../cases'

defineSTTServiceTest({
  ...grokSpeechToText,
  models: ['grok-voice-transcribe-2.0'],
  sttService: 'grok',
})

