import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { assemblyaiTranscription } from '../cases'

defineSTTServiceTest({
  ...assemblyaiTranscription,
  models: ['assemblyai-stt-3-7', 'universal-3-5-pro'],
  sttService: 'assemblyai',
})
