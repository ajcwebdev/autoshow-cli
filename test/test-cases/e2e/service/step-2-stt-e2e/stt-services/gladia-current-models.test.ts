import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { gladiaTranscription } from './cases'

defineSTTServiceTest({
  ...gladiaTranscription,
  models: ['solaria-1', 'solaria-3'],
  sttService: 'gladia',
  inputPath: 'input/examples/audio/0-audio-short.mp3',
  inputTitle: '0-audio-short',
})
