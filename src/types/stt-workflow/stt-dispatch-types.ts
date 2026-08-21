import type { Step2Metadata, SttTarget, SttTargetOptions, TranscriptionResult } from '~/types'

export type WhisperProgressWindow = {
  segmentStartSeconds: number
  segmentDurationSeconds: number
  totalDurationSeconds: number
}

export type SttDispatchContext = {
  target: SttTarget
  audioPath: string
  outputDir: string
  segmentOffsetMinutes: number
  options: SttTargetOptions
  segmentNumber?: number | undefined
  totalSegments?: number | undefined
  whisperProgress?: WhisperProgressWindow | undefined
}

export type SttDispatcher = (
  context: SttDispatchContext
) => Promise<{ result: TranscriptionResult, metadata: Step2Metadata }>
