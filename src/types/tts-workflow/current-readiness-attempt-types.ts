import type { CreateCurrentTtsRenderAttemptOptions, TtsExecutionReadinessObservation } from '~/types'

export type CreateCurrentTtsBlockedReadinessStateOptions = Omit<
  CreateCurrentTtsRenderAttemptOptions,
  'onProviderState'
> & {
  readiness: TtsExecutionReadinessObservation
  peerBlocked: boolean
}
