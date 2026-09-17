import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { deepinfraWhisper } from '../cases'

// Streaming architecture upstream, but DeepInfra serves it on the batch
// OpenAI-compatible transcription route; Together's Nemotron ASR endpoints reject files.
defineSTTServiceTest({
  ...deepinfraWhisper,
  models: ['nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b'],
  sttService: 'deepinfra',
  inputPath: 'input/examples/audio/0-audio-short.mp3',
  inputTitle: '0-audio-short',
})
