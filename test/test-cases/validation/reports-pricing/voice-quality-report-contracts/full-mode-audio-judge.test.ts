import { describe, expect, test } from 'bun:test'
import { buildSingleProviderReport, installMockFetch, installVoiceQualityReportHooks, makeAudioJudgeFixtureRun, makeSingleProviderTtsRun, voiceQualityToolCallResponse } from './shared'

installVoiceQualityReportHooks()

describe('voice quality full-mode audio judge contracts', () => {
  test('full TTS mode reads OpenAI audio judge JSON from content before legacy audio transcript', async () => {
    const { runDir, inputText, fixturesPath } = await makeAudioJudgeFixtureRun()
    process.env['OPENAI_API_KEY'] = 'test-openai-key'
    delete process.env['ASSEMBLYAI_API_KEY']
    let fetchCount = 0

    installMockFetch(async (_call, input, init): Promise<Response> => {
      fetchCount += 1
      expect(String(input)).toContain('/chat/completions')
      const requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      expect(requestBody['modalities']).toEqual(['text'])
      expect(requestBody['audio']).toBeUndefined()
      expect(requestBody['response_format']).toEqual({ type: 'json_object' })
      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: '{"naturalnessScore":91,"pronunciationScore":89,"prosodyScore":88,"artifactScore":94,"confidence":0.82,"notes":"clear"}',
              audio: {
                transcript: '{"naturalnessScore":12'
              }
            }
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })

    const report = await buildSingleProviderReport(runDir, inputText, {
      metricFixturesPath: fixturesPath
    })

    expect(fetchCount).toBe(1)
    expect(report.reportJson.providers[0]?.componentScores.naturalness['paidAudioJudgeRubric']?.score).toBe(91)
    expect(report.reportJson.providers[0]?.componentScores.naturalness['paidAudioJudgeRubric']?.details).toMatchObject({
      pronunciationScore: 89,
      prosodyScore: 88,
      artifactScore: 94,
      confidence: 0.82
    })
  })

  test('full TTS mode retries OpenAI audio judge without response_format when JSON mode is unsupported', async () => {
    const { runDir, inputText, fixturesPath } = await makeAudioJudgeFixtureRun()
    process.env['OPENAI_API_KEY'] = 'test-openai-key'
    delete process.env['ASSEMBLYAI_API_KEY']
    const requestBodies: Array<Record<string, unknown>> = []

    installMockFetch(async (_call, _input, init): Promise<Response> => {
      const requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      requestBodies.push(requestBody)

      if (requestBodies.length === 1) {
        expect(requestBody['response_format']).toEqual({ type: 'json_object' })
        return new Response(JSON.stringify({
          error: {
            message: "Invalid parameter: 'response_format' of type 'json_object' is not supported with this model.",
            type: 'invalid_request_error',
            param: 'response_format',
            code: null
          }
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        })
      }

      expect(requestBody['modalities']).toEqual(['text', 'audio'])
      expect(requestBody['audio']).toEqual({ voice: 'alloy', format: 'wav' })
      expect(requestBody['response_format']).toBeUndefined()
      expect(requestBody['tool_choice']).toEqual({
        type: 'function',
        function: { name: 'record_tts_voice_quality' }
      })
      return voiceQualityToolCallResponse('{"naturalnessScore":88,"pronunciationScore":86,"prosodyScore":87,"artifactScore":91,"confidence":0.77,"notes":"clear"}')
    })

    const report = await buildSingleProviderReport(runDir, inputText, {
      metricFixturesPath: fixturesPath
    })

    expect(requestBodies).toHaveLength(2)
    expect(report.reportJson.providers[0]?.componentScores.naturalness['paidAudioJudgeRubric']?.score).toBe(88)
  })

  test('full TTS mode retries OpenAI audio judge with audio output when text-only response says audio is missing', async () => {
    const { runDir, inputText, fixturesPath } = await makeAudioJudgeFixtureRun()
    process.env['OPENAI_API_KEY'] = 'test-openai-key'
    delete process.env['ASSEMBLYAI_API_KEY']
    const requestBodies: Array<Record<string, unknown>> = []

    installMockFetch(async (_call, _input, init): Promise<Response> => {
      const requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      requestBodies.push(requestBody)

      if (requestBodies.length === 1) {
        expect(requestBody['modalities']).toEqual(['text'])
        expect(requestBody['response_format']).toEqual({ type: 'json_object' })
        return new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: "I currently don't have an audio sample to evaluate. Please provide the audio sample."
              }
            }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      expect(requestBody['modalities']).toEqual(['text', 'audio'])
      expect(requestBody['audio']).toEqual({ voice: 'alloy', format: 'wav' })
      expect(requestBody['response_format']).toBeUndefined()
      expect(requestBody['tool_choice']).toEqual({
        type: 'function',
        function: { name: 'record_tts_voice_quality' }
      })
      return voiceQualityToolCallResponse('{"naturalnessScore":84,"pronunciationScore":82,"prosodyScore":83,"artifactScore":89,"confidence":0.72,"notes":"clear"}')
    })

    const report = await buildSingleProviderReport(runDir, inputText, {
      metricFixturesPath: fixturesPath
    })

    expect(requestBodies).toHaveLength(2)
    expect(report.reportJson.providers[0]?.componentScores.naturalness['paidAudioJudgeRubric']?.score).toBe(84)
  })

  test('full TTS mode fails when OpenAI audio judge returns prose-only text', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    process.env['OPENAI_API_KEY'] = 'test-openai-key'
    delete process.env['ASSEMBLYAI_API_KEY']

    installMockFetch(async (): Promise<Response> => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: 'Please provide the audio file to evaluate.'
          }
        }
      ]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    await expect(buildSingleProviderReport(runDir, inputText)).rejects.toThrow(
      'openai/gpt-4o-mini-tts: OpenAI audio judge failed: OpenAI audio judge returned text without a JSON object'
    )
  })
})
