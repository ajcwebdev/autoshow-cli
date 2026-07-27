export type JsonObject = Record<string, unknown>

export type BenchmarkProviderGroup = 'local' | 'service'

export type BenchmarkProviderBase = {
  providerKey: string
  provider: string
  model: string
  group: BenchmarkProviderGroup
  processingTimeMs?: number
  costCents?: number
}


export type BenchmarkSurfaceGroupBase<TRankingEntry> = {
  fastest: TRankingEntry[]
  cheapest: TRankingEntry[]
  highestQuality: TRankingEntry[]
  fastestUnavailableReason: string | null
  cheapestUnavailableReason: string | null
  highestQualityUnavailableReason: string | null
  price: TRankingEntry[]
  speed: TRankingEntry[]
  automatedQuality: TRankingEntry[]
  humanQuality: TRankingEntry[]
  priceUnavailableReason: string | null
  speedUnavailableReason: string | null
  automatedQualityUnavailableReason: string | null
  humanQualityUnavailableReason: string | null
}


export type MediaEvaluationBase<TCriterionScores> = {
  fileName: string
  criterionScores: TCriterionScores
  averageScore10: number
  qualityScore: number
  summary: string
  strengths: string[]
  issues: string[]
  usage?: JsonObject
}

export type QualityEvidenceBase = {
  summary: string
  strengths: string[]
  issues: string[]
}

export type QualityProviderReportBase<TCriterionScores, TQualityMetric extends string> =
  BenchmarkProviderBase & {
    rank: number
    criterionScores: TCriterionScores
    averageScore10: number
    qualityScore: number
    qualityMetric: TQualityMetric
    evidence: QualityEvidenceBase
  }

export type QualityReportRubricBase = {
  scale: '1-10'
  qualityScore: 'average criterion score x 10'
  criteria: string[]
}

export type QualityReportBase<TKind extends string, TRubric extends QualityReportRubricBase = QualityReportRubricBase> = {
  schemaVersion: 1
  kind: TKind
  runDir: string
  runName: string
  generatedAt: string
  judge: {
    provider: 'openai'
    model: string
    endpoint: 'responses'
  }
  prompt: string
  rubric: TRubric
  providerCount: number
}
