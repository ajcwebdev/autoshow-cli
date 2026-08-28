import type { AccountCapabilityState, SanitizedProviderError } from '~/types'

export type TtsExecutionReadinessObservation = Readonly<{
  targetKey: string
  accountState: AccountCapabilityState
  status: 'ready' | 'blocked'
  error?: SanitizedProviderError | undefined
}>
