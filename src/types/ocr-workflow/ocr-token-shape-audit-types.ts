import type { HostedOcrTokenReasoningPolicy, TokenPricedOcrProvider } from '~/types'

export type TokenShapeSample = {
  provider: TokenPricedOcrProvider
  model: string
  ocrMode: string
  pageCountBand: string
  effectiveReasoningEffort: HostedOcrTokenReasoningPolicy
  promptTokensPerPage: number
  completionTokensPerPage: number
}

export type OcrTokenShapeAuditMetric = {
  registryTokensPerPage: number
  profileTokensPerPage?: number | undefined
  medianObservedTokensPerPage?: number | undefined
  medianAbsoluteDeviation?: number | undefined
  medianAbsolutePercentageError?: number | undefined
  direction: 'above-registry' | 'below-registry' | 'mixed-or-equal' | 'no-individual-evidence'
  consistentDirection: boolean
  exceedsPromotionThreshold: boolean
  promotionEligible: boolean
}

export type OcrTokenShapeAuditBucket = {
  provider: TokenPricedOcrProvider
  model: string
  ocrMode: string
  pageCountBand: string
  effectiveReasoningEffort: HostedOcrTokenReasoningPolicy
  usageBasis: 'candidate-plus-thoughts' | 'reported-prompt-completion' | 'canonical-prompt-completion'
  healthySampleCount: number
  profileSampleCount?: number | undefined
  prompt: OcrTokenShapeAuditMetric
  completion: OcrTokenShapeAuditMetric
  promotionEligible: boolean
  decision: 'promote-component-shape' | 'insufficient-individual-evidence' | 'insufficient-samples' | 'unqualified-reasoning-policy' | 'within-tolerance' | 'inconsistent-direction'
}

export type OcrTokenShapeAuditReport = {
  schemaVersion: 1
  generatedAt: string
  evidenceGate: {
    minimumHealthySamples: 3
    medianAbsolutePercentageErrorThreshold: 20
    requiresConsistentDirection: true
  }
  sources: {
    explicitRunDirectoryCount: number
    canonicalManifestCount: number
    explicitProfileProvided: boolean
  }
  excludedSamples: {
    failed: number
    partial: number
    incomplete: number
    missingUsage: number
    schemaInvalid: number
  }
  buckets: OcrTokenShapeAuditBucket[]
}

export type AuditOcrTokenShapesOptions = {
  runDirectories?: string[] | undefined
  profilePath?: string | undefined
  includeAllTokenProviders?: boolean | undefined
  now?: Date | undefined
}
