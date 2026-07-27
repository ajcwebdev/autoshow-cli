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
  input: Record<string, unknown>
  operationName: string
  waitSeconds?: number | undefined
  cancelAfter?: string | undefined
  onStatus?: ((prediction: ReplicatePrediction) => void) | undefined
}
