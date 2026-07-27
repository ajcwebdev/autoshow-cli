import type { AggregatedPriceEstimate, ImageTarget, MusicTarget, ProcessingOptions, Step1Metadata, Step3Metadata, Step4Metadata, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata, TtsTarget, VideoTarget, WriteTranscriptionBundle } from '~/types'

export type ComputeWriteCostAndTimingContext = {
  processingOptions: ProcessingOptions
  preflightEstimate?: AggregatedPriceEstimate | undefined
  step1Metadata: Step1Metadata
  transcriptionResult: WriteTranscriptionBundle
  mediaDurationSeconds: number
  step3Results: Step3Metadata[]
  step3Serialized: Step3Metadata | Step3Metadata[] | undefined
  ttsCharacterCount: number | undefined
  ttsInputText: string | undefined
  attemptedTtsTargets: TtsTarget[]
  attemptedImageTargets: ImageTarget[]
  attemptedVideoTargets: VideoTarget[]
  attemptedMusicTargets: MusicTarget[]
  step4Metadata: Step4Metadata[] | null
  step5Metadata: Step5Metadata[] | null
  step6Metadata: Step6VideoMetadata[] | null
  step7Metadata: Step7MusicMetadata[] | null
}
