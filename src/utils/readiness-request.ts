import { ProviderError } from './error-handler'

export const READINESS_REQUEST_TIMEOUT_MS = 10_000
export const READINESS_OPERATION_TIMEOUT_MS = 30_000
export const READINESS_MAX_PAGES = 20

/** Bound headers and body consumption, even when a mock ignores AbortSignal. */
export const boundedReadinessFetch = (
  fetchImpl: typeof fetch = fetch,
  options: { timeoutMs?: number, deadline?: number } = {}
): typeof fetch => {
  const deadline = options.deadline ?? Date.now() + READINESS_OPERATION_TIMEOUT_MS
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const timeoutMs = Math.max(0, Math.min(options.timeoutMs ?? READINESS_REQUEST_TIMEOUT_MS, deadline - Date.now()))
    if (timeoutMs === 0) throw ProviderError('Readiness operation deadline exceeded.', { stage: 'readiness', retryable: true, metadata: { readinessFailure: 'timeout' } })
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl(input, { ...init, signal: controller.signal, redirect: 'error' })
          if (!response.ok) throw ProviderError(`Readiness request failed (HTTP ${response.status}).`, { stage: 'readiness', status: response.status, retryable: response.status === 429 || response.status >= 500 })
          const body = await response.arrayBuffer()
          return new Response(body, { status: response.status, headers: response.headers })
        })(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(ProviderError('Readiness request timed out.', { stage: 'readiness', retryable: true, metadata: { readinessFailure: 'timeout' } }))
          }, timeoutMs)
        })
      ])
    } finally {
      clearTimeout(timer)
    }
  }) as typeof fetch
}
