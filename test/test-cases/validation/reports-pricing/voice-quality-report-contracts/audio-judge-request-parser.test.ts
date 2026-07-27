import { describe, expect, test } from 'bun:test'
import { buildOpenAiAudioJudgeRequestBody, parseOpenAiAudioJudgeResponseContent } from '~/cli/commands/setup-and-utilities/benchmark/tts-voice-quality-report/openai-audio-judge'

describe('voice quality audio judge request and parser contracts', () => {
  test('OpenAI audio judge request body uses audio input with text-only JSON output', () => {
    const body = buildOpenAiAudioJudgeRequestBody({
      model: 'gpt-audio',
      audioBase64: 'UklGRg==',
      inputText: 'Hello world.'
    })

    expect(body['model']).toBe('gpt-audio')
    expect(body['store']).toBe(false)
    expect(body['modalities']).toEqual(['text'])
    expect(body['audio']).toBeUndefined()
    expect(body['response_format']).toEqual({ type: 'json_object' })
    const messages = body['messages'] as Array<Record<string, unknown>>
    const userContent = messages[1]?.['content'] as Array<Record<string, unknown>>
    expect(userContent.find((part) => part['type'] === 'input_audio')).toEqual({
      type: 'input_audio',
      input_audio: {
        data: 'UklGRg==',
        format: 'wav'
      }
    })
    expect(JSON.stringify(body)).toContain('Return exactly one compact JSON object')
  })

  test('OpenAI audio judge compatibility request uses documented audio output shape', () => {
    const body = buildOpenAiAudioJudgeRequestBody({
      model: 'gpt-audio',
      audioBase64: 'UklGRg==',
      inputText: 'Hello world.',
      jsonMode: false,
      audioOutput: true,
      toolMode: true
    })

    expect(body['modalities']).toEqual(['text', 'audio'])
    expect(body['audio']).toEqual({ voice: 'alloy', format: 'wav' })
    expect(body['response_format']).toBeUndefined()
    expect(body['tool_choice']).toEqual({
      type: 'function',
      function: { name: 'record_tts_voice_quality' }
    })
    expect(JSON.stringify(body['tools'])).toContain('record_tts_voice_quality')
    const messages = body['messages'] as Array<Record<string, unknown>>
    const userContent = messages[1]?.['content'] as Array<Record<string, unknown>>
    expect(userContent.find((part) => part['type'] === 'input_audio')).toEqual({
      type: 'input_audio',
      input_audio: {
        data: 'UklGRg==',
        format: 'wav'
      }
    })
  })

  test('OpenAI audio judge parser accepts fenced or prose-wrapped JSON', () => {
    const parsed = parseOpenAiAudioJudgeResponseContent([
      'Based on the supplied sample, here is the score:',
      '```json',
      '{"naturalnessScore":87,"pronunciationScore":90,"prosodyScore":82,"artifactScore":95,"confidence":0.74,"notes":"steady"}',
      '```'
    ].join('\n'))

    expect(parsed['naturalnessScore']).toBe(87)
    expect(parsed['confidence']).toBe(0.74)
  })

  test('OpenAI audio judge parser reports non-JSON prose clearly', () => {
    expect(() => parseOpenAiAudioJudgeResponseContent('Please provide the audio file to evaluate.')).toThrow(
      'OpenAI audio judge returned text without a JSON object'
    )
  })

  test('OpenAI audio judge parser reports malformed and truncated JSON clearly', () => {
    expect(() => parseOpenAiAudioJudgeResponseContent('{naturalnessScore:91}')).toThrow(
      'OpenAI audio judge returned malformed JSON object'
    )
    expect(() => parseOpenAiAudioJudgeResponseContent('{"naturalnessScore":91')).toThrow(
      'OpenAI audio judge returned truncated JSON object'
    )
  })
})
