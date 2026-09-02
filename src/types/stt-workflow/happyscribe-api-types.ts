import type { HappyScribeStage } from '~/types'

export type HappyScribePollResult<TStatus> = {
  status: TStatus
  retryAfterMs: number | null
}

export type TimeFieldCandidate = {
  key: string
  unit: 'seconds' | 'milliseconds' | 'auto'
}

export type HappyScribeApiClientOptions = {
  apiKey: string
  baseURL: string
  onRequest?: (() => void) | undefined
  onRetry?: ((error: unknown) => void) | undefined
}

type HappyScribeRetryPolicyClass = 'runtime_http_create_retriable' | 'runtime_http_create_conservative' | 'runtime_http_read' | 'runtime_http_poll'

export type HappyScribeJsonRequestOptions = {
  stage: HappyScribeStage
  retryClass: HappyScribeRetryPolicyClass
  operationName: string
  timeoutMs: number
  messagePrefix: string
  request: (signal: AbortSignal | undefined) => Promise<Response>
  onResponse?: ((response: Response, payload: unknown) => void) | undefined
}
