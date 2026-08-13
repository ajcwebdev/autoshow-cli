import type { ProviderTargetFailure, ProviderTargetSchedulerEntry, ProviderTargetSchedulerResult, RunProviderTargetSchedulerOptions, TargetPoolKind } from '~/types'

const normalizeConcurrency = (value: number): number =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1

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
  options: Pick<RunProviderTargetSchedulerOptions<TTarget, TResult>, 'runTarget' | 'resourceGate' | 'getResourceGate' | 'onLifecycle'>,
  results: Array<TResult | undefined>,
  failures: Array<ProviderTargetFailure<TTarget>>
): Promise<void> => {
  if (entries.length === 0) {
    return
  }

  const orderedEntries = entries.slice().sort(compareExecutionPriority)
  const normalizedConcurrency = normalizeConcurrency(concurrency)
  let next = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const current = next
      next += 1
      if (current >= orderedEntries.length) {
        return
      }

      const entry = orderedEntries[current] as ProviderTargetSchedulerEntry<TTarget>
      const resourceGate = options.getResourceGate
        ? options.getResourceGate(entry.target)
        : options.resourceGate
      const release = resourceGate ? await resourceGate.acquire() : undefined
      const startedAt = Date.now()
      options.onLifecycle?.({
        index: entry.index,
        target: entry.target,
        pool,
        status: 'started'
      })

      try {
        try {
          results[entry.index] = await options.runTarget(entry.index, entry.target)
        } finally {
          release?.()
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
