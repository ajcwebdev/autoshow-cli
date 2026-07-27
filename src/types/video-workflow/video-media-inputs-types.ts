export type VideoMediaKind = 'image' | 'video' | 'audio'


export type GrokUrlMedia = {
  url: string
}

export type AudioProbeResult = {
  durationSeconds?: number | undefined
  sizeBytes?: number | undefined
}
