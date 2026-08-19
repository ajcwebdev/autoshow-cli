import type { LlmApiCallResult, RetryClassifier, RetryPolicy, Step3Metadata } from '~/types'

export type LlmRequestSignalFactory = () => AbortSignal

export type ExecuteLlmRequestSpec<TPrepared = undefined> = {
  service: Step3Metadata['llmService']
  providerLabel: string
  operationName: string
  emptyResponseStage: string
  classifier: RetryClassifier
  policy?: Partial<RetryPolicy> | undefined
  prepare?: (() => TPrepared) | undefined
  execute: (
    createSignal: LlmRequestSignalFactory,
    prepared: TPrepared
  ) => Promise<LlmApiCallResult>
}
