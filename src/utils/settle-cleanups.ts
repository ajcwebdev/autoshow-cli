import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'

/**
 * Runs every cleanup to completion, even when one fails. After a primary failure the cleanup
 * failures are only logged, so the caller's original error stays the one reported; after
 * success they surface together as one `InfraError`.
 */
export const settleCleanups = async (
  cleanups: ReadonlyArray<() => Promise<void> | void>,
  options: { label: string, stage: string, primaryFailed: boolean }
): Promise<void> => {
  const outcomes = await Promise.allSettled(cleanups.map(async (cleanup) => {
    await cleanup()
  }))
  const failures = outcomes.flatMap((outcome) => outcome.status === 'rejected' ? [outcome.reason as unknown] : [])
  if (failures.length === 0) {
    return
  }
  if (options.primaryFailed) {
    for (const failure of failures) {
      l.warn(`${options.label} cleanup failed after an earlier error: ${failure instanceof Error ? failure.message : String(failure)}`, {
        category: 'pipeline',
        metadata: { stage: options.stage },
        error: failure
      })
    }
    return
  }
  throw InfraError(`${options.label} cleanup failed.`, {
    stage: options.stage,
    cause: new AggregateError(failures, `${options.label} cleanup failures`)
  })
}
