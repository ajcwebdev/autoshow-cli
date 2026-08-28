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
