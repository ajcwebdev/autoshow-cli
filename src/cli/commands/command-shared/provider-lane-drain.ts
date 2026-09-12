/** Shared admission mechanics. Provider adapters retain queue selection and recovery policy. */
export const reduceProviderLaneLimit = (limit: number): number => Math.max(1, Math.floor(limit / 2))

export const trimProviderLaneHistory = <T>(items: T[], limit = 100): void => {
  if (items.length > limit) items.splice(0, items.length - limit)
}

export const extendProviderLanePause = (untilMs: number, now: number, delayMs: number) => {
  const next = Math.max(untilMs, now + Math.max(0, delayMs))
  return { untilMs: next, addedMs: Math.max(0, next - Math.max(now, untilMs)) }
}

export const drainProviderLane = <T>(policy: {
  canAdmit: () => boolean
  pick: () => T | undefined
  start: (job: T) => void | Promise<void>
  stopAfterAdmission?: (() => boolean) | undefined
}): void | Promise<void> => {
  while (policy.canAdmit()) {
    const job = policy.pick()
    if (job === undefined) return
    const entered = policy.start(job)
    if (entered) return entered.then(() => policy.stopAfterAdmission?.() ? undefined : drainProviderLane(policy))
    if (policy.stopAfterAdmission?.()) return
  }
}

/** Serialize asynchronous drains without losing a notification during admission. */
export class LaneDrainLoop<T extends object> {
  readonly #busy = new WeakSet<T>()
  readonly #queued = new WeakSet<T>()

  run(state: T, drain: () => Promise<void>): void {
    if (this.#busy.has(state)) { this.#queued.add(state); return }
    this.#busy.add(state)
    void drain().finally(() => {
      this.#busy.delete(state)
      if (this.#queued.delete(state)) this.run(state, drain)
    })
  }
}

/** One timer per lane. Later notifications cannot postpone an earlier wake. */
export class LaneWakeTimer<T extends object, Handle = ReturnType<typeof setTimeout>> {
  readonly #wakes = new Map<T, { atMs: number, handle: Handle }>()
  constructor(private readonly clock: {
    now: () => number
    setTimer: (callback: () => void, delayMs: number) => Handle
    clearTimer: (handle: Handle) => void
  }) {}

  schedule(lane: T, atMs: number, wake: () => void): void {
    const current = this.#wakes.get(lane)
    if (current && current.atMs <= atMs) return
    this.clear(lane)
    const entry = { atMs, handle: undefined as Handle }
    entry.handle = this.clock.setTimer(() => {
      if (this.#wakes.get(lane) !== entry) return
      this.#wakes.delete(lane)
      wake()
    }, Math.max(0, atMs - this.clock.now()))
    this.#wakes.set(lane, entry)
  }

  clear(lane: T): void {
    const entry = this.#wakes.get(lane)
    if (!entry) return
    this.#wakes.delete(lane)
    this.clock.clearTimer(entry.handle)
  }

  dispose(): void {
    for (const lane of this.#wakes.keys()) this.clear(lane)
  }
}
