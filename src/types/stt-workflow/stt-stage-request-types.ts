import type { BaseIssue, BaseSchema } from 'valibot'
import type { RetryClass, SttRequestMetrics } from '~/types'

export type SttStageSchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>

export type SttStageRequestOptions<TSchema extends SttStageSchema> = {
  operationName: string
  stage: string
  retryClass: RetryClass
  maxAttempts: number
  timeoutMs: number
  errorPrefix: string
  schema: TSchema
  schemaLabel: string
  doFetch: (signal: AbortSignal | undefined) => Promise<Response>
  metrics?: SttRequestMetrics | undefined
}
