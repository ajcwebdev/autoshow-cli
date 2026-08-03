import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { togetherTranscription } from './cases'

defineSTTServiceTest({
  ...togetherTranscription,
  models: ['openai/whisper-large-v3', 'nvidia/parakeet-tdt-0.6b-v3'],
  sttService: 'together',
})
