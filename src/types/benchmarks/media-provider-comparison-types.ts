import type { BenchmarkProviderGroup, BenchmarkSurfaceGroupBase, JsonObject } from '~/types'

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
