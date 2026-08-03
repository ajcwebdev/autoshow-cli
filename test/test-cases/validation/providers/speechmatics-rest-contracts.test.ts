import { expect, test } from 'bun:test'
import { buildSpeechmaticsTranscriptionConfig } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/speechmatics/run-speechmatics-stt'

test('Speechmatics Enhanced uses the current model field with automatic language identification', () => {
  expect(buildSpeechmaticsTranscriptionConfig('enhanced')).toEqual({
    type: 'transcription',
    transcription_config: {
      model: 'enhanced',
      language: 'auto',
      diarization: 'speaker'
    }
  })
})

test('Speechmatics Melia 1 uses the required multilingual language selector', () => {
  expect(buildSpeechmaticsTranscriptionConfig('melia-1')).toEqual({
    type: 'transcription',
    transcription_config: {
      model: 'melia-1',
      language: 'multi',
      diarization: 'speaker'
    }
  })
})
