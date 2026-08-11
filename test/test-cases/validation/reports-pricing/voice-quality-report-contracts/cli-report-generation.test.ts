import { describe, expect, test } from 'bun:test'
import { installVoiceQualityReportHooks, join, makeTempRoot, mkdir, runCommand, writeFile, writeJson, writeSyntheticWav } from './shared'
import { writeLegacyTtsManifestFixture } from '../../../../test-utils/manifest-helpers'

installVoiceQualityReportHooks()

describe('voice quality CLI report generation contracts', () => {
  test('benchmark --tts builds JSON and markdown reports with mocked model and STT metrics', async () => {
    const runDir = await makeTempRoot('autoshow-voice-quality-')
    const inputText = 'Hello world. This sample checks speech quality scoring with clear words and stable pacing.'
    const inputTextPath = join(runDir, 'input.txt')
    await writeFile(inputTextPath, `${inputText}\n`)

    const ttsEntries = [
      {
        ttsService: 'kitten',
        ttsModel: 'kitten-tts-nano',
        speaker: 'Jasper',
        processingTime: 1000,
        audioFileName: 'speech-kitten-kitten-tts-nano.wav',
        audioFileSize: 100,
        chunkCount: 1
      },
      {
        ttsService: 'openai',
        ttsModel: 'gpt-4o-mini-tts',
        speaker: 'alloy',
        processingTime: 900,
        audioFileName: 'speech-openai-gpt-4o-mini-tts.wav',
        audioFileSize: 100,
        chunkCount: 1
      },
      {
        ttsService: 'elevenlabs',
        ttsModel: 'eleven_v3',
        speaker: 'Rachel',
        processingTime: 800,
        audioFileName: 'speech-elevenlabs-eleven_v3.wav',
        audioFileSize: 100,
        chunkCount: 1
      }
    ]

    await writeLegacyTtsManifestFixture(runDir, {
        input: inputText,
        tts: ttsEntries,
        timing: {
          actual: {
            steps: ttsEntries.map((entry) => ({
              provider: entry.ttsService,
              model: entry.ttsModel,
              processingTimeMs: entry.processingTime
            }))
          }
        }
    })

    await mkdir(runDir, { recursive: true })
    await writeSyntheticWav(join(runDir, 'speech-kitten-kitten-tts-nano.wav'), {
      durationSeconds: 4.5,
      amplitude: 0.35,
      frequencyHz: 220
    })
    await writeSyntheticWav(join(runDir, 'speech-openai-gpt-4o-mini-tts.wav'), {
      durationSeconds: 4.7,
      amplitude: 0.32,
      frequencyHz: 260
    })
    await writeSyntheticWav(join(runDir, 'speech-elevenlabs-eleven_v3.wav'), {
      durationSeconds: 5.0,
      amplitude: 0.28,
      frequencyHz: 180
    })

    const fixturesPath = join(runDir, 'voice-quality-fixtures.json')
    await writeJson(fixturesPath, {
      providers: {
        'kitten/kitten-tts-nano': {
          utmosv2Mos: 4.2,
          nisqaTtsNaturalnessMos: 4.1,
          nisqaQualityMos: 4,
          dnsmosMos: 4,
          paidAudioJudge: { naturalnessScore: 82, confidence: 0.8 },
          stt: {
            'assemblyai/universal-2': inputText
          }
        },
        'openai/gpt-4o-mini-tts': {
          utmosv2Mos: 4.8,
          nisqaTtsNaturalnessMos: 4.6,
          nisqaQualityMos: 4.5,
          dnsmosMos: 4.6,
          paidAudioJudge: { naturalnessScore: 93, confidence: 0.9 },
          stt: {
            'assemblyai/universal-2': inputText
          }
        },
        'elevenlabs/eleven_v3': {
          utmosv2Mos: 2.6,
          nisqaTtsNaturalnessMos: 2.5,
          nisqaQualityMos: 2.7,
          dnsmosMos: 2.8,
          paidAudioJudge: { naturalnessScore: 45, confidence: 0.7 },
          stt: {
            'assemblyai/universal-2': 'Hello world this sample missed several important words.'
          }
        }
      }
    })

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'benchmark',
      runDir,
      '--tts',
      '--tts-mode',
      'local',
      '--tts-metric-fixtures',
      fixturesPath
    ], {
      env: {
        NO_COLOR: '1',
        OPENAI_API_KEY: '',
        ASSEMBLYAI_API_KEY: ''
      }
    })

    expect(result.exitCode).toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain('TTS Benchmark Report')

    const report = await Bun.file(join(runDir, 'voice-quality-report.json')).json() as {
      metric: string
      providerCount: number
      local: { count: number }
      cloud: { count: number }
      weights: {
        naturalnessScore: { utmosv2Mos: number }
        speechQualityScore: { roundtripSttIntelligibility: number }
      }
      providers: Array<{
        rank: number
        providerKey: string
        humanSpeechScore: number
        componentScores: {
          naturalness: { utmosv2Mos: { mos: number }, paidAudioJudgeRubric: { score: number } }
          speechQuality: { roundtripSttIntelligibility: { score: number } }
        }
        missingMetrics: string[]
      }>
    }

    expect(report.metric).toBe('human-speech-quality')
    expect(report.providerCount).toBe(3)
    expect(report.local.count).toBe(1)
    expect(report.cloud.count).toBe(2)
    expect(report.weights.naturalnessScore.utmosv2Mos).toBe(0.45)
    expect(report.weights.speechQualityScore.roundtripSttIntelligibility).toBe(0.25)
    expect(report.providers[0]?.providerKey).toBe('legacy:openai/gpt-4o-mini-tts')
    expect(report.providers[0]?.componentScores.naturalness.utmosv2Mos.mos).toBe(4.8)
    expect(report.providers[0]?.componentScores.naturalness.paidAudioJudgeRubric.score).toBe(93)
    expect(report.providers[0]?.componentScores.speechQuality.roundtripSttIntelligibility.score).toBe(100)
    expect(report.providers[0]?.missingMetrics).toEqual([])
    expect(report.providers[2]?.providerKey).toBe('legacy:elevenlabs/eleven_v3')

    const markdown = await Bun.file(join(runDir, 'voice-quality-report.md')).text()
    expect(markdown).toContain('# TTS Voice Quality Report')
    expect(markdown).toContain('Cost, provider processing speed, and provider latency are not included')
    expect(markdown).toContain('`legacy:openai/gpt-4o-mini-tts`')
  })
})
