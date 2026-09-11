import type { AvailabilityWaiter, ProviderState } from '~/types'

export const wakeWaiters = (waiters: AvailabilityWaiter[]): void => {
  const pending = waiters.splice(0)
  for (const waiter of pending) {
    waiter.notify()
  }
}

export const runWithSttPollSlot = async <T>(state: ProviderState, pollSlotLimit: number, fn: () => Promise<T>): Promise<T> => {
  while (state.pollActiveCount >= pollSlotLimit) {
    await new Promise<void>((resolve) => {
      const waiter: AvailabilityWaiter = {
        resolved: false,
        notify: () => {
          if (waiter.resolved) {
            return
          }
          waiter.resolved = true
          state.pollWaiters = state.pollWaiters.filter((entry) => entry !== waiter)
          resolve()
        }
      }

      state.pollWaiters.push(waiter)
    })
  }

  state.pollActiveCount += 1
  state.stats.pollCount += 1
  try {
    return await fn()
  } finally {
    state.pollActiveCount = Math.max(0, state.pollActiveCount - 1)
    wakeWaiters(state.pollWaiters)
  }
}

export const waitForSttAvailability = async (states: ProviderState[], nearestCooldownMs: number | undefined): Promise<void> => {
  await new Promise<void>((resolve) => {
    const waiter: AvailabilityWaiter = {
      resolved: false,
      notify: () => {
        if (waiter.resolved) {
          return
        }
        waiter.resolved = true
        if (waiter.timer) {
          clearTimeout(waiter.timer)
        }
        for (const state of states) {
          state.waiters = state.waiters.filter((entry) => entry !== waiter)
        }
        resolve()
      }
    }

    if (nearestCooldownMs !== undefined && nearestCooldownMs > 0) {
      waiter.timer = setTimeout(waiter.notify, nearestCooldownMs)
    }

    for (const state of states) {
      state.waiters.push(waiter)
    }
  })
}
