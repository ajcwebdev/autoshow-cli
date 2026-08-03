import { expect, test } from 'bun:test'
import { buildSonioxCreateRequest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/soniox/soniox-api'

test('Soniox create request propagates the selected async model and enables diarization', () => {
  expect(buildSonioxCreateRequest('stt-async-v5', 'file-id')).toEqual({
    model: 'stt-async-v5',
    file_id: 'file-id',
    enable_speaker_diarization: true
  })
})

test('Soniox create request propagates an explicit diarization opt-out', () => {
  expect(buildSonioxCreateRequest('stt-async-v5', 'file-id', { enabled: false })).toEqual({
    model: 'stt-async-v5',
    file_id: 'file-id',
    enable_speaker_diarization: false
  })
})
