import type { Step2Metadata, TranscriptionEvidenceWord, TranscriptionSegment } from '~/types'

export type HostedSttFinalizeOptions = {
  provider: Step2Metadata['transcriptionService']
  lifecycleProvider?: string | undefined
  model: string
  outputDir: string
  segmentNumber?: number | undefined
  totalSegments?: number | undefined
  offsetSeconds: number
  startTime: number
  transcribeMs: number
  requestCount: number
  retryCount: number
  rateLimitCount: number
  text: string
  segments: TranscriptionSegment[]
  evidenceWords: TranscriptionEvidenceWord[]
  rawResponse: unknown
}
