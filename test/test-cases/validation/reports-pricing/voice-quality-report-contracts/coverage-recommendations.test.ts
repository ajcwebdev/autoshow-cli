import { describe, expect, test } from 'bun:test'
import { buildSingleProviderReport, installVoiceQualityReportHooks, join, makeMockFetch, makeSingleProviderTtsRun, writeJson } from './shared'

installVoiceQualityReportHooks()

describe('voice quality coverage recommendation contracts', () => {
  test('full TTS mode low-coverage recommendation points to external metrics instead of rerunning full mode', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    let fetchCount = 0
    delete process.env['OPENAI_API_KEY']
    delete process.env['ASSEMBLYAI_API_KEY']

    globalThis.fetch = makeMockFetch(async (): Promise<Response> => {
      fetchCount += 1
      throw new Error('paid endpoint should not be called')
    })

    const report = await buildSingleProviderReport(runDir, inputText, {
      mode: 'full',
      allowPaid: true
    })

    expect(fetchCount).toBe(0)
    expect(report.markdown).toContain('low score coverage')
    expect(report.markdown).toContain('Full mode already ran')
    expect(report.markdown).toContain('external MOS/DNS metrics')
    expect(report.markdown).toContain('`utmosv2Mos`')
    expect(report.markdown).toContain('`nisqaTtsNaturalnessMos`')
    expect(report.markdown).toContain('`nisqaQualityMos`')
    expect(report.markdown).toContain('`dnsmosMos`')
    expect(report.markdown).toContain('`--tts-metric-fixtures`')
    expect(report.markdown).not.toContain('Run with `--tts-mode full`')
  })

  test('local TTS mode low-coverage recommendation still offers full mode as paid scoring upgrade path', async () => {
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
    expect(report.markdown).toContain('low score coverage')
    expect(report.markdown).toContain('Run with `--tts-mode full`')
    expect(report.markdown).toContain('supply `--tts-metric-fixtures`')
  })

  test('full TTS mode with complete fixture coverage omits low-coverage recommendation', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    const fixturesPath = join(runDir, 'voice-quality-fixtures.json')
    await writeJson(fixturesPath, {
      providers: {
        'openai/gpt-4o-mini-tts': {
          utmosv2Mos: 4.7,
          nisqaTtsNaturalnessMos: 4.6,
          nisqaQualityMos: 4.5,
          dnsmosMos: 4.4,
          paidAudioJudge: { naturalnessScore: 92, confidence: 0.9 },
          stt: {
            'assemblyai/universal-2': inputText
          }
        }
      }
    })
    let fetchCount = 0
    delete process.env['OPENAI_API_KEY']
    delete process.env['ASSEMBLYAI_API_KEY']

    globalThis.fetch = makeMockFetch(async (): Promise<Response> => {
      fetchCount += 1
      throw new Error('paid endpoint should not be called')
    })

    const report = await buildSingleProviderReport(runDir, inputText, {
      mode: 'full',
      allowPaid: true,
      metricFixturesPath: fixturesPath
    })

    expect(fetchCount).toBe(0)
    expect(report.reportJson.providers[0]?.missingMetrics).toEqual([])
    expect(report.markdown).not.toContain('low score coverage')
    expect(report.markdown).not.toContain('Run with `--tts-mode full`')
    expect(report.markdown).not.toContain('Full mode already ran')
  })
})
