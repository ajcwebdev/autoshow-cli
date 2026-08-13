import type { PipelineManifest, ProcessCommand } from '~/types'

export type OcrBatchDiagnosticTrigger = 'repeated_blocker' | 'partial_provider_usage' | 'missing_actual_cost' | 'material_estimate_drift'

export type OcrBatchDiagnosticTarget = {
  provider: string
  model: string
  affectedItems: number
  attemptedItems: number
  blockers: Array<{
    category: string
    affectedItems: number
  }>
  retryPressure: {
    attempts: number
    retries: number
    rateLimitFailures: number
    retryAfterMs: number
  }
  cost: {
    estimatedCostCents: number
    actualCostCents: number
    partialProviderCostCents: number
    partialProviderUsageItems: number
    unknownActualCostItems: number
    estimateErrorPercent?: number | undefined
  }
}

export type OcrBatchDiagnosticsReport = {
  schemaVersion: 1
  generatedAt: string
  sourceManifest: {
    command: ProcessCommand
    scope: PipelineManifest['scope']
    createdAt: string
    updatedAt: string
    sha256: string
  }
  thresholds: {
    materialEstimateErrorPercent: 20
  }
  triggers: OcrBatchDiagnosticTrigger[]
  targets: OcrBatchDiagnosticTarget[]
}
