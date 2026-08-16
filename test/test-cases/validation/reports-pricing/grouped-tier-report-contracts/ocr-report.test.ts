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
  test('OCR comparison report emits full metric rankings by provider group', async () => {
      const runDir = await makeTempRoot('autoshow-ocr-tiering-')
      await writeFile(join(runDir, 'consensus-extraction.txt'), 'alpha beta gamma\n')

      const providerArtifacts = [
        { dir: 'tesseract-tesseract', provider: 'tesseract', model: 'tesseract', text: 'alpha beta gamma', processingTime: 1000 },
        { dir: 'mistral-mistral-ocr', provider: 'mistral', model: 'mistral-ocr', text: 'alpha beta gamma', processingTime: 1500, cost: 0.25 },
        { dir: 'openai-gpt-4o-mini', provider: 'openai', model: 'gpt-4o-mini', text: 'alpha gamma', processingTime: 3000, cost: 0.5 }
      ]

      await writeMultiProviderManifestFixture(runDir, {
        command: 'extract',
        extractRoute: 'document',
        metadata: {
          step2: [{ extractionMethod: 'ocr', totalPages: 1, ocrPages: 1, textPages: 0 }]
        },
        providerMetadata: { tokenEstimate: 3 },
        providers: providerArtifacts.map((artifact) => ({
          ...artifact,
          result: {
            text: artifact.text,
            pages: [{ pageNumber: 0, method: 'ocr', text: artifact.text }],
            totalPages: 1
          }
        }))
      })

      const { stderr } = await runConsensusBuildReport('ocr', runDir)
      expect(stderr).toBe('')

  	    const report = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
  	      rankingSurfaces?: unknown
  	      overall?: unknown
  	      overallMetric?: unknown
  	      overallWeights?: unknown
  	      tiering?: unknown
  	      providers?: unknown
  	      consensusSkillArtifacts?: Record<string, string>
  	      metricRankings: Record<'local' | 'thirdPartyService', Record<MetricName, MetricRankingEntry[]>>
  	      providerGroups: {
  	        local: { count: number, providers: Array<{ group: string, metrics: { score: number, wer: number, cer: number } }> }
  	        thirdPartyService: { count: number, providers: Array<{ group: string, metrics: { score: number, wer: number, cer: number } }> }
  	      }
  	    }

   	    expect(report.rankingSurfaces).toBeUndefined()
  	    expect(report.overall).toBeUndefined()
  	    expect(report.overallMetric).toBeUndefined()
  	    expect(report.overallWeights).toBeUndefined()
  	    expect(report.tiering).toBeUndefined()
  	    expect(report.providers).toBeUndefined()
  	    expectMetricRankings(report.metricRankings, ['local', 'thirdPartyService'] as const)
  	    expect(report.providerGroups.local.count).toBe(1)
  	    expect(report.providerGroups.thirdPartyService.count).toBe(2)
  	    expect(report.metricRankings.local.price).toHaveLength(1)
  	    expect(report.metricRankings.local.speed).toHaveLength(1)
  	    expect(report.metricRankings.local.qualityScore).toHaveLength(1)
  	    expect(report.metricRankings.thirdPartyService.price).toHaveLength(2)
  	    expect(report.metricRankings.thirdPartyService.speed).toHaveLength(2)
  	    expect(report.metricRankings.thirdPartyService.qualityScore).toHaveLength(2)
  	    expect(report.metricRankings.local.price.every((entry) => entry.value === 0 && entry.label === '$0.00 local monetary cost')).toBe(true)
  	    expect(report.metricRankings.local.speed.map((entry) => entry.providerKey)).toEqual(['tesseract/tesseract'])
  	    expect(report.metricRankings.local.qualityScore.map((entry) => entry.providerKey)).toEqual(['tesseract/tesseract'])
  	    expect(report.metricRankings.thirdPartyService.price.map((entry) => entry.providerKey)).toEqual(['mistral/mistral-ocr', 'openai/gpt-4o-mini'])
  	    expect(report.metricRankings.thirdPartyService.speed.map((entry) => entry.providerKey)).toEqual(['mistral/mistral-ocr', 'openai/gpt-4o-mini'])
  	    expect(report.metricRankings.thirdPartyService.qualityScore.map((entry) => entry.providerKey)).toEqual(['mistral/mistral-ocr', 'openai/gpt-4o-mini'])
  	    expect(report.metricRankings.local.qualityScore.every((entry) => entry.score !== null && entry.wer !== null && entry.cer !== null)).toBe(true)
  	    expect(report.metricRankings.thirdPartyService.qualityScore.every((entry) => entry.score !== null && entry.wer !== null && entry.cer !== null)).toBe(true)
  	    expect(report.consensusSkillArtifacts?.['pageMetrics']).toBe('page-metrics.json')
  	    expect(report.consensusSkillArtifacts?.['outliers']).toBe('outliers.json')
  	    expect(report.consensusSkillArtifacts?.['selectiveAdjudicationPages']).toBe('selective-adjudication-pages.json')
  	    expect(report.consensusSkillArtifacts?.['variantComparisonSummary']).toBe('variant-comparison-summary.json')
  	    expect(report.consensusSkillArtifacts?.['benchmarkSummary']).toBe('ocr-benchmark-summary.md')

  	    const pageMetrics = await Bun.file(join(runDir, 'page-metrics.json')).json() as {
  	      pages: Array<{ selectedProviderKey: string | null, selectedConfidence: number | null, providers: unknown[] }>
  	    }
  	    const outliers = await Bun.file(join(runDir, 'outliers.json')).json() as { blankOutputPages: unknown[], lowConfidencePages: unknown[] }
  	    const adjudicationPages = await Bun.file(join(runDir, 'selective-adjudication-pages.json')).json() as { pages: unknown[] }
  	    const variantSummary = await Bun.file(join(runDir, 'variant-comparison-summary.json')).json() as { pairwiseDistances: unknown[] }
  	    const benchmarkSummary = await Bun.file(join(runDir, 'ocr-benchmark-summary.md')).text()

  	    expect(pageMetrics.pages).toHaveLength(1)
  	    expect(pageMetrics.pages[0]?.selectedProviderKey).toBeTruthy()
  	    expect(pageMetrics.pages[0]?.selectedConfidence).not.toBeNull()
  	    expect(pageMetrics.pages[0]?.providers).toHaveLength(3)
  	    expect(Array.isArray(outliers.blankOutputPages)).toBe(true)
  	    expect(Array.isArray(outliers.lowConfidencePages)).toBe(true)
  	    expect(Array.isArray(adjudicationPages.pages)).toBe(true)
  	    expect(variantSummary.pairwiseDistances).toHaveLength(1)
  	    expect(benchmarkSummary).toContain('OCR Consensus Benchmark Summary')

  	    const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
  	    expect(markdown).toContain('## Metric Rankings')
  	    expect(markdown).toContain('### Local')
  	    expect(markdown).toContain('### Third-Party Service')
  	    expect(markdown).toContain('#### Price')
  	    expect(markdown).toContain('#### Speed')
  	    expect(markdown).toContain('#### Quality Score')
  	    expect(markdown).not.toContain('## Overall Ranking')
  	    expect(markdown).not.toContain('## Tier Breakdown')
  	    expect(markdown).not.toContain('## Ranking')
  	    expect(markdown).not.toContain('Top 3')
  	  })
})
