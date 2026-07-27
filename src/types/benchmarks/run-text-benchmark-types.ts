import type { BenchmarkProviderGroup, BenchmarkSurfaceGroupBase, JsonObject } from '~/types'

export type RankingEntry = {
  rank: number
  providerKey: string
  provider: string
  model: string
  group: BenchmarkProviderGroup
  metric: string
  value: number | null
  label: string
}

export type TextStep3Entry = JsonObject & {
  llmService: string
  llmModel: string
  processingTime?: number | undefined
  inputTokenCount?: number | undefined
  outputTokenCount?: number | undefined
  outputFileName?: string | undefined
}


export type TextProviderRow = JsonObject & {
  providerKey: string
  provider: string
  model: string
  group: BenchmarkProviderGroup
  llmService: string
  llmModel: string
  processingTimeMs: number | null
  actualProcessingTimeMs: number | null
  estimatedProcessingTimeMs: number | null
  msPerUnit: number | null
  costCents: number | null
  actualCostCents: number | null
  estimatedCostCents: number | null
  inputTokenCount: number
  outputTokenCount: number
  totalTokenCount: number
  tokenCountSource: string | null
  outputFileName: string | null
  outputExists: boolean
  outputByteSize: number | null
}

export type SurfaceGroup = BenchmarkSurfaceGroupBase<RankingEntry>

export type RankingSurfaces = Record<BenchmarkProviderGroup, SurfaceGroup>

export type TextComparisonReport = {
  schemaVersion: 2
  kind: 'text-provider-comparison'
  category: 'text'
  runDir: string
  runName: string
  generatedAt: string
  metric: 'metadata-only price-speed'
  providerCount: number
  providerGroups: Record<BenchmarkProviderGroup, { count: number, providers: TextProviderRow[] }>
  providers: TextProviderRow[]
  rankingSurfaces: RankingSurfaces
  combinedLeaderboardPolicy: string
  qualityPolicy: string
  notes: string[]
}

export type MatchedCostStep = {
  costCents: number
  source: 'actual' | 'estimated'
  raw: JsonObject
}

export type MatchedTimingStep = {
  processingTimeMs?: number | undefined
  msPerUnit?: number | undefined
  throughputValue?: number | undefined
  throughputUnit?: string | undefined
  rateBasis?: string | undefined
  inputMetric?: string | undefined
  inputValue?: number | undefined
  timingScope?: string | undefined
  source: 'actual' | 'estimated'
  raw: JsonObject
}
