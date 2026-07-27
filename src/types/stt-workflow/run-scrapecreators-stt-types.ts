import type { OptionalSttHttpError } from '~/types'

export type ScrapeCreatorsTranscriptEntry = {
  startMs: number
  endMs: number
  text: string
  [key: string]: unknown
}

export type ScrapeCreatorsTranscriptPayload = {
  transcript: ScrapeCreatorsTranscriptEntry[] | null
  [key: string]: unknown
}

export type ScrapeCreatorsHttpError = OptionalSttHttpError<string> & {
  retryable?: boolean | undefined
  skipped?: boolean | undefined
}
