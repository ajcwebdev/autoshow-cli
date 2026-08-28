import type { JsonObject, ReplicateVideoModel, VideoMode } from '~/types'

export type ReplicateVideoGenOptions = {
  model: ReplicateVideoModel
  mode?: VideoMode | undefined
  durationSeconds?: number | undefined
  resolution?: string | undefined
  aspectRatio?: string | undefined
  inputImage?: string | undefined
  lastFrameImage?: string | undefined
  referenceImages?: string[] | undefined
  inputVideo?: string | undefined
  referenceVideos?: string[] | undefined
  referenceAudios?: string[] | undefined
  negativePrompt?: string | undefined
  generateAudio?: boolean | undefined
  seed?: number | undefined
  multiPrompt?: string | undefined
  multiClip?: boolean | undefined
}

export type ReplicateVideoBuildResult = {
  input: JsonObject
  requestMode: VideoMode
  durationForApi: number
  resolution: string
  aspectRatio?: string | undefined
  inputVideoDurationSeconds?: number | undefined
}
