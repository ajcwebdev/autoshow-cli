export const createManualTimerClock = <TimerHandle = number>(
  toHandle: (id: number) => TimerHandle = id => id as unknown as TimerHandle,
  fromHandle: (handle: TimerHandle) => number = handle => handle as unknown as number
) => {
  let now = 0
  let nextId = 1
  const timers = new Map<number, { at: number, callback: () => void }>()
  const setTimer = (callback: () => void, delayMs: number): TimerHandle => {
    const id = nextId++
    timers.set(id, { at: now + Math.max(0, delayMs), callback })
    return toHandle(id)
  }
  const clearTimer = (timer: TimerHandle): void => {
    timers.delete(fromHandle(timer))
  }
  const advance = async (durationMs: number): Promise<void> => {
    const target = now + durationMs
    while (true) {
      const next = [...timers.entries()].sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0]
      if (!next || next[1].at > target) break
      now = next[1].at
      timers.delete(next[0])
      next[1].callback()
      await Promise.resolve()
    }
    now = target
    await Promise.resolve()
  }
  return { now: () => now, setTimer, clearTimer, advance, timerCount: () => timers.size }
}
