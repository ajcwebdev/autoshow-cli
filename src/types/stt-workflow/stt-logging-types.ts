import type { SttSplitDecisionReason } from '~/types'

export type SttSplitRetryReason = Exclude<SttSplitDecisionReason['kind'], 'explicit'>

export type SttDiarizationConfigSummary = {
  provider: string
  model?: string | undefined
  enabled?: boolean | undefined
  speakerCount?: number | undefined
  maxSpeakers?: number | undefined
  detail?: string | undefined
}

export type SttSplitSummary = {
  input: string
  segmentDurationMinutes: number
  totalDurationSeconds: number
  totalSegments: number
}

export type SttTranscriptOutputSummary = {
  provider: string
  path: string
  characters: number
  speakers?: number | undefined
}

export type SttCleanupFailureSummary = {
  provider: string
  artifact: string
  id: string
  detail: string
}

export type SttRecoveryPassSummary = {
  pass: number
  maxPasses: number
  failures: number
  providers: string
}
