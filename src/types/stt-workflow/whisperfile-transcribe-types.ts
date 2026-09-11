export type WhisperfileTranscribeOptions = {
  dtwPreset?: string | undefined
  nativeSubtitles?: boolean | undefined
  model: string
  segmentOffsetMinutes: number
  segmentNumber?: number | undefined
  totalSegments?: number | undefined
  audioDurationSeconds?: number | undefined
  segmentStartSeconds?: number | undefined
  segmentDurationSeconds?: number | undefined
  totalDurationSeconds?: number | undefined
  preserveJson?: boolean | undefined
}
