import * as l from '~/utils/app-logger/app-logger'
import { pollUntil } from '~/utils/retries'

export type LocalServerHealthResult =
  | { healthy: true }
  | { healthy: false, reason: 'timeout' }
  | { healthy: false, reason: 'process_exit', exitCode: number | null }

export const getErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined

export const isPidRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return getErrorCode(error) === 'EPERM'
  }
}

export const checkLocalServerHealthQuiet = async (baseUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    if (!response.ok) return false
    const body = await response.json() as { status?: string }
    return body?.status === 'ok'
  } catch {
    return false
  }
}

export const waitForLocalServerHealthState = async (options: {
  baseUrl: string
  healthy: boolean
  operationName: string
  timeoutMs: number
}): Promise<boolean> => {
  try {
    await pollUntil({
      operationName: options.operationName,
      intervalMs: 250,
      deadlineMs: options.timeoutMs,
      pollFn: async () => await checkLocalServerHealthQuiet(options.baseUrl),
      isDone: (result) => result === options.healthy
    })
    return true
  } catch {
    return false
  }
}

export const waitForLocalServerHealth = async (
  timeoutMs: number,
  proc: ReturnType<typeof Bun.spawn>,
  options: {
    baseUrl: string
    operationName: string
    pollIntervalMs: number
    heartbeatMs: number
    label: string
  }
): Promise<LocalServerHealthResult> => {
  const startedAt = Date.now()
  let lastHeartbeatAt = startedAt
  let exitCode: number | null = null

  void proc.exited.then(code => {
    exitCode = code
  }).catch(() => {
    exitCode = -1
  })

  try {
    await pollUntil({
      operationName: options.operationName,
      intervalMs: options.pollIntervalMs,
      deadlineMs: timeoutMs,
      pollFn: async () => {
        const healthy = await checkLocalServerHealthQuiet(options.baseUrl)
        const now = Date.now()
        if ((now - lastHeartbeatAt) >= options.heartbeatMs) {
          const elapsedSec = Math.floor((now - startedAt) / 1000)
          l.debug(`waiting for ${options.label} to become healthy (${elapsedSec}s elapsed)`)
          lastHeartbeatAt = now
        }
        return { healthy, exitCode }
      },
      isDone: (result) => result.healthy,
      isFailed: (result) => result.exitCode !== null
        ? { failed: true, reason: `process exited with code ${result.exitCode}` }
        : { failed: false }
    })
    return { healthy: true }
  } catch {
    return exitCode !== null
      ? { healthy: false, reason: 'process_exit', exitCode }
      : { healthy: false, reason: 'timeout' }
  }
}
