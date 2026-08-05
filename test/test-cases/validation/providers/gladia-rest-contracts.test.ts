import { expect, test } from 'bun:test'
import { GladiaUploadResponseSchema } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { buildGladiaCreateRequest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gladia/run-gladia-stt'

const uploadPayloadBase = {
  audio_url: 'https://api.gladia.io/audio/uploaded',
  audio_metadata: {
    id: 'audio-id',
    source: 'upload',
    extension: 'mp3',
    size: 12345,
    audio_duration: 3.5,
    number_of_channels: 1
  }
}

test('Gladia upload response accepts nullable or omitted audio metadata filename', () => {
  const nullableFilename = validateData(GladiaUploadResponseSchema, {
    ...uploadPayloadBase,
    audio_metadata: {
      ...uploadPayloadBase.audio_metadata,
      filename: null
    }
  }, 'Gladia upload response')

  expect(nullableFilename.audio_metadata.id).toBe('audio-id')
  expect(nullableFilename.audio_metadata.filename).toBeNull()

  const omittedFilename = validateData(GladiaUploadResponseSchema, uploadPayloadBase, 'Gladia upload response')
  expect(omittedFilename.audio_metadata.id).toBe('audio-id')
  expect(omittedFilename.audio_metadata.filename).toBeUndefined()
})

test('Gladia create request propagates the selected model and defaults diarization on', () => {
  for (const model of ['solaria-1', 'solaria-3']) {
    expect(buildGladiaCreateRequest('https://api.gladia.io/audio/uploaded', model)).toEqual({
      audio_url: 'https://api.gladia.io/audio/uploaded',
      model,
      diarization: true
    })
  }
})

test('Gladia create request propagates diarization controls', () => {
  expect(buildGladiaCreateRequest(
    'https://api.gladia.io/audio/uploaded',
    'solaria-3',
    { enabled: true, speakerCount: 3 }
  )).toEqual({
    audio_url: 'https://api.gladia.io/audio/uploaded',
    model: 'solaria-3',
    diarization: true,
    diarization_config: {
      number_of_speakers: 3
    }
  })
})
