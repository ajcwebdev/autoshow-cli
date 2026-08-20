/**
 * `label:enter:<ms>` / `label:exit:<ms>` — the line protocol the spawned children in the
 * process-lock and adaptive-concurrency suites use to report when they held a lease.
 * Both the emitting source snippet and the parser live here so the two ends cannot drift.
 */
export const childLifecycleEnterLine = (label: string): string =>
  `console.log('${label}:enter:' + Date.now())`

export const childLifecycleExitLine = (label: string): string =>
  `console.log('${label}:exit:' + Date.now())`

/** Parse one `label:phase:` timestamp out of combined child stdout; 0 when absent. */
export const readChildLifecycleTimestamp = (
  stdout: string,
  label: string,
  phase: 'enter' | 'exit'
): number => {
  const prefix = `${label}:${phase}:`
  const line = stdout.trim().split('\n').find((entry) => entry.startsWith(prefix))
  return Number(line?.split(':')[2] ?? '0')
}
