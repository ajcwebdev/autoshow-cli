import type { ObservedAudioFormat, ProviderBatchResult, WrittenJson } from '~/types'

export type FinalAudioObservation = {
  bytes: Buffer
  format: ObservedAudioFormat
  durationMs: number
}

export type FinalTimelineLayout = {
  turns: Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }>
  overlaps: Array<{ groupId: string, start: number, end: number }>
  pauses: Array<{ start: number, end: number, parameters: unknown }>
}

export type BatchResultFile = WrittenJson<ProviderBatchResult>
