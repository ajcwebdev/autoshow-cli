/**
 * Runs the provided tasks with a bounded number of concurrent workers while
 * preserving the original task order for any side effects that depend on it.
 *
 * Each task is expected to handle its own errors (the comic image loops count
 * failures internally and throw once at the end), so a worker that rejects will
 * surface immediately. The limit is clamped to at least 1.
 */
export const runWithConcurrency = async (
  limit: number,
  tasks: Array<() => Promise<void>>,
): Promise<void> => {
  if (tasks.length === 0) {
    return
  }

  const effectiveLimit = Math.max(1, Math.floor(limit))
  let nextIndex = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= tasks.length) {
        return
      }

      await tasks[current]!()
    }
  }

  const workerCount = Math.min(effectiveLimit, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
}

/**
 * Maps over items with a bounded number of concurrent workers, returning the
 * results in the original item order. Unlike runWithConcurrency, this collects
 * and returns each mapper's value, mirroring Promise.all(items.map(...)) while
 * capping how many run at once.
 */
export const mapWithConcurrency = async <TItem, TResult>(
  limit: number,
  items: TItem[],
  mapItem: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length)
  const tasks = items.map((item, index) => async () => {
    results[index] = await mapItem(item, index)
  })

  await runWithConcurrency(limit, tasks)
  return results
}
