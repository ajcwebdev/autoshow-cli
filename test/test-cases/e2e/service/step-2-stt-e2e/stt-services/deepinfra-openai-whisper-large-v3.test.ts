import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { deepinfraWhisper } from './cases'

defineSTTServiceTest({
  ...deepinfraWhisper,
  models: ['openai/whisper-large-v3'],
  sttService: 'deepinfra',
  inputPath: 'input/examples/audio/0-audio-short.mp3',
  inputTitle: '0-audio-short',
})
