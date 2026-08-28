export type FishAlignmentSegment = Readonly<{
  text: string
  start: number
  end: number
}>

type FishTimestampAlignment = Readonly<{
  audio_duration?: number | undefined
  segments: readonly FishAlignmentSegment[]
}>

export type FishTimestampStreamEvent = Readonly<{
  audio_base64: string
  content: string
  alignment: FishTimestampAlignment | null
  chunk_seq: number
  chunk_audio_offset_sec: number
}>

export type FishTimestampAlignmentSnapshot = Readonly<{
  chunkSeq: number
  content: string
  offset: number
  alignment: FishTimestampAlignment
}>

export type FishTimestampStreamState = Readonly<{
  audioChunks: readonly Uint8Array[]
  alignmentByChunk: ReadonlyMap<number, FishTimestampAlignmentSnapshot>
}>

export type FishGlobalTimelineSegment = Readonly<{
  text: string
  start: number
  end: number
  chunkSeq: number
}>
