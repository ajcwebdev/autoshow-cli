import {
  describe,
  expect,
  test
} from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RankingSurfaceName, TtsRankingEntry } from '~/types'
import { writeReportInputTtsManifestFixture } from '../../../../test-utils/manifest-helpers'
import {
  expectTtsRankingSurfaces,
  runConsensusBuildReport,
  setupTempRoots,
  writeJson
} from './shared'

const makeTempRoot = setupTempRoots()

describe('grouped report contracts', () => {
  test('TTS comparison report emits metric ranking surfaces without overall or tiers', async () => {
      const runDir = await makeTempRoot('autoshow-tts-tiering-')
      const inputTextPath = join(runDir, 'input.txt')
      await writeFile(inputTextPath, 'A short input text for synthetic speech comparison.\n')

      const ttsEntries = [
        { ttsService: 'openai', ttsModel: 'gpt-4o-mini-tts', speaker: 'alloy', processingTime: 2500, audioFileName: 'missing-openai.wav', audioFileSize: 120, chunkCount: 1 },
        { ttsService: 'elevenlabs', ttsModel: 'eleven_v3', speaker: 'Rachel', processingTime: 900, audioFileName: 'missing-elevenlabs.wav', audioFileSize: 130, chunkCount: 1 },
        { ttsService: 'minimax', ttsModel: 'speech-02-hd', speaker: 'Wise_Woman', processingTime: 1800, audioFileName: 'missing-minimax.wav', audioFileSize: 140, chunkCount: 1 },
        { ttsService: 'cartesia', ttsModel: 'sonic-3', speaker: 'Narrator', processingTime: 3200, audioFileName: 'missing-cartesia.wav', audioFileSize: 150, chunkCount: 1 }
      ]

      const qualityByProvider: Record<string, { humanSpeechScore: number, medianWer: number }> = {
        'openai/gpt-4o-mini-tts': { humanSpeechScore: 91, medianWer: 0.04 },
        'elevenlabs/eleven_v3': { humanSpeechScore: 85, medianWer: 0.12 },
        'minimax/speech-02-hd': { humanSpeechScore: 70, medianWer: 0.01 },
        'cartesia/sonic-3': { humanSpeechScore: 94, medianWer: 0.08 }
      }

      await writeReportInputTtsManifestFixture(runDir, {
          tts: ttsEntries,
          cost: {
            actual: {
              steps: [
                { provider: 'openai', model: 'gpt-4o-mini-tts', cost: 6 },
                { provider: 'elevenlabs', model: 'eleven_v3', cost: 9 },
                { provider: 'minimax', model: 'speech-02-hd', cost: 3 },
                { provider: 'cartesia', model: 'sonic-3', cost: 12 }
              ]
            }
          },
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

      await writeJson(join(runDir, 'voice-quality-report.json'), {
        providers: ttsEntries.map((entry) => {
          const providerKey = `${entry.ttsService}/${entry.ttsModel}`
          const quality = qualityByProvider[providerKey]!
          return {
            providerKey,
            ttsService: entry.ttsService,
            ttsModel: entry.ttsModel,
            group: 'cloud',
            humanSpeechScore: quality.humanSpeechScore,
            metricDetails: {
              roundtripStt: {
                medianWer: quality.medianWer,
                engines: []
              }
            }
          }
        })
      })

      const { stderr } = await runConsensusBuildReport('tts', runDir, ['--input-text', inputTextPath])
      expect(stderr).toContain('Missing audio files')

      const report = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
        rankingSurfaces: Record<'local' | 'service', Record<RankingSurfaceName, TtsRankingEntry[]>>
        providerGroups: {
          local: { count: number, providers: Array<{ providerKey: string }> }
          service: { count: number, providers: Array<{ providerKey: string; tierGroup?: unknown; groupOverallRank?: unknown; groupTier?: unknown }> }
        }
        tiering?: unknown
        overall?: unknown
        providers?: unknown
      }

      expect(report.overall).toBeUndefined()
      expect(report.tiering).toBeUndefined()
      expect(report.providers).toBeUndefined()
      expectTtsRankingSurfaces(report)
      expect(report.providerGroups.local.providers).toEqual([])
      expect(report.providerGroups.service.providers).toHaveLength(4)
      expect(report.providerGroups.service.providers.every((provider) => provider.tierGroup === undefined)).toBe(true)
      expect(report.providerGroups.service.providers.every((provider) => provider.groupOverallRank === undefined)).toBe(true)
      expect(report.providerGroups.service.providers.every((provider) => provider.groupTier === undefined)).toBe(true)
      expect(report.rankingSurfaces.local.price).toHaveLength(0)
      expect(report.rankingSurfaces.service.price).toHaveLength(4)
      expect(report.rankingSurfaces.local.speed).toHaveLength(0)
      expect(report.rankingSurfaces.service.speed).toHaveLength(4)
      expect(report.rankingSurfaces.local.automatedQuality).toHaveLength(0)
      expect(report.rankingSurfaces.service.automatedQuality).toHaveLength(4)
      expect(report.rankingSurfaces.local.humanQuality).toHaveLength(0)
      expect(report.rankingSurfaces.service.humanQuality).toHaveLength(4)
      expect(report.rankingSurfaces.service.price.map((entry) => entry.providerKey)).toEqual([
        'minimax/speech-02-hd',
        'openai/gpt-4o-mini-tts',
        'elevenlabs/eleven_v3',
        'cartesia/sonic-3'
      ])
      expect(report.rankingSurfaces.service.speed.map((entry) => entry.providerKey)).toEqual([
        'elevenlabs/eleven_v3',
        'minimax/speech-02-hd',
        'openai/gpt-4o-mini-tts',
        'cartesia/sonic-3'
      ])
      expect(report.rankingSurfaces.service.automatedQuality.map((entry) => entry.providerKey)).toEqual([
        'minimax/speech-02-hd',
        'openai/gpt-4o-mini-tts',
        'cartesia/sonic-3',
        'elevenlabs/eleven_v3'
      ])
      expect(report.rankingSurfaces.service.automatedQuality.every((entry) => entry.metric === 'roundtrip WER accuracy' && entry.label.includes('roundtrip WER'))).toBe(true)
      expect(report.rankingSurfaces.service.humanQuality.map((entry) => entry.providerKey)).toEqual([
        'cartesia/sonic-3',
        'openai/gpt-4o-mini-tts',
        'elevenlabs/eleven_v3',
        'minimax/speech-02-hd'
      ])
      expect(report.rankingSurfaces.service.highestQuality.map((entry) => entry.providerKey)).toEqual(
        report.rankingSurfaces.service.humanQuality.map((entry) => entry.providerKey)
      )
      expect(report.rankingSurfaces.service.cheapest.map((entry) => entry.providerKey)).toEqual(
        report.rankingSurfaces.service.price.map((entry) => entry.providerKey)
      )

      const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
      expect(markdown).toContain('## Local Models')
      expect(markdown).toContain('## Third-Party Service Models')
      expect(markdown).toContain('### Price')
      expect(markdown).toContain('### Speed')
      expect(markdown).toContain('### Automated Quality')
      expect(markdown).toContain('### Human Quality')
      expect(markdown).not.toContain('Top 3')
      expect(markdown).not.toContain('## Overall Ranking')
      expect(markdown).not.toContain('## Tier Breakdown')
    })
})
