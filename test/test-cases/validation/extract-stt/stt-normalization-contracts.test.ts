import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseWhisperJson, extractWhisperWords } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/parse-whisper-output'
import {
  detectCompressedTimingCoverage,
  repairZeroDurationMonotonicSegments
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-timing-quality'
import type { MetricName, SttNormalizationMetricRankingEntry } from '~/types'
import { writeMultiProviderRunFixture } from '../../../test-utils/manifest-helpers'

const tempDirs: string[] = []

const makeTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-stt-normalization-'))
  tempDirs.push(root)
  return root
}

const readStreamText = async (
  stream: ReadableStream<Uint8Array> | number | undefined | null
): Promise<string> =>
  stream && typeof stream !== 'number' ? await new Response(stream).text() : ''

const deprecatedTierSplitKey = 'tier' + 'Split'
const deprecatedOverallTierKey = 'overall' + 'Tier'

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('STT normalization contracts', () => {
  test('repairs monotonic all-zero OpenAI-compatible segment durations', () => {
    const repaired = repairZeroDurationMonotonicSegments([
      { start: '00:00:00', end: '00:00:00', text: 'first' },
      { start: '00:00:04', end: '00:00:04', text: 'second' },
      { start: '00:00:08', end: '00:00:08', text: 'third' }
    ], { knownEndSeconds: 12 })

    expect(repaired.repaired).toBe(true)
    expect(repaired.segments.map((segment) => segment.end)).toEqual(['00:00:04.000', '00:00:08.000', '00:00:12.000'])
  })

  test('detects compressed Gemini timing coverage with known duration', () => {
    const assessment = detectCompressedTimingCoverage([
      { start: '00:00:00', end: '00:00:02', text: 'one' },
      { start: '00:00:02', end: '00:00:04', text: 'two' },
      { start: '00:00:04', end: '00:00:06', text: 'three' }
    ], { knownEndSeconds: 60 })

    expect(assessment?.compressed).toBe(true)
    expect(assessment?.coverageRatio).toBeLessThan(0.75)
  })

  test('clamps Whisper segment and word end times to known duration', () => {
    const whisperJson = JSON.stringify({
      transcription: [
        {
          timestamps: { from: '00:00:00.000', to: '00:00:02.000' },
          offsets: { from: 0, to: 2 },
          text: 'hello'
        },
        {
          timestamps: { from: '00:00:02.000', to: '00:00:12.500' },
          offsets: { from: 2, to: 12.5 },
          text: ' world.'
        }
      ]
    })

    const words = extractWhisperWords(whisperJson, { maxEndSeconds: 10 })
    const parsed = parseWhisperJson(whisperJson, { maxEndSeconds: 10 })

    expect(words.at(-1)?.end).toBe(10)
    expect(parsed.segments.at(-1)?.end).toBe('00:00:10.000')
  })

  test('reference report includes quality warnings, segment stats, and duplicate groups', async () => {
    const runDir = await makeTempRoot()
    await writeFile(join(runDir, 'consensus-transcription.txt'), '[00:00:00] [speaker-1] Hello world.\n')

    const providerArtifacts = [
      {
        dir: 'mistral-voxtral-mini-2602',
        provider: 'mistral',
        model: 'voxtral-mini-2602',
        processingTime: 1,
        result: {
          text: 'Hello world.',
          segments: [{ start: '00:00:00', end: '00:00:00', text: 'Hello world.' }],
          evidence: { timingQuality: 'coarse', capabilities: { hasSpeakerLabels: false } }
        }
      },
      {
        dir: 'supadata-auto',
        provider: 'supadata',
        model: 'auto',
        processingTime: 1,
        result: {
          text: 'Hello world.',
          segments: [{ start: '00:00:00', end: '00:00:05', text: 'Hello world.' }],
          evidence: { timingQuality: 'coarse', capabilities: { hasSpeakerLabels: false } }
        }
      },
      {
        dir: 'supadata-native',
        provider: 'supadata',
        model: 'native',
        processingTime: 1,
        result: {
          text: 'Hello world.',
          segments: [{ start: '00:00:00', end: '00:00:05', text: 'Hello world.' }],
          evidence: { timingQuality: 'coarse', capabilities: { hasSpeakerLabels: false } }
        }
      }
    ]

    await writeMultiProviderRunFixture(runDir, {
      kind: 'extract',
      metadata: { step1: { durationSeconds: 10, duration: '00:00:10' } },
      providerMetadata: { tokenCount: 2 },
      providers: providerArtifacts
    })

    const proc = Bun.spawn([
      process.execPath,
      '.codex/skills/consensus/scripts/run.ts',
      'stt',
      'build-report',
      runDir
    ], {
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      readStreamText(proc.stdout),
      readStreamText(proc.stderr),
      proc.exited
    ])
    expect(stdout).toContain('Rewrote')
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)

	    const report = await Bun.file(join(runDir, 'reference-comparison-report.json')).json() as {
	      rankingSurfaces?: unknown
	      overall?: unknown
	      overallMetric?: unknown
	      overallWeights?: unknown
	      tiering?: unknown
	      providers?: unknown
	      metricRankings: Record<'local' | 'thirdPartyServiceNonDiarization' | 'thirdPartyServiceDiarization', Record<MetricName, SttNormalizationMetricRankingEntry[]>>
	      duplicateGroups: Array<{ providers: string[] }>
	      providerGroups: {
	        local: { count: number, providers: Array<unknown> }
	        thirdPartyServiceDiarization: { count: number, providers: Array<unknown> }
	        thirdPartyServiceNonDiarization: {
	          count: number
	          providers: Array<{
	            provider: string
	            supportsDiarization: boolean
	            diarizationSupport: string
	            qualityWarnings: string[]
	            segmentStats: { segmentCount: number }
	            duplicateGroupId?: string
	          }>
	        }
	      }
	    }
	    const serviceProviders = report.providerGroups.thirdPartyServiceNonDiarization.providers
	    expect(report.duplicateGroups).toHaveLength(1)
	    expect(report.rankingSurfaces).toBeUndefined()
	    expect(report.overall).toBeUndefined()
	    expect(report.overallMetric).toBeUndefined()
	    expect(report.overallWeights).toBeUndefined()
	    expect(report.tiering).toBeUndefined()
	    expect(report.providers).toBeUndefined()
	    expect(report.metricRankings.local.price).toHaveLength(0)
	    expect(report.metricRankings.local.speed).toHaveLength(0)
	    expect(report.metricRankings.local.qualityScore).toHaveLength(0)
	    expect(report.metricRankings.thirdPartyServiceDiarization.price).toHaveLength(0)
	    expect(report.metricRankings.thirdPartyServiceDiarization.speed).toHaveLength(0)
	    expect(report.metricRankings.thirdPartyServiceDiarization.qualityScore).toHaveLength(0)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.price).toHaveLength(3)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.speed).toHaveLength(3)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.qualityScore).toHaveLength(3)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.price.every((entry) => entry.value === null && entry.label === 'n/a')).toBe(true)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.speed.every((entry, index) => entry.rank === index + 1 && entry.metric === 'speed')).toBe(true)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.qualityScore.every((entry) => entry.score !== null && entry.speakerAwareWER !== null && entry.textOnlyWER !== null && entry.diarizationSupport === 'not-supported')).toBe(true)
	    expect(serviceProviders.find((provider) => provider.provider === 'mistral-voxtral-mini-2602')?.qualityWarnings.join(' ')).toContain('coarse')
	    expect(serviceProviders.find((provider) => provider.provider === 'supadata-auto')?.duplicateGroupId).toBeDefined()
	    expect(serviceProviders[0]?.segmentStats.segmentCount).toBeGreaterThan(0)
	    expect(deprecatedTierSplitKey in report).toBe(false)
	    expect('tiers' in report).toBe(false)
	    expect(serviceProviders.every((provider) => provider.supportsDiarization === false && provider.diarizationSupport === 'not-supported')).toBe(true)
	    expect(serviceProviders.every((provider) => !(deprecatedOverallTierKey in provider))).toBe(true)

	    const markdown = await Bun.file(join(runDir, 'reference-comparison-report.md')).text()
	    expect(markdown).toContain('## Metric Rankings')
	    expect(markdown).toContain('### Third-Party Service Non-Diarization')
	    expect(markdown).toContain('## Quality Flags')
	    expect(markdown).toContain('## Duplicate Groups')
	    expect(markdown).not.toContain('## Overall Ranking')
	    expect(markdown).not.toContain('## Tier Breakdown')
	    expect(markdown).not.toContain('## Ranking')
  })
})
