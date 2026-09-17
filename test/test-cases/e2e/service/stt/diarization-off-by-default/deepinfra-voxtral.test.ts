import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { deepinfraWhisper } from '../cases'

// Both Voxtral deployments return transcript text with null words and null segments,
// so AutoShow records one whole-request segment and no native word timing.
defineSTTServiceTest({
  ...deepinfraWhisper,
  models: ['mistralai/Voxtral-Mini-3B-2507', 'mistralai/Voxtral-Small-24B-2507'],
  sttService: 'deepinfra',
  inputPath: 'input/examples/audio/0-audio-short.mp3',
  inputTitle: '0-audio-short',
})
