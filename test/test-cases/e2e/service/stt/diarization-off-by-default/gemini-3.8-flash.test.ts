import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { geminiTranscription } from '../cases'

defineSTTServiceTest({
  ...geminiTranscription,
  models: ['gemini-3.8-flash'],
  sttService: 'gemini-stt',
})
