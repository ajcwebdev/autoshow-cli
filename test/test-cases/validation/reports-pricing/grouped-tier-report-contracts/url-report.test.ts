import {
  describe,
  expect,
  test
} from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RankingSurfaceName, TtsRankingEntry } from '~/types'
import { expectRankingSurfaces, runConsensusBuildReport, setupTempRoots, writeJson } from './shared'

const makeTempRoot = setupTempRoots()

describe('grouped report contracts', () => {
  test('URL comparison report emits full ranking surfaces without tier output', async () => {
      const runDir = await makeTempRoot('autoshow-url-full-surfaces-')
      const providersDir = join(runDir, 'providers')
      await mkdir(providersDir, { recursive: true })
      await writeFile(join(runDir, 'consensus-extraction.txt'), 'alpha beta gamma delta epsilon zeta eta theta\n')

      const providerArtifacts = [
        { dir: 'defuddle', provider: 'defuddle', model: 'defuddle', text: 'alpha beta gamma delta epsilon zeta eta theta', processingTime: 500 },
        { dir: 'firecrawl', provider: 'firecrawl', model: 'firecrawl', text: 'alpha beta gamma delta epsilon zeta eta theta', processingTime: 1200, cost: 0.08 },
        { dir: 'spider', provider: 'spider', model: 'spider', text: 'alpha beta gamma delta epsilon zeta eta', processingTime: 900, cost: 0.12 },
        { dir: 'zyte', provider: 'zyte', model: 'zyte', text: 'alpha beta gamma delta', processingTime: 1800, cost: 0.16 },
        { dir: 'glm-reader', provider: 'glm-reader', model: 'glm-reader', text: 'alpha beta gamma delta epsilon zeta eta theta extra' }
      ]

      await writeJson(join(runDir, 'run.json'), {
        schemaVersion: 2,
        kind: 'url',
        metadata: {
          providerStates: providerArtifacts.map((artifact) => ({
            service: artifact.provider,
            model: artifact.model,
            artifactDir: `providers/${artifact.dir}`,
            status: 'succeeded'
          })),
          cost: {
            actual: {
              steps: providerArtifacts
                .filter((artifact) => artifact.cost !== undefined)
                .map((artifact) => ({ provider: artifact.provider, model: artifact.model, cost: artifact.cost }))
            }
          },
          timing: {
            actual: {
              steps: providerArtifacts
                .filter((artifact) => artifact.processingTime !== undefined)
                .map((artifact) => ({
                  provider: artifact.provider,
                  model: artifact.model,
                  processingTimeMs: artifact.processingTime
                }))
            }
          }
        }
      })

      for (const artifact of providerArtifacts) {
        const providerDir = join(providersDir, artifact.dir)
        await mkdir(providerDir, { recursive: true })
        await writeJson(join(providerDir, 'result.json'), {
          schemaVersion: 2,
          kind: 'provider-result',
          provider: artifact.provider,
          model: artifact.model,
          metadata: artifact.processingTime === undefined ? {} : { processingTime: artifact.processingTime },
          result: { text: artifact.text }
        })
      }

      const { stderr } = await runConsensusBuildReport('url', runDir)
      expect(stderr).toBe('')

      const report = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
        overall?: unknown
        overallMetric?: unknown
        overallWeights?: unknown
        tiering?: unknown
        rankingSurfaces: Record<'local' | 'service', Record<RankingSurfaceName, TtsRankingEntry[]> & {
          humanQualityUnavailableReason: string | null
        }>
      }

      expect(report.overall).toBeUndefined()
      expect(report.overallMetric).toBeUndefined()
      expect(report.overallWeights).toBeUndefined()
      expect(report.tiering).toBeUndefined()
      expectRankingSurfaces(report)
      expect(report.rankingSurfaces.service.price).toHaveLength(4)
      expect(report.rankingSurfaces.service.speed).toHaveLength(4)
      expect(report.rankingSurfaces.service.automatedQuality).toHaveLength(4)
      expect(report.rankingSurfaces.service.humanQuality).toHaveLength(0)
      expect(report.rankingSurfaces.service.humanQualityUnavailableReason).toContain('humanQualityScore')
      expect(report.rankingSurfaces.service.price.at(-1)).toMatchObject({
        providerKey: 'glm-reader',
        value: null,
        label: 'n/a'
      })
      expect(report.rankingSurfaces.service.speed.at(-1)).toMatchObject({
        providerKey: 'glm-reader',
        value: null,
        label: 'n/a'
      })
      expect(report.rankingSurfaces.service.automatedQuality[0]).toMatchObject({
        providerKey: 'firecrawl',
        metric: 'WER/CER/coverage accuracy'
      })
      expect(report.rankingSurfaces.service.automatedQuality[0]?.label).toContain('WER')
      expect(report.rankingSurfaces.service.automatedQuality[0]?.label).toContain('CER')
      expect(report.rankingSurfaces.service.automatedQuality[0]?.label).toContain('coverage')
      expect(report.rankingSurfaces.service.fastest.map((entry) => entry.providerKey)).toEqual(
        report.rankingSurfaces.service.speed.map((entry) => entry.providerKey)
      )
      expect(report.rankingSurfaces.service.cheapest.map((entry) => entry.providerKey)).toEqual(
        report.rankingSurfaces.service.price.map((entry) => entry.providerKey)
      )
      expect(report.rankingSurfaces.service.highestQuality.map((entry) => entry.providerKey)).toEqual(
        report.rankingSurfaces.service.automatedQuality.map((entry) => entry.providerKey)
      )

      const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
      expect(markdown).toContain('## Local Providers')
      expect(markdown).toContain('## Service Providers')
      expect(markdown).toContain('### Price')
      expect(markdown).toContain('### Speed')
      expect(markdown).toContain('### Automated Quality')
      expect(markdown).toContain('### Human Quality')
      expect(markdown).not.toContain('Top 3')
      expect(markdown).not.toContain('## Overall Ranking')
      expect(markdown).not.toContain('## Tier Breakdown')
      expect(markdown).not.toContain('## Ranking')
    })
})
