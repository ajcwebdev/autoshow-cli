import type { ProviderIdentityBase } from '~/types'

export type CalibrationKind = 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'

export type CalibrationConfigPaths = Partial<Record<CalibrationKind, string>>

export type CalibrationStepObservation = ProviderIdentityBase & {
  kind: CalibrationKind
  estimatedCostCents: number | null
  rawEstimatedCostCents: number | null
  actualCostCents: number | null
  actualProcessingTimeMs: number | null
  actualMsPerUnit: number | null
  unitValue: number | null
}

export type CalibrationRecommendation = ProviderIdentityBase & {
  kind: CalibrationKind
  costSamples: number
  timeSamples: number
  oldCostMultiplier: number | null
  recommendedCostMultiplier: number | null
  medianCostMultiplier: number | null
  timeField: string
  oldTimeValue: number | null
  recommendedTimeValue: number | null
  medianTimeValue: number | null
  notes?: string[]
}

export type CalibrationReport = {
  generatedAt: string
  rootDir: string
  runsScanned: number
  metadataFilesScanned: number
  recommendedModels: number
  recommendations: CalibrationRecommendation[]
}

export type CalibrationStepShape = ProviderIdentityBase & {
  kind: CalibrationKind
}

export type CalibrationScan = {
  observations: CalibrationStepObservation[]
  runsScanned: number
  metadataFilesScanned: number
}

export type CalibrationGroupRates = {
  costRatios: number[]
  timeRates: number[]
}
