export const sleepWithAbortSignal = async (
  delayMs: number,
  signal?: AbortSignal | undefined
): Promise<void> => {
  signal?.throwIfAborted()
  if (!signal) {
    await Bun.sleep(delayMs)
    return
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const cleanup = (): void => {
      signal.removeEventListener('abort', onAbort)
    }
    const onAbort = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      cleanup()
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    }
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }, delayMs)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
}

export const resolveAttemptSignal = (
  timeoutMs: number | undefined,
  abortSignal: AbortSignal | undefined
): AbortSignal | undefined => {
  const timeoutSignal = typeof timeoutMs === 'number'
    ? AbortSignal.timeout(timeoutMs)
    : undefined
  if (timeoutSignal && abortSignal) {
    return AbortSignal.any([timeoutSignal, abortSignal])
  }
  return timeoutSignal ?? abortSignal
}
