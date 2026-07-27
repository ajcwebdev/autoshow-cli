import type { ResourceGate, SetupDownloadAdmissionSnapshot } from '~/types'
import { createResourceGate } from '~/utils/resource-gate'

// A full setup starts eight tasks at once and they are not independent: they
// share one network link, so an unbounded opening burst divides per-stream
// bandwidth eight ways and every large asset finishes later than it would have
// alone. Bounding the transfers is the fix; bounding the tasks is not, because
// task boundaries also carry CPU work that should keep overlapping.
export const DEFAULT_SETUP_DOWNLOAD_CONCURRENCY = 3

let capacity = DEFAULT_SETUP_DOWNLOAD_CONCURRENCY
let gate: ResourceGate | undefined
let active = 0
let waiting = 0

const resolveGate = (): ResourceGate => {
  gate ??= createResourceGate({ capacity })
  return gate
}

/** Test hook: resizing discards the current gate, so callers must be idle. */
export const setSetupDownloadConcurrency = (value: number): void => {
  capacity = Math.max(1, Math.floor(value))
  gate = undefined
  active = 0
  waiting = 0
}

export const getSetupDownloadAdmissionSnapshot = (): SetupDownloadAdmissionSnapshot =>
  ({ capacity, active, waiting })

/**
 * Holds a transfer slot for the duration of `run`. Callers must wrap only the
 * network phase: checksum verification and archive extraction are local work,
 * and holding a slot across them would stall a transfer behind a disk read.
 */
export const withSetupDownloadSlot = async <T>(run: () => Promise<T>): Promise<T> => {
  waiting += 1
  const release = await resolveGate().acquire().finally(() => { waiting -= 1 })
  active += 1
  try {
    return await run()
  } finally {
    active -= 1
    release()
  }
}
