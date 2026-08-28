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
