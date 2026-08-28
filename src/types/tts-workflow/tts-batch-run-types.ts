import type { PipelineProviderState } from '~/types'

export type TtsBatchLifecycleCoordinator = {
  beforeDispatch: (itemIndex: number, preparedStates: PipelineProviderState[]) => Promise<void>
  onProviderState: (itemIndex: number, state: PipelineProviderState) => Promise<void>
  abortPreparation: (error: unknown) => void
}
