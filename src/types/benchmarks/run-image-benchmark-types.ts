import type { BenchmarkProviderBase, JsonObject, MediaEvaluationBase, QualityProviderReportBase, QualityReportBase } from '~/types'

export type ImageRunEntry = {
  imageService: string
  imageModel: string
  imageFileNames: string[]
  processingTimeMs?: number
  costCents?: number
}

export type ImageBenchmarkManifestView = {
  input: string
  entries: ImageRunEntry[]
  raw: JsonObject
}

export type ImageFileReference = {
  fileName: string
  path: string
  mimeType: string
}

export type ImageBenchmarkProvider = BenchmarkProviderBase & {
  images: ImageFileReference[]
}

export type ImageCriterionScores = {
  promptAdherence: number
  visualQuality: number
  artifactControl: number
  composition: number
  detailTextHandling: number
}

export type ImageEvaluation = MediaEvaluationBase<ImageCriterionScores>

export type ImageQualityProviderReport = QualityProviderReportBase<ImageCriterionScores, 'image quality score'> & {
  imageFiles: string[]
  imageCount: number
  images: ImageEvaluation[]
}

export type ImageQualityReport = QualityReportBase<'image-quality-report'> & {
  imageCount: number
  providers: ImageQualityProviderReport[]
}
