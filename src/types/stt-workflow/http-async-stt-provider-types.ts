import type { InferOutput } from 'valibot'
import type {
  AsyncSttLifecycleHooks,
  DiarizationOptions,
  Step2Metadata,
  SttStageSchema,
  TranscriptionEvidenceWord,
  TranscriptionSegment
} from '~/types'

export type HttpAsyncSttRunOptions = {
  model: string
  segmentOffsetMinutes: number
  segmentNumber?: number | undefined
  totalSegments?: number | undefined
  diarizationOptions?: DiarizationOptions | undefined
  audioDurationSeconds?: number | undefined
  runMode?: 'initial' | 'backfill' | undefined
  lifecycle?: AsyncSttLifecycleHooks | undefined
}

export type HttpAsyncSttDescriptor<
  TCreateSchema extends SttStageSchema,
  TPollSchema extends SttStageSchema,
  TTranscriptSchema extends SttStageSchema,
  TStatus
> = {
  service: Step2Metadata['transcriptionService'] & string
  displayName: string
  credential: { envVar: string, stage: string, purpose: string }
  baseUrl: () => string
  resolveUrl: (baseUrl: string, path: string) => string
  endpoints: {
    createJob: string
    job: (jobId: string) => string
    transcript: (jobId: string) => string
  }
  buildCreateForm: (audioPath: string, modelName: string) => FormData
  transcriptHeaders?: Record<string, string> | undefined
  pollIntervals: { initialMs: number, maxMs: number }
  schemas: { create: TCreateSchema, poll: TPollSchema, transcript: TTranscriptSchema }
  readCreateResponse: (response: InferOutput<TCreateSchema>) => { jobId: string, status?: TStatus | undefined }
  readPollResponse: (response: InferOutput<TPollSchema>) => TStatus
  isComplete: (status: TStatus) => boolean
  failureMessage: (status: TStatus) => string | undefined
  isTerminal: (status: TStatus) => boolean
  normalizeTranscript: (
    transcript: InferOutput<TTranscriptSchema>,
    offsetSeconds: number
  ) => { text: string, segments: TranscriptionSegment[] }
  evidenceWords: (
    transcript: InferOutput<TTranscriptSchema>,
    offsetSeconds: number
  ) => TranscriptionEvidenceWord[]
}
