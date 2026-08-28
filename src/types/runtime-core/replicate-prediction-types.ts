import type { RetryClass } from '~/types'

export type ReplicatePrediction = {
  id?: string | undefined
  model?: string | undefined
  version?: string | undefined
  status: string
  output?: unknown
  error?: unknown
  logs?: string | undefined
  urls?: {
    get?: string | undefined
    cancel?: string | undefined
    web?: string | undefined
  } | undefined
  metrics?: Record<string, unknown> | undefined
  created_at?: string | undefined
  started_at?: string | undefined
  completed_at?: string | undefined
}

export type RunReplicatePredictionOptions = {
  apiToken: string
  baseUrl: string
  model: string
  version?: string | undefined
  input: Record<string, unknown>
  operationName: string
  abortSignal?: AbortSignal | undefined
  onCreated?: ((prediction: ReplicatePrediction) => void | Promise<void>) | undefined
  onStatus?: ((prediction: ReplicatePrediction) => void) | undefined
}

export type ReplicateFetchOptions = {
  url: string
  apiToken: string
  init: RequestInit
  stage: string
  retryClass: RetryClass
}
