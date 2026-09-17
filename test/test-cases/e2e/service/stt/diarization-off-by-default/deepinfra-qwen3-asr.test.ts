import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { deepinfraWhisper } from '../cases'

defineSTTServiceTest({
  ...deepinfraWhisper,
  models: ['Qwen/Qwen3-ASR-0.6B', 'Qwen/Qwen3-ASR-1.7B'],
  sttService: 'deepinfra',
  inputPath: 'input/examples/audio/0-audio-short.mp3',
  inputTitle: '0-audio-short',
})
