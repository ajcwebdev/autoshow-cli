import type { PreparedTtsInput, Step4Metadata, TtsTarget } from '~/types'

export type TtsBatchEstimateSummary = {
  inputCount: number
  batchConcurrency: number
  ttsChunkConcurrency: number
  totalEstimatedProcessingTimeMs: number
  estimatedWallTimeMs: number
  totalEstimatedCost: number
}

export type SuccessfulTtsBatchItem = {
  metadata: Step4Metadata[]
  characterCount: number
}

export type HostedEstimateJob = {
  provider: Exclude<TtsTarget['service'], 'kitten'>
  durationsMs: number[]
  active: number
  started: number
  completed: number
  dispatchDebt: number
  lastDispatchSequence: number
  originalOrder: number
}

export type TtsBatchEstimateOptions = {
  preparedInputs?: PreparedTtsInput[] | undefined
  targets?: TtsTarget[] | undefined
}
