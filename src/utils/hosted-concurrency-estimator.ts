import type { HostedConcurrencyMode } from '~/types'

export const estimateHostedConcurrencyWallTimeMs = (
  durationsMs: readonly number[],
  configuredLimit: number,
  mode: HostedConcurrencyMode = 'ramp',
  rampIntervalMs = 5_000
): number => {
  if (durationsMs.length === 0) return 0
  const durations = durationsMs.map((duration) => Number.isFinite(duration) ? Math.max(0, duration) : 0)
  const cap = Math.max(1, Math.min(Math.floor(configuredLimit), durations.length))
  let liveLimit = mode === 'ramp' ? 1 : cap
  let now = 0
  let nextIndex = 0
  let nextRampAt: number | undefined
  const active: number[] = []

  const fill = (): void => {
    while (active.length < liveLimit && nextIndex < durations.length) {
      active.push(now + (durations[nextIndex] ?? 0))
      nextIndex += 1
    }
    nextRampAt = nextIndex < durations.length && liveLimit < cap
      ? nextRampAt ?? now + Math.max(1, rampIntervalMs)
      : undefined
  }

  fill()
  while (active.length > 0) {
    const nextCompletion = Math.min(...active)
    const eventAt = nextRampAt === undefined ? nextCompletion : Math.min(nextCompletion, nextRampAt)
    now = eventAt
    if (nextRampAt !== undefined && nextRampAt <= now) {
      liveLimit = Math.min(cap, liveLimit + 1)
      nextRampAt = undefined
    }
    for (let index = active.length - 1; index >= 0; index--) {
      if ((active[index] ?? Number.POSITIVE_INFINITY) <= now) active.splice(index, 1)
    }
    fill()
  }
  return Math.round(now)
}
