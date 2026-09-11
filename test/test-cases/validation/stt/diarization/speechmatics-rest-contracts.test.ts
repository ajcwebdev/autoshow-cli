import { expect, test } from 'bun:test'
import { buildSpeechmaticsTranscriptionConfig } from '~/cli/commands/stt/diarization/speechmatics/run-speechmatics-stt'

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
