import { AsyncLocalStorage } from 'node:async_hooks'
import type { LogCategory, LogContext } from '~/types'

const contextStore = new AsyncLocalStorage<LogContext>()
const suppressionStore = new AsyncLocalStorage<ReadonlySet<LogCategory>>()

export const getLogContext = (): LogContext => {
  return contextStore.getStore() ?? {}
}

export const runWithLogContext = async <T>(
  context: LogContext,
  fn: () => Promise<T> | T
): Promise<T> => {
  const merged: LogContext = {
    ...getLogContext(),
    ...context
  }

  return await contextStore.run(merged, fn)
}

export const getSuppressedLogCategories = (): ReadonlySet<LogCategory> =>
  suppressionStore.getStore() ?? new Set<LogCategory>()

export const runWithSuppressedLogCategories = async <T>(
  categories: readonly LogCategory[],
  fn: () => Promise<T> | T
): Promise<T> => {
  const suppressed = new Set(getSuppressedLogCategories())
  for (const category of categories) suppressed.add(category)
  return await suppressionStore.run(suppressed, fn)
}
