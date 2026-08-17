import {
  describe,
  expect,
  test
} from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MetricName, MetricRankingEntry } from '~/types'
import { writeMultiProviderManifestFixture } from '../../../../test-utils/manifest-helpers'
import {
  expectMetricRankings,
  runConsensusBuildReport,
  setupTempRoots
} from './shared'

const makeTempRoot = setupTempRoots()

describe('grouped report contracts', () => {
  test('STT comparison report emits full metric rankings split by diarization support', async () => {
      const runDir = await makeTempRoot('autoshow-stt-diarization-tiering-')
      await writeFile(join(runDir, 'consensus-transcription.txt'), [
        '[00:00:00] [speaker-1] Alpha beta.',
        '[00:00:04] [speaker-2] Gamma delta.'
      ].join('\n') + '\n')

      const providerArtifacts = [
        {
          dir: 'assemblyai-universal-3-pro',
          provider: 'assemblyai',
          model: 'universal-3-pro',
          processingTime: 1000,
          cost: 0.4,
          hasSpeakerLabels: true,
          segments: [
            { start: '00:00:00', end: '00:00:04', speaker: 'speaker-A', text: 'Alpha beta.' },
            { start: '00:00:04', end: '00:00:08', speaker: 'speaker-B', text: 'Gamma delta.' }
          ]
        },
        {
          dir: 'gladia-default',
          provider: 'gladia',
          model: 'default',
          processingTime: 2000,
          cost: 0.5,
          hasSpeakerLabels: true,
          segments: [
            { start: '00:00:00', end: '00:00:04', speaker: 'speaker-0', text: 'Alpha beta.' },
            { start: '00:00:04', end: '00:00:08', speaker: 'speaker-1', text: 'Gamma delta.' }
          ]
        },
        {
          dir: 'mistral-voxtral-mini-2602',
          provider: 'mistral',
          model: 'voxtral-mini-2602',
          processingTime: 1500,
          cost: 0.3,
          hasSpeakerLabels: false,
          segments: [{ start: '00:00:00', end: '00:00:08', text: 'Alpha beta. Gamma delta.' }]
        },
        {
          dir: 'deepinfra-openai_whisper-large-v3',
          provider: 'deepinfra',
          model: 'openai/whisper-large-v3',
          processingTime: 2500,
          cost: 0.2,
          hasSpeakerLabels: false,
          segments: [{ start: '00:00:00', end: '00:00:08', text: 'Alpha beta. Gamma delta.' }]
        },
        {
          dir: 'whisper-base',
          provider: 'whisper',
          model: 'base',
          processingTime: 3000,
          hasSpeakerLabels: false,
          segments: [{ start: '00:00:00', end: '00:00:08', text: 'Alpha beta. Gamma delta.' }]
        }
      ]

      await writeMultiProviderManifestFixture(runDir, {
        command: 'extract',
        extractRoute: 'media',
        metadata: {
          step1: { durationSeconds: 8, duration: '00:00:08' }
        },
        providerMetadata: { tokenCount: 4 },
        providers: providerArtifacts.map((artifact) => ({
          ...artifact,
          result: {
            text: 'Alpha beta. Gamma delta.',
            segments: artifact.segments,
            evidence: {
              timingQuality: artifact.hasSpeakerLabels ? 'native_word' : 'segment_interpolated',
              capabilities: { hasSpeakerLabels: artifact.hasSpeakerLabels }
            }
          }
        }))
      })

      const { stderr } = await runConsensusBuildReport('stt', runDir)
      expect(stderr).toBe('')

  	    const report = await Bun.file(join(runDir, 'reference-comparison-report.json')).json() as {
  	      rankingSurfaces?: unknown
  	      overall?: unknown
  	      overallMetric?: unknown
  	      overallWeights?: unknown
  	      tiering?: unknown
  	      providers?: unknown
	      audioDurationSeconds: number
  	      metricRankings: Record<'local' | 'thirdPartyServiceNonDiarization' | 'thirdPartyServiceDiarization', Record<MetricName, MetricRankingEntry[]>>
  	      providerGroups: {
  	        local: { count: number, providers: Array<{ supportsDiarization: boolean, diarizationSupport: string }> }
  	        thirdPartyServiceNonDiarization: { count: number, providers: Array<{ supportsDiarization: boolean, diarizationSupport: string }> }
	        thirdPartyServiceDiarization: { count: number, providers: Array<{ supportsDiarization: boolean, diarizationSupport: string, audioDurationSeconds: number, realtimeFactor: number | null }> }
  	      }
  	    }

   	    expect(report.rankingSurfaces).toBeUndefined()
  	    expect(report.overall).toBeUndefined()
  	    expect(report.overallMetric).toBeUndefined()
  	    expect(report.overallWeights).toBeUndefined()
  	    expect(report.tiering).toBeUndefined()
  	    expect(report.providers).toBeUndefined()
	    expect(report.audioDurationSeconds).toBe(8)
  	    expectMetricRankings(report.metricRankings, ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization'] as const)
  	    expect(report.providerGroups.local.count).toBe(1)
  	    expect(report.providerGroups.thirdPartyServiceDiarization.count).toBe(2)
  	    expect(report.providerGroups.thirdPartyServiceNonDiarization.count).toBe(2)
  	    expect(report.providerGroups.thirdPartyServiceDiarization.providers.every((provider) => provider.supportsDiarization === true && provider.diarizationSupport === 'supported')).toBe(true)
	    expect(report.providerGroups.thirdPartyServiceDiarization.providers.map((provider) => provider.realtimeFactor)).toEqual([8, 4])
	    expect(report.providerGroups.thirdPartyServiceDiarization.providers.every((provider) => provider.audioDurationSeconds === 8)).toBe(true)
  	    expect(report.providerGroups.thirdPartyServiceNonDiarization.providers.every((provider) => provider.supportsDiarization === false && provider.diarizationSupport === 'not-supported')).toBe(true)
  	    expect(report.metricRankings.local.price).toHaveLength(1)
  	    expect(report.metricRankings.local.speed).toHaveLength(1)
  	    expect(report.metricRankings.local.qualityScore).toHaveLength(1)
  	    expect(report.metricRankings.thirdPartyServiceDiarization.price).toHaveLength(2)
  	    expect(report.metricRankings.thirdPartyServiceDiarization.speed).toHaveLength(2)
  	    expect(report.metricRankings.thirdPartyServiceDiarization.qualityScore).toHaveLength(2)
  	    expect(report.metricRankings.thirdPartyServiceNonDiarization.price).toHaveLength(2)
  	    expect(report.metricRankings.thirdPartyServiceNonDiarization.speed).toHaveLength(2)
  	    expect(report.metricRankings.thirdPartyServiceNonDiarization.qualityScore).toHaveLength(2)
  	    expect(report.metricRankings.local.price[0]?.value).toBe(0)
  	    expect(report.metricRankings.thirdPartyServiceDiarization.price.map((entry) => entry.providerKey)).toEqual(['assemblyai/universal-3-pro', 'gladia/default'])
  	    expect(report.metricRankings.thirdPartyServiceNonDiarization.price.map((entry) => entry.providerKey)).toEqual(['deepinfra/openai/whisper-large-v3', 'mistral/voxtral-mini-2602'])
  	    expect(report.metricRankings.thirdPartyServiceNonDiarization.speed.map((entry) => entry.providerKey)).toEqual(['mistral/voxtral-mini-2602', 'deepinfra/openai/whisper-large-v3'])
  	    expect(report.metricRankings.thirdPartyServiceDiarization.qualityScore.every((entry) => entry.score !== null && entry.speakerAwareWER !== null && entry.textOnlyWER !== null && entry.diarizationSupport === 'supported')).toBe(true)
  	    expect(report.metricRankings.thirdPartyServiceNonDiarization.qualityScore.every((entry) => entry.score !== null && entry.speakerAwareWER !== null && entry.textOnlyWER !== null && entry.diarizationSupport === 'not-supported')).toBe(true)

  	    const markdown = await Bun.file(join(runDir, 'reference-comparison-report.md')).text()
  	    expect(markdown).toContain('## Metric Rankings')
  	    expect(markdown).toContain('### Local')
  	    expect(markdown).toContain('### Third-Party Service Non-Diarization')
  	    expect(markdown).toContain('### Third-Party Service Diarization')
  	    expect(markdown).toContain('#### Price')
  	    expect(markdown).toContain('#### Speed')
  	    expect(markdown).toContain('#### Quality Score')
	    expect(markdown).toContain('8.00× realtime')
  	    expect(markdown).not.toContain('## Overall Ranking')
  	    expect(markdown).not.toContain('## Tier Breakdown')
  	    expect(markdown).not.toContain('## Ranking')
  	    expect(markdown).not.toContain('Top 3')
  	  })
})
