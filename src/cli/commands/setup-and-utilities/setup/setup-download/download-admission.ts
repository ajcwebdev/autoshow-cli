import type { ResourceGate, SetupDownloadAdmissionSnapshot } from '~/types'
import { createResourceGate } from '~/utils/resource-gate'

export const DEFAULT_SETUP_DOWNLOAD_CONCURRENCY = 3

let capacity = DEFAULT_SETUP_DOWNLOAD_CONCURRENCY
let gate: ResourceGate | undefined
let active = 0
let waiting = 0

const resolveGate = (): ResourceGate => {
  gate ??= createResourceGate({ capacity })
  return gate
}

export const setSetupDownloadConcurrency = (value: number): void => {
  capacity = Math.max(1, Math.floor(value))
  gate = undefined
  active = 0
  waiting = 0
}

export const getSetupDownloadAdmissionSnapshot = (): SetupDownloadAdmissionSnapshot =>
  ({ capacity, active, waiting })

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
