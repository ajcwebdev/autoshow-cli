import type { ProviderTargetFailure, ProviderTargetSchedulerEntry, ProviderTargetSchedulerResult, RunProviderTargetSchedulerOptions, TargetPoolKind } from '~/types'
import { runHostedConcurrencyRequest } from './hosted-concurrency-coordinator'
import { normalizePositiveInt } from '~/utils/value-helpers'

const compareExecutionPriority = <TTarget>(
  left: ProviderTargetSchedulerEntry<TTarget>,
  right: ProviderTargetSchedulerEntry<TTarget>
): number => {
  const leftPriority = left.priority ?? 0
  const rightPriority = right.priority ?? 0
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority
  }
  return left.index - right.index
}

const runPool = async <TTarget, TResult>(
  entries: Array<ProviderTargetSchedulerEntry<TTarget>>,
  pool: TargetPoolKind,
  concurrency: number,
  options: Pick<RunProviderTargetSchedulerOptions<TTarget, TResult>, 'runTarget' | 'resourceGate' | 'getResourceGate' | 'onLifecycle' | 'hostedConcurrencyCoordinator' | 'hostedWorkClass' | 'getHostedProvider' | 'getHostedAccountLabel' | 'getHostedWorkId' | 'abortSignal'>,
  results: Array<TResult | undefined>,
  failures: Array<ProviderTargetFailure<TTarget>>
): Promise<void> => {
  if (entries.length === 0) {
    return
  }

  const orderedEntries = entries.slice().sort(compareExecutionPriority)
  const normalizedConcurrency = normalizePositiveInt(concurrency)
  let next = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const current = next
      next += 1
      if (current >= orderedEntries.length) {
        return
      }

      const entry = orderedEntries[current] as ProviderTargetSchedulerEntry<TTarget>
      const startedAt = Date.now()
      options.onLifecycle?.({
        index: entry.index,
        target: entry.target,
        pool,
        status: 'started'
      })

      try {
        const runTarget = async (): Promise<TResult> => {
          const resourceGate = options.getResourceGate
            ? options.getResourceGate(entry.target)
            : options.resourceGate
          const release = resourceGate ? await resourceGate.acquire() : undefined
          try {
            return await options.runTarget(entry.index, entry.target)
          } finally {
            release?.()
          }
        }
        if (pool === 'hosted' && options.hostedConcurrencyCoordinator) {
          const provider = options.getHostedProvider?.(entry.target) ?? readHostedProvider(entry.target)
          results[entry.index] = await runHostedConcurrencyRequest({
            coordinator: options.hostedConcurrencyCoordinator,
            admission: {
              provider,
              accountLabel: options.getHostedAccountLabel?.(entry.target),
              workClass: options.hostedWorkClass ?? 'provider-target',
              configuredLimit: normalizedConcurrency,
              workId: options.getHostedWorkId?.(entry.index, entry.target) ?? `${options.hostedWorkClass ?? 'provider-target'}:${provider}:${entry.index}`,
              unitIndex: entry.index,
              context: { targetIndex: entry.index },
              abortSignal: options.abortSignal
            }
          }, async () => await runTarget())
        } else {
          results[entry.index] = await runTarget()
        }
        options.onLifecycle?.({
          index: entry.index,
          target: entry.target,
          pool,
          status: 'succeeded',
          elapsedMs: Date.now() - startedAt
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push({
          index: entry.index,
          target: entry.target,
          message,
          error
        })
        options.onLifecycle?.({
          index: entry.index,
          target: entry.target,
          pool,
          status: 'failed',
          elapsedMs: Date.now() - startedAt,
          message
        })
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, orderedEntries.length) }, async () => {
      await runWorker()
    })
  )
}

const readHostedProvider = (target: unknown): string => {
  if (target && typeof target === 'object') {
    const direct = (target as { service?: unknown }).service
    if (typeof direct === 'string' && direct.length > 0) return direct
    const nested = (target as { target?: { service?: unknown } }).target?.service
    if (typeof nested === 'string' && nested.length > 0) return nested
  }
  return 'hosted-provider'
}

export const runProviderTargetScheduler = async <TTarget, TResult>(
  options: RunProviderTargetSchedulerOptions<TTarget, TResult>
): Promise<ProviderTargetSchedulerResult<TTarget, TResult>> => {
  const hostedEntries = options.entries.filter(({ target }) => options.getPool(target) === 'hosted')
  const localEntries = options.entries.filter(({ target }) => options.getPool(target) === 'local')
  const results: Array<TResult | undefined> = []
  const failures: Array<ProviderTargetFailure<TTarget>> = []

  await Promise.all([
    runPool(
      hostedEntries,
      'hosted',
      options.concurrency.provider,
      options,
      results,
      failures
    ),
    runPool(
      localEntries,
      'local',
      options.concurrency.local,
      options,
      results,
      failures
    )
  ])

  failures.sort((left, right) => left.index - right.index)
  return { results, failures }
}
