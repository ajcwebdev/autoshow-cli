import type { HappyScribeStage } from '~/types'

export type HappyScribePollResult<TStatus> = {
  status: TStatus
  retryAfterMs: number | null
}

export type HappyScribeApiClientOptions = {
  apiKey: string
  baseURL: string
  onRequest?: (() => void) | undefined
  onRetry?: ((error: unknown) => void) | undefined
}

export type HappyScribeRetryPolicyClass = 'runtime_http_create_retriable' | 'runtime_http_read'

export type HappyScribeJsonRequestOptions = {
  stage: HappyScribeStage
  retryClass: HappyScribeRetryPolicyClass
  operationName: string
  timeoutMs: number
  messagePrefix: string
  request: (signal: AbortSignal | undefined) => Promise<Response>
  onResponse?: ((response: Response, payload: unknown) => void) | undefined
}
