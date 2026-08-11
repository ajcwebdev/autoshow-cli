import type { ResourceGate, TargetPoolKind, TargetSchedulerConcurrency } from '~/types'
export type ProviderTargetSchedulerEntry<TTarget> = {
  index: number
  target: TTarget
  priority?: number | undefined
}

export type ProviderTargetFailure<TTarget> = {
  index: number
  target: TTarget
  message: string
  error?: unknown
}


export type RunProviderTargetSchedulerOptions<TTarget, TResult> = {
  entries: Array<ProviderTargetSchedulerEntry<TTarget>>
  concurrency: TargetSchedulerConcurrency
  getPool: (target: TTarget) => TargetPoolKind
  runTarget: (index: number, target: TTarget) => Promise<TResult>
  resourceGate?: ResourceGate | undefined
  getResourceGate?: ((target: TTarget) => ResourceGate | undefined) | undefined
  onLifecycle?: ((event: {
    index: number
    target: TTarget
    pool: TargetPoolKind
    status: 'started' | 'succeeded' | 'failed'
    elapsedMs?: number | undefined
    message?: string | undefined
  }) => void) | undefined
}

export type ProviderTargetSchedulerResult<TTarget, TResult> = {
  results: Array<TResult | undefined>
  failures: Array<ProviderTargetFailure<TTarget>>
}
