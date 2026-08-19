import type { ReplicatePrediction } from '~/types'

export type ReplicateAudioGenFetchImpl = (input: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>

export type ReplicateAudioGenPredictionRunner = (input: {
  apiToken: string
  baseUrl: string
  model: string
  version: string
  input: Record<string, unknown>
  operationName: string
  abortSignal: AbortSignal
  onCreated?: ((prediction: ReplicatePrediction) => void | Promise<void>) | undefined
}) => Promise<ReplicatePrediction>

export type ReplicateAudioGenSerializedRequest = {
  path: '/v1/predictions'
  body: {
    version: string
    input: {
      prompt: string
      duration: number
      top_k: number
      top_p: number
      temperature: number
      classifier_free_guidance: number
      output_format: string
    }
  }
}
