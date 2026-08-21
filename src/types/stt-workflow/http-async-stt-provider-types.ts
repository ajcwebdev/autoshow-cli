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

/**
 * The parts of a multipart-upload, poll-until-terminal HTTP STT provider that actually
 * differ. Endpoints, response envelopes, terminal status names, failure extraction, and
 * transcript normalization stay provider-owned; the shell owns credential loading,
 * request-stage timing, cleanup wiring, artifact writing, and metadata assembly.
 */
export type HttpAsyncSttDescriptor<
  TCreateSchema extends SttStageSchema,
  TPollSchema extends SttStageSchema,
  TTranscriptSchema extends SttStageSchema,
  TStatus
> = {
  /** Manifest service name; also the operation-name prefix (`<service>-create-job`). */
  service: Step2Metadata['transcriptionService'] & string
  /** Prefix on provider HTTP failures and lifecycle deadline/probe errors. */
  displayName: string
  credential: { envVar: string, stage: string, purpose: string }
  baseUrl: () => string
  /** Rev resolves relative REST paths; Speechmatics resolves versioned absolute paths. */
  resolveUrl: (baseUrl: string, path: string) => string
  endpoints: {
    createJob: string
    job: (jobId: string) => string
    transcript: (jobId: string) => string
  }
  /** Provider-specific multipart body; Rev sends `media`/`options`, Speechmatics `data_file`/`config`. */
  buildCreateForm: (audioPath: string, modelName: string) => FormData
  /** Rev requires a versioned transcript `Accept`; Speechmatics does not. */
  transcriptHeaders?: Record<string, string> | undefined
  pollIntervals: { initialMs: number, maxMs: number }
  schemas: { create: TCreateSchema, poll: TPollSchema, transcript: TTranscriptSchema }
  /** Creation responses are flat for Rev and nested under `job` for Speechmatics. */
  readCreateResponse: (response: InferOutput<TCreateSchema>) => { jobId: string, status?: TStatus | undefined }
  readPollResponse: (response: InferOutput<TPollSchema>) => TStatus
  isComplete: (status: TStatus) => boolean
  /** Returns the provider failure message when the status is terminal-failed. */
  failureMessage: (status: TStatus) => string | undefined
  /** Terminal statuses whose remote job may be deleted once the run resolved. */
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
