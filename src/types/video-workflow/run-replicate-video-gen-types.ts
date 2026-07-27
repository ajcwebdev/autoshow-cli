import type { JsonObject, VideoMode } from '~/types'

export type ReplicateVideoBuildResult = {
  input: JsonObject
  requestMode: VideoMode
  durationForApi: number
  resolution: string
  aspectRatio?: string | undefined
  inputVideoDurationSeconds?: number | undefined
}
