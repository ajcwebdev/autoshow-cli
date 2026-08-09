import type { BenchmarkProviderBase, BenchmarkProviderGroup, BenchmarkSurfaceGroupBase, JsonObject } from '~/types'

export type ProviderComparisonRankingSurfaces = Record<BenchmarkProviderGroup, BenchmarkSurfaceGroupBase<JsonObject>>

export type ProviderComparisonMarkdownOptions = {
  title: string
  runDir: string
  providerCount: number
  summaryMetrics?: readonly { label: string, value: string | number }[]
  judgeModel: string
  qualityReportFileName: string
  qualityProxyMethodText: string
  rows: readonly JsonObject[]
  rankingSurfaces: ProviderComparisonRankingSurfaces
  notes: readonly string[]
}

export type ProviderGroupRows = Record<BenchmarkProviderGroup, JsonObject[]>

export type MediaComparisonRowProvider = BenchmarkProviderBase & {
  rank: number
  qualityScore: number
  qualityMetric: string
}

export type MediaComparisonReportOptions = {
  category: 'image' | 'video'
  categoryLabel: string
  proxyNoun: string
  report: {
    runDir: string
    generatedAt: string
    providerCount: number
    judge: { model: string }
  }
  rows: JsonObject[]
  summaryMetrics?: readonly { label: string, value: string | number }[]
}
