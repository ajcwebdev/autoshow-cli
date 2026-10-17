import type { ResourceGate, ResourceGateOptions } from '~/types'

const DEFAULT_RESOURCE_GATE_CAPACITY = 1

// Capacities below one slot would block every acquire, so they fall back to the default.
const normalizeResourceGateCapacity = (
  value: unknown,
  fallback = DEFAULT_RESOURCE_GATE_CAPACITY
): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : fallback

export const runWithGate = async <T>(
  gate: ResourceGate,
  fn: () => Promise<T>
): Promise<T> => {
  const release = await gate.acquire()
  try {
    return await fn()
  } finally {
    release()
  }
}

export const createResourceGate = (options: ResourceGateOptions = {}): ResourceGate => {
  const capacity = normalizeResourceGateCapacity(options.capacity)
  let active = 0
  const waiters: Array<() => void> = []

  const gate: ResourceGate = {
    capacity,
    acquire: async (): Promise<() => void> => {
      if (active < capacity) {
        active += 1
      } else {
        // A releasing holder hands its occupied slot straight to this waiter.
        await new Promise<void>((resolve) => {
          waiters.push(resolve)
        })
      }

      let released = false
      return () => {
        if (released) {
          return
        }
        released = true
        const next = waiters.shift()
        if (next) {
          next()
        } else {
          active -= 1
        }
      }
    }
  }

  gate.runWithGate = async <T>(fn: () => Promise<T>): Promise<T> => await runWithGate(gate, fn)
  return gate
}
