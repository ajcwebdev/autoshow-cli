import { describe, expect, test } from 'bun:test'
import { buildSingleProviderReport, installVoiceQualityReportHooks, makeMockFetch, makeSingleProviderTtsRun } from './shared'

installVoiceQualityReportHooks()

describe('voice quality paid STT and mode safety contracts', () => {
  test('full TTS mode fails when a configured paid STT call fails', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    delete process.env['OPENAI_API_KEY']
    process.env['ASSEMBLYAI_API_KEY'] = 'test-assemblyai-key'

    globalThis.fetch = makeMockFetch(async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
      expect(String(input)).toContain('/v2/upload')
      return new Response('upload unavailable', { status: 503 })
    })

    await expect(buildSingleProviderReport(runDir, inputText)).rejects.toThrow(
      'openai/gpt-4o-mini-tts: AssemblyAI roundtrip STT failed: AssemblyAI upload failed (503): upload unavailable'
    )
  })

  test('full TTS mode does not fail when paid credentials are absent', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    let fetchCount = 0
    delete process.env['OPENAI_API_KEY']
    delete process.env['ASSEMBLYAI_API_KEY']

    globalThis.fetch = makeMockFetch(async (): Promise<Response> => {
      fetchCount += 1
      throw new Error('paid endpoint should not be called')
    })

    const report = await buildSingleProviderReport(runDir, inputText)

    expect(fetchCount).toBe(0)
    expect(report.reportJson.providerCount).toBe(1)
    expect(report.reportJson.providers[0]?.missingMetrics).toContain('naturalness.paidAudioJudgeRubric')
    expect(report.reportJson.providers[0]?.missingMetrics).toContain('speechQuality.roundtripSttIntelligibility')
  })

  test('local TTS mode ignores paid credentials and never calls paid endpoints', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    let fetchCount = 0
    process.env['OPENAI_API_KEY'] = 'test-openai-key'
    process.env['ASSEMBLYAI_API_KEY'] = 'test-assemblyai-key'

    globalThis.fetch = makeMockFetch(async (): Promise<Response> => {
      fetchCount += 1
      throw new Error('paid endpoint should not be called')
    })

    const report = await buildSingleProviderReport(runDir, inputText, {
      mode: 'local',
      allowPaid: false
    })

    expect(fetchCount).toBe(0)
    expect(report.reportJson.mode).toBe('local')
    expect(report.reportJson.providers[0]?.componentScores.naturalness['paidAudioJudgeRubric']?.source).toBe('paid-audio-judge-omitted')
  })
})
