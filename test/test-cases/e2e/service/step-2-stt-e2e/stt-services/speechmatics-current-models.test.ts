import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { speechmaticsTranscription } from './cases'

defineSTTServiceTest({
  ...speechmaticsTranscription,
  models: ['melia-1'],
  sttService: 'speechmatics',
  inputPath: 'input/examples/audio/0-audio-short.mp3',
  inputTitle: '0-audio-short',
})
