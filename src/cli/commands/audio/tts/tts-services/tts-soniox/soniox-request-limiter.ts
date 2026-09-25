import { setTimeout as delay } from 'node:timers/promises'

// One rolling window per invocation scheduler, shared by all files, voices, chunks and retries.
export const createSonioxRequestLimiter = (
  now: () => number = Date.now,
  wait: (ms: number, signal?: AbortSignal) => Promise<void> = async (ms, signal) => { await delay(ms, undefined, { signal }) }
) => {
  let starts: number[] = []
  return async (signal?: AbortSignal): Promise<void> => {
    for (;;) {
      signal?.throwIfAborted()
      const time = now()
      starts = starts.filter(start => start > time - 60_000)
      if (starts.length < 100) { starts.push(time); return }
      await wait(Math.max(1, starts[0]! + 60_000 - time), signal)
    }
  }
}
