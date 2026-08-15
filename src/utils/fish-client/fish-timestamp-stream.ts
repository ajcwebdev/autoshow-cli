import { ValidationError } from '~/utils/error-handler'

export type FishAlignmentSegment = Readonly<{
  text: string
  start: number
  end: number
}>

export type FishTimestampAlignment = Readonly<{
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

const finiteNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : undefined

export const emptyFishTimestampStreamState = (): FishTimestampStreamState => ({
  audioChunks: [],
  alignmentByChunk: new Map(),
})

export const parseFishTimestampStreamEvent = (value: unknown): FishTimestampStreamEvent => {
  const record = asRecord(value)
  if (!record) throw ValidationError('Fish timestamp stream event must be a JSON object.', { stage: 'fish:timestamp-stream' })
  const audio = record['audio_base64']
  const content = record['content']
  const chunkSeq = record['chunk_seq']
  const offset = record['chunk_audio_offset_sec']
  if (typeof audio !== 'string') throw ValidationError('Fish timestamp stream event is missing audio_base64.', { stage: 'fish:timestamp-stream' })
  if (typeof content !== 'string') throw ValidationError('Fish timestamp stream event is missing content.', { stage: 'fish:timestamp-stream' })
  if (!Number.isInteger(chunkSeq) || (chunkSeq as number) < 0) throw ValidationError('Fish timestamp stream event has an invalid chunk_seq.', { stage: 'fish:timestamp-stream' })
  const offsetSeconds = finiteNumber(offset)
  if (offsetSeconds === undefined) throw ValidationError('Fish timestamp stream event has an invalid chunk_audio_offset_sec.', { stage: 'fish:timestamp-stream' })
  const rawAlignment = record['alignment']
  if (rawAlignment !== null && rawAlignment !== undefined && !asRecord(rawAlignment)) {
    throw ValidationError('Fish timestamp stream alignment must be an object or null.', { stage: 'fish:timestamp-stream' })
  }
  const alignmentRecord = asRecord(rawAlignment)
  const segments = Array.isArray(alignmentRecord?.['segments'])
    ? alignmentRecord['segments'].flatMap((segment): FishAlignmentSegment[] => {
        const item = asRecord(segment)
        const text = item?.['text']
        const start = finiteNumber(item?.['start'])
        const end = finiteNumber(item?.['end'])
        if (typeof text !== 'string' || start === undefined || end === undefined || end < start) return []
        return [{ text, start, end }]
      })
    : []
  return {
    audio_base64: audio,
    content,
    alignment: alignmentRecord ? { audio_duration: finiteNumber(alignmentRecord['audio_duration']), segments } : null,
    chunk_seq: chunkSeq as number,
    chunk_audio_offset_sec: offsetSeconds,
  }
}

export const reduceFishTimestampStreamEvent = (
  state: FishTimestampStreamState,
  event: FishTimestampStreamEvent
): FishTimestampStreamState => {
  const audioChunks = [...state.audioChunks, Uint8Array.from(Buffer.from(event.audio_base64, 'base64'))]
  if (event.alignment === null) return { audioChunks, alignmentByChunk: state.alignmentByChunk }
  const next = new Map(state.alignmentByChunk)
  next.set(event.chunk_seq, {
    chunkSeq: event.chunk_seq,
    content: event.content,
    offset: event.chunk_audio_offset_sec,
    alignment: event.alignment,
  })
  return { audioChunks, alignmentByChunk: next }
}

export const splitFishSseFrames = (buffer: string): { frames: string[], rest: string } => {
  const parts = buffer.split('\n\n')
  return { frames: parts.slice(0, -1), rest: parts.at(-1) ?? '' }
}

export const parseFishSseFrame = (frame: string): FishTimestampStreamEvent | undefined => {
  const dataLine = frame.split('\n').find(line => line.startsWith('data:'))
  if (!dataLine) return undefined
  const payload = dataLine.replace(/^data:\s?/, '').trim()
  if (!payload || payload === '[DONE]') return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    throw ValidationError('Fish timestamp stream returned a malformed SSE JSON payload.', { stage: 'fish:timestamp-stream' })
  }
  return parseFishTimestampStreamEvent(parsed)
}

export const buildFishGlobalTimeline = (alignmentByChunk: ReadonlyMap<number, FishTimestampAlignmentSnapshot>): FishGlobalTimelineSegment[] => {
  const timeline: FishGlobalTimelineSegment[] = []
  for (const snapshot of [...alignmentByChunk.values()].sort((left, right) => left.chunkSeq - right.chunkSeq)) {
    for (const segment of snapshot.alignment.segments) {
      timeline.push({
        text: segment.text,
        start: segment.start + snapshot.offset,
        end: segment.end + snapshot.offset,
        chunkSeq: snapshot.chunkSeq,
      })
    }
  }
  return timeline
}
