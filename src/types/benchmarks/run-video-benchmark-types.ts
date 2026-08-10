import type { BenchmarkProviderBase, JsonObject, MediaEvaluationBase, QualityEvidenceBase, QualityProviderReportBase, QualityReportBase, QualityReportRubricBase } from '~/types'

export type VideoRunEntry = {
  videoGenService: string
  videoGenModel: string
  videoFileName: string
  processingTimeMs?: number
  costCents?: number
  videoDuration?: number
}

export type VideoBenchmarkManifestView = {
  input: string
  entries: VideoRunEntry[]
  raw: JsonObject
}

export type VideoFileReference = {
  fileName: string
  path: string
  metadataDurationSeconds?: number
}

export type VideoBenchmarkProvider = BenchmarkProviderBase & {
  videos: VideoFileReference[]
}

export type VideoFrame = {
  index: number
  timestampSeconds: number
  fileName: string
  path: string
}

export type VideoCriterionScores = {
  promptAdherence: number
  visualQuality: number
  artifactControl: number
  temporalConsistency: number
  compositionCamera: number
}

export type VideoEvaluation = MediaEvaluationBase<VideoCriterionScores> & {
  durationSeconds: number
  frameCount: number
  frames: VideoFrame[]
}

export type VideoQualityProviderReport = Omit<QualityProviderReportBase<VideoCriterionScores, 'video quality score'>, 'evidence'> & {
  videoFiles: string[]
  videoCount: number
  evidence: QualityEvidenceBase & {
    frameCount: number
    frames: Array<{
      videoFileName: string
      index: number
      timestampSeconds: number
      fileName: string
    }>
  }
  videos: VideoEvaluation[]
}

export type VideoQualityReport = QualityReportBase<'video-quality-report', QualityReportRubricBase & {
  frameSampling: '10 midpoint-interval screenshots per video'
}> & {
  videoCount: number
  frameCount: number
  providers: VideoQualityProviderReport[]
}
