import { describe, expect, test } from 'bun:test'
import { buildAssemblyAiTranscriptRequest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/assemblyai/run-assemblyai-stt'

describe('AssemblyAI REST contracts', () => {
  test('transcript request preserves one selected model and enables diarization', () => {
    expect(buildAssemblyAiTranscriptRequest(
      'https://cdn.assemblyai.com/upload/example',
      'universal-3-5-pro'
    )).toEqual({
      audio_url: 'https://cdn.assemblyai.com/upload/example',
      speech_models: ['universal-3-5-pro'],
      speaker_labels: true
    })
  })

  test('transcript request propagates the expected speaker count', () => {
    expect(buildAssemblyAiTranscriptRequest(
      'https://cdn.assemblyai.com/upload/example',
      'universal-3-5-pro',
      3
    )).toEqual({
      audio_url: 'https://cdn.assemblyai.com/upload/example',
      speech_models: ['universal-3-5-pro'],
      speaker_labels: true,
      speakers_expected: 3
    })
  })
})
