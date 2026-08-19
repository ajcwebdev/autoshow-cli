export type WhisperCppTranscribeOptions = {
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

export type WhisperCppInvocation = {
  command: string
  args: string[]
  modelDescriptor: string
}

export type WhisperCppProvider = {
  name: 'whisper' | 'whisperfile'
  label: string
  tempPrefix: string
  resolveInvocation: (modelName: string, baseArgs: string[]) => Promise<WhisperCppInvocation>
}
