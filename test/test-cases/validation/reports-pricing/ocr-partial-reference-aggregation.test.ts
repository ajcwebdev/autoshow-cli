import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOcrCombinedReport } from '../../../../.codex/skills/consensus/scripts/ocr/build_combined_report'

test('partial annotated-word references retain cost/speed but cannot add primary quality or weighted errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ocr-partial-aggregation-'))
  try {
    const write = async (name: string, partial: boolean) => {
      const run = join(root, name)
      await mkdir(run)
      await Bun.write(join(run, 'page-metrics.json'), JSON.stringify({ pageCount: 1 }))
      await Bun.write(join(run, 'provider-comparison-report.json'), JSON.stringify({
        runName: name, providerCount: 1,
        ...(partial ? { evaluation: { primaryRegionAccuracyAvailable: false } } : {}),
        providerGroups: { thirdPartyService: { count: 1, providers: [{
          providerKey: 'openai/example', provider: 'openai', model: 'example', group: 'thirdPartyService',
          processingTimeMs: partial ? 3000 : 1000, costCents: partial ? 4 : 2,
          // Deliberately populated diagnostic values must never enter primary aggregation.
          metrics: { score: partial ? 0 : 90, wer: partial ? 1 : 0.1, cer: partial ? 1 : 0.03 },
          werBreakdown: { substitutions: partial ? 100 : 10, deletions: 0, insertions: 0, referenceCount: 100 },
          cerBreakdown: { substitutions: partial ? 100 : 3, deletions: 0, insertions: 0, referenceCount: 100 }
        }] } }
      }))
    }
    await write('full-reference', false)
    const before = buildOcrCombinedReport(root)
    expect(before.dashboardModel.notes.some(note => note.includes('partial annotated-word'))).toBe(false)
    await write('partial-reference', true)
    const result = buildOcrCombinedReport(root)
    const row = result.dashboardModel.groups[1]!.providers[0]!
    const report = result.report as { metricRankings: { thirdPartyService: { qualityScore: Array<{ weightedWER: number, weightedCER: number, runsCovered: number }> } } }
    expect(result.runCount).toBe(2)
    expect(result.totalPages).toBe(2)
    expect(row.quality.value).toBe(90)
    expect(row.cost.value).toBe(3)
    expect(row.speed.value).toBe(30)
    expect(row.perRun[1]!.heat).toBeNull()
    expect(row.perRun[1]!.display).toBe('—')
    expect(report.metricRankings.thirdPartyService.qualityScore[0]!.weightedWER).toBeCloseTo(0.1)
    expect(report.metricRankings.thirdPartyService.qualityScore[0]!.weightedCER).toBeCloseTo(0.03)
    expect(report.metricRankings.thirdPartyService.qualityScore[0]!.runsCovered).toBe(2)
    expect(result.markdown).toContain('no primary quality score or weighted error counts')
    expect(result.dashboardModel.methodParagraphs.join(' ')).toContain('do not establish region localization')
    expect(result.dashboardModel.runs[1]!.detail).toContain('primary quality unavailable')
  } finally { await rm(root, { recursive: true, force: true }) }
})
