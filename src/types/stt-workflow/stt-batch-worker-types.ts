import type { MistralSttPassController, PreparedSttMedia, ProcessSttRunOptions, ProviderFailure, RuntimeOptions, SttBatchCoordinator, SttProviderState, SttProviderSuccess, SttTarget } from '~/types'

export type SttBatchWorkerContext = {
  providersDir: string
  requestedTargets: SttTarget[]
  successes: Array<SttProviderSuccess | undefined>
  failuresByIndex: Map<number, ProviderFailure>
  providerStateMap: Map<string, SttProviderState>
  options: RuntimeOptions
  prepared: PreparedSttMedia
  runOptions: ProcessSttRunOptions
  batchCoordinator: SttBatchCoordinator | undefined
  mistralPassController?: MistralSttPassController | undefined
  queuePromptRefresh: () => void
}
