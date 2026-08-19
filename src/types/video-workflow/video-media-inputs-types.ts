import type { MediaKindSpec } from '~/types'

export type VideoMediaKind = 'image' | 'video' | 'audio'

export type VideoMediaSpec = MediaKindSpec & { prettyMimeList: string }


export type GrokUrlMedia = {
  url: string
}

export type AudioProbeResult = {
  durationSeconds?: number | undefined
  sizeBytes?: number | undefined
}
