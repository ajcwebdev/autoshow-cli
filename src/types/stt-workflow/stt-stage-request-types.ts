import type { BaseIssue, BaseSchema } from 'valibot'
import type { RetryClass, SttRequestMetrics } from '~/types'

export type SttStageSchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>

export type SttStageFailure = {
  message: string
  rawResponse: unknown
}

export type SttStageRequestOptions<TSchema extends SttStageSchema> = {
  operationName: string
  stage: string
  retryClass: RetryClass
  timeoutMs: number
  errorPrefix: string
  schema: TSchema
  schemaLabel: string
  doFetch: (signal: AbortSignal | undefined) => Promise<Response>
  metrics?: SttRequestMetrics | undefined
  failureLabel?: string | undefined
  readFailure?: ((response: Response) => Promise<SttStageFailure>) | undefined
  attachError?: ((error: unknown, stage: string, retryClass: RetryClass) => never) | undefined
}
