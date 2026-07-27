import type { ImageGenOptions, ImageTarget, MusicGenOptions, MusicTarget, Step4Metadata, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata, TtsOptions, TtsTarget, VideoGenOptions, VideoTarget } from '~/types'

export type GenerationStageOptions = TtsOptions & ImageGenOptions & VideoGenOptions & MusicGenOptions


export type GenerationStageRunResult = {
  step4Metadata: Step4Metadata[] | null
  step5Metadata: Step5Metadata[] | null
  step6Metadata: Step6VideoMetadata[] | null
  step7Metadata: Step7MusicMetadata[] | null
  ttsCharacterCount?: number | undefined
  ttsInputText?: string | undefined
  ttsTargets: TtsTarget[]
  imageTargets: ImageTarget[]
  videoTargets: VideoTarget[]
  musicTargets: MusicTarget[]
  attemptedTtsTargets: TtsTarget[]
  attemptedImageTargets: ImageTarget[]
  attemptedVideoTargets: VideoTarget[]
  attemptedMusicTargets: MusicTarget[]
}
