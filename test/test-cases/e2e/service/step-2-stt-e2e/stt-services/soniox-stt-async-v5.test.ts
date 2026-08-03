import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { sonioxTranscription } from './cases'

defineSTTServiceTest({
  ...sonioxTranscription,
  models: ['stt-async-v5'],
  sttService: 'soniox',
})
