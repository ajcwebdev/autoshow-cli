import { AsyncLocalStorage } from 'node:async_hooks'
import type { SetupHeartbeatEntry } from '~/types'
import * as l from '~/utils/app-logger/app-logger'

// Subprocess output is suppressed in compact mode, so a source build that takes
// minutes is otherwise indistinguishable from a hang.
const SETUP_HEARTBEAT_INTERVAL_MS = 30_000

const HEARTBEAT_SEPARATOR = ' · '

export const formatSetupElapsed = (elapsedMs: number): string => {
  if (elapsedMs < 1000) return `${elapsedMs}ms`
  if (elapsedMs < 60_000) return `${(elapsedMs / 1000).toFixed(1)}s`
  const totalSeconds = Math.round(elapsedMs / 1000)
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
}

/**
 * One line for every in-flight task, or nothing at all. A task that printed its
 * own progress within the last interval is already proving it is alive, so
 * repeating that in the heartbeat is the noise this aggregation exists to stop.
 */
export const formatSetupHeartbeatLine = (
  entries: readonly SetupHeartbeatEntry[],
  nowMs: number,
  intervalMs: number = SETUP_HEARTBEAT_INTERVAL_MS
): string | undefined => {
  const quiet = entries.filter((entry) => nowMs - entry.lastActivityAtMs >= intervalMs)
  if (quiet.length === 0) return undefined

  return `Still running: ${quiet
    .map((entry) => `${entry.label} ${formatSetupElapsed(nowMs - entry.startedAtMs)}`)
    .join(HEARTBEAT_SEPARATOR)}`
}

const inFlight = new Map<string, SetupHeartbeatEntry>()
// One ticker for every task rather than one per task: eight unsynchronized
// timers were what turned a liveness signal into ~40 lines per cold run.
let ticker: ReturnType<typeof setInterval> | undefined

const stopTicker = (): void => {
  if (!ticker) return
  clearInterval(ticker)
  ticker = undefined
}

const startTicker = (): void => {
  if (ticker) return
  ticker = setInterval(() => {
    const nowMs = Date.now()
    const line = formatSetupHeartbeatLine([...inFlight.values()], nowMs)
    if (!line) return
    // The mechanism is scheduling, so it stays; only the emission is normalized — a
    // category, and the elapsed times as structured fields rather than only inside the
    // rendered sentence.
    l.write('info', line, {
      category: 'command',
      metadata: {
        tasks: [...inFlight.values()].map((entry) => ({
          label: entry.label,
          elapsedMs: nowMs - entry.startedAtMs,
          quietMs: nowMs - entry.lastActivityAtMs
        }))
      }
    })
  }, SETUP_HEARTBEAT_INTERVAL_MS)
  ticker.unref?.()
}

const taskContext = new AsyncLocalStorage<{ label: string }>()

export const runWithSetupHeartbeat = async <T>(
  label: string,
  startedAtMs: number,
  run: () => Promise<T>
): Promise<T> => {
  inFlight.set(label, { label, startedAtMs, lastActivityAtMs: startedAtMs })
  startTicker()
  try {
    return await taskContext.run({ label }, run)
  } finally {
    inFlight.delete(label)
    if (inFlight.size === 0) stopTicker()
  }
}
