import { describe, expect, test } from 'bun:test'
import { buildTogetherSttFormFields } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/together/run-together-stt'

describe('Together STT REST contracts', () => {
  test('builds verbose segment requests for each current batch model', () => {
    for (const model of ['openai/whisper-large-v3', 'nvidia/parakeet-tdt-0.6b-v3']) {
      expect(buildTogetherSttFormFields(model)).toEqual({
        response_format: 'verbose_json',
        'timestamp_granularities[]': 'segment'
      })
    }
  })

  test('sends a decoding prompt only to the Whisper family', () => {
    expect(buildTogetherSttFormFields('openai/whisper-large-v3', '  AutoShow names  ')).toEqual({
      response_format: 'verbose_json',
      'timestamp_granularities[]': 'segment',
      prompt: 'AutoShow names'
    })
    expect(buildTogetherSttFormFields('nvidia/parakeet-tdt-0.6b-v3', 'AutoShow names')).toEqual({
      response_format: 'verbose_json',
      'timestamp_granularities[]': 'segment'
    })
  })
})
