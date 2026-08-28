import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { assemblyaiTranscription } from './cases'

defineSTTServiceTest({
  ...assemblyaiTranscription,
  models: ['universal-3-5-pro'],
  sttService: 'assemblyai',
})
