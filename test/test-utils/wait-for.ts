/**
 * Waits for local test state to settle.
 *
 * Four near-identical copies of this used to live in individual suites, each with its own
 * timeout, its own polling interval and its own failure message, and one condition wait
 * was unbounded — a predicate that never became true hung until the whole test timed out,
 * reporting nothing about what it was waiting for.
 *
 * This is for synchronizing on in-process state, not for absorbing transient failures:
 * transient absorption belongs to `runCommandWithTransientRetry`.
 */
export const waitFor = async (
  predicate: () => boolean,
  options: { timeoutMs?: number | undefined, intervalMs?: number | undefined, label?: string | undefined } = {}
): Promise<void> => {
  const timeoutMs = options.timeoutMs ?? 2_000
  const intervalMs = options.intervalMs ?? 1
  const deadline = Date.now() + timeoutMs

  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${options.label ?? 'test condition'}`)
    }
    await Bun.sleep(intervalMs)
  }
}
