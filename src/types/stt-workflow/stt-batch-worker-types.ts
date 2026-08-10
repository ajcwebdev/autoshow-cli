import type { MistralSttPassController, PreparedSttMedia, ProcessSttRunOptions, ProviderFailure, SttBatchCoordinator, SttExtractionOptions, SttProviderState, SttProviderSuccess, SttTarget } from '~/types'

export type SttBatchWorkerContext = {
  outputDir: string
  providersDir: string
  requestedTargets: SttTarget[]
  successes: Array<SttProviderSuccess | undefined>
  failuresByIndex: Map<number, ProviderFailure>
  providerStateMap: Map<string, SttProviderState>
  options: SttExtractionOptions
  prepared: PreparedSttMedia
  runOptions: ProcessSttRunOptions
  batchCoordinator: SttBatchCoordinator | undefined
  mistralPassController?: MistralSttPassController | undefined
  queuePromptRefresh: () => void
}
