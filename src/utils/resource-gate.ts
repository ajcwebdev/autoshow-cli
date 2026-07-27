import type { ResourceGate, ResourceGateOptions } from '~/types'

const DEFAULT_RESOURCE_GATE_CAPACITY = 1

export const normalizeResourceGateCapacity = (
  value: unknown,
  fallback = DEFAULT_RESOURCE_GATE_CAPACITY
): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback

/**
 * Counting semaphore with a FIFO waiter queue. `acquire` resolves immediately
 * when a slot is free, so a gate at capacity is the only case that defers.
 */
export const createResourceGate = (options: ResourceGateOptions = {}): ResourceGate => {
  const capacity = normalizeResourceGateCapacity(options.capacity)
  let active = 0
  const waiters: Array<() => void> = []

  const wakeNext = (): void => {
    if (active >= capacity) {
      return
    }
    waiters.shift()?.()
  }

  return {
    capacity,
    acquire: async (): Promise<() => void> => {
      if (active >= capacity) {
        await new Promise<void>((resolve) => {
          waiters.push(resolve)
        })
      }

      active += 1
      let released = false
      return () => {
        if (released) {
          return
        }
        released = true
        active = Math.max(0, active - 1)
        wakeNext()
      }
    }
  }
}
