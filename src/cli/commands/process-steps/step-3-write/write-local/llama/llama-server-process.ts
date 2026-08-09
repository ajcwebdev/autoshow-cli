import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import { pollUntil } from '~/utils/retries'
import {
  LLAMA_BASE_URL,
  LLAMA_SERVER_HEALTH_HEARTBEAT_MS,
  LLAMA_SERVER_HEALTH_POLL_INTERVAL_MS,
  LLAMA_SERVER_STOP_TIMEOUT_MS
} from './llama-constants'
import { clearLlamaServerState, readLlamaServerState } from './llama-server-state'
import type { LocalLlmServerResourceOptions } from '~/types'
import {
  checkLocalServerHealthQuiet,
  getErrorCode,
  isPidRunning,
  waitForLocalServerHealth,
  waitForLocalServerHealthState
} from '../local-server-health'

export const checkLlamaHealthQuiet = async (): Promise<boolean> =>
  await checkLocalServerHealthQuiet(LLAMA_BASE_URL)

const waitForPidsExit = async (pids: number[], timeoutMs: number): Promise<boolean> => {
  try {
    await pollUntil({
      operationName: 'llama-server-wait-process-exit',
      intervalMs: 100,
      deadlineMs: timeoutMs,
      pollFn: async () => pids.every((pid) => !isPidRunning(pid)),
      isDone: (allExited) => allExited
    })
    return true
  } catch {
    return false
  }
}

const stopRecordedDefaultLlamaServer = async (
  options: LocalLlmServerResourceOptions = {}
): Promise<boolean> => {
  const state = await readLlamaServerState(options)
  if (!state) {
    return false
  }

  if (!isPidRunning(state.pid)) {
    await clearLlamaServerState(state.pid, options)
    return false
  }

  try {
    process.kill(state.pid, 'SIGTERM')
  } catch (error) {
    if (getErrorCode(error) === 'ESRCH') {
      await clearLlamaServerState(state.pid, options)
      return false
    }
    throw error
  }

  const stoppedAfterTerm = await waitForLocalServerHealthState({
    baseUrl: LLAMA_BASE_URL,
    healthy: false,
    operationName: 'llama-server-wait-stopped',
    timeoutMs: LLAMA_SERVER_STOP_TIMEOUT_MS
  })
    && await waitForPidsExit([state.pid], LLAMA_SERVER_STOP_TIMEOUT_MS)
  if (stoppedAfterTerm) {
    await clearLlamaServerState(state.pid, options)
    return true
  }

  try {
    process.kill(state.pid, 'SIGKILL')
  } catch (error) {
    if (getErrorCode(error) !== 'ESRCH') {
      throw error
    }
  }

  const stoppedAfterKill = await waitForLocalServerHealthState({
    baseUrl: LLAMA_BASE_URL,
    healthy: false,
    operationName: 'llama-server-wait-stopped',
    timeoutMs: LLAMA_SERVER_STOP_TIMEOUT_MS
  })
    && await waitForPidsExit([state.pid], LLAMA_SERVER_STOP_TIMEOUT_MS)
  if (stoppedAfterKill) {
    await clearLlamaServerState(state.pid, options)
    return true
  }

  throw InfraError(`Failed to stop recorded llama-server on localhost:8080 (pid: ${state.pid})`, { stage: 'write:llama' })
}

export const stopDefaultLlamaServer = async (
  options: LocalLlmServerResourceOptions = {}
): Promise<void> => {
  if (await stopRecordedDefaultLlamaServer(options)) {
    return
  }

  if (!await checkLlamaHealthQuiet()) {
    await clearLlamaServerState(undefined, options)
    return
  }

  l.debug('A healthy unrecorded llama-server is running on localhost:8080; leaving it untouched')
}

export const stopRunningLlamaServerForRestart = async (): Promise<void> => {
  if (await stopRecordedDefaultLlamaServer()) {
    return
  }

  throw InfraError('A healthy service is already running on localhost:8080, but no recorded AutoShow-managed llama-server state was found. Stop that service manually before restarting with a different model.', { stage: 'write:llama' })
}

export const stopRecordedLlamaServerIfPresent = async (): Promise<boolean> =>
  await stopRecordedDefaultLlamaServer()

export const waitForLlamaHealth = async (
  timeoutMs: number,
  proc: ReturnType<typeof Bun.spawn>
): ReturnType<typeof waitForLocalServerHealth> =>
  waitForLocalServerHealth(timeoutMs, proc, {
    baseUrl: LLAMA_BASE_URL,
    operationName: 'llama-server-health',
    pollIntervalMs: LLAMA_SERVER_HEALTH_POLL_INTERVAL_MS,
    heartbeatMs: LLAMA_SERVER_HEALTH_HEARTBEAT_MS,
    label: 'llama-server'
  })

const waitForSpawnedProcessExit = async (
  proc: ReturnType<typeof Bun.spawn>,
  timeoutMs: number
): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      proc.exited.then(() => true).catch(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export const stopSpawnedLlamaServer = async (proc: ReturnType<typeof Bun.spawn>): Promise<void> => {
  proc.kill('SIGTERM')
  if (await waitForSpawnedProcessExit(proc, LLAMA_SERVER_STOP_TIMEOUT_MS)) {
    return
  }

  proc.kill('SIGKILL')
  await waitForSpawnedProcessExit(proc, LLAMA_SERVER_STOP_TIMEOUT_MS)
}
