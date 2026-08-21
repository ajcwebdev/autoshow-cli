import type { JsonObject, ModelCategory, ModelRegistry } from '~/types'

export type MetricName = 'price' | 'speed' | 'qualityScore'

export type MetricRankingEntry = {
  rank: number
  providerKey: string
  metric: MetricName
  value: number | null
  label: string
  score: number | null
  wer: number | null
  cer: number | null
  speakerAwareWER: number | null
  textOnlyWER: number | null
  supportsDiarization: boolean | null
  diarizationSupport: string | null
}

export type RankingSurfaceName = 'fastest' | 'cheapest' | 'highestQuality' | 'price' | 'speed' | 'automatedQuality' | 'humanQuality'

export type TtsRankingEntry = {
  providerKey: string
  metric: string
  value: number | null
  label: string
}

type ArtifactRankingEntry = {
  rank: number
  providerKey: string
  provider: string
  display?: string
  composite: number
}

type ArtifactTierProvider = {
  providerKey: string
  provider: string
  display?: string
  qualityCostRank: number
  qualityCostComposite: number
}

type ArtifactTiering = {
  method: string
  ranking: string
  providerCount: number
  tieBreak: string
  tiers: Array<{
    tier: number
    count: number
    providers: ArtifactTierProvider[]
  }>
}

export type ArtifactReport = {
  schemaVersion: number
  weightedRankings: Record<string, { qualityCost: ArtifactRankingEntry[] }>
  tiering: Record<string, ArtifactTiering>
}

export type RegistryModelRecord = {
  step: keyof ModelRegistry
  provider: string
  model: string
  serviceType: string
  entry: JsonObject
}

export type UrlCombinedFixtureProvider = {
  providerKey: string
  processingTimeMs: number | null
  costCents: number | null
  wer: number | null
  cer: number | null
  contentCoverage: number | null
  sourceQuality: number | null
  humanQuality?: number | null
  misleadingProviderQuality?: number
}

export type UrlCombinedArtifact<TAggregatedProvider = unknown, TMetricRankingEntry = unknown> = {
  schemaVersion: number
  runCount: number
  providerCount: number
  providerRowCount: number
  automatedQualityRowCount: number
  humanQualityRowCount: number
  runs: Array<{
    runName: string
    articleTitle: string
    sourceUrl: string | null
    leaders: {
      service: {
        price: { providerKey: string } | null
        speed: { providerKey: string } | null
        automatedQuality: { providerKey: string } | null
      }
    }
  }>
  providers: TAggregatedProvider[]
  metricRankings: Record<'local' | 'service', Record<'price' | 'speed' | 'automatedQuality', TMetricRankingEntry[]>>
  weightedRankings: Record<string, Record<string, unknown[]>>
  tiering: Record<string, { tiers: Array<{ count: number }> }>
  notes: string[]
}

export type ModelIdentitySpec = {
  category: ModelCategory
  serviceField: string
  modelField: string
}

export type HistoricalIdentity = {
  category: ModelCategory
  service: string
  model: string
  file: string
}
