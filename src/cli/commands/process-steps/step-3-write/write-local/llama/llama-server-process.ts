import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
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
  waitForLocalServerHealth,
} from '../local-server-health'
import {
  stopRecordedLocalServer,
  type RecordedLocalServerStopProfile
} from '../local-server-stop'

export const checkLlamaHealthQuiet = async (): Promise<boolean> =>
  await checkLocalServerHealthQuiet(LLAMA_BASE_URL)

export const LLAMA_STOP_PROFILE = {
  serverName: 'llama',
  baseUrl: LLAMA_BASE_URL,
  stopTimeoutMs: LLAMA_SERVER_STOP_TIMEOUT_MS,
  stopPolicy: 'verified-pid',
  failureMessage: (pid: number) =>
    `Failed to stop recorded llama-server on localhost:8080 (pid: ${pid})`,
  stage: 'write:llama',
  readState: readLlamaServerState,
  clearState: clearLlamaServerState
} satisfies RecordedLocalServerStopProfile

const stopRecordedDefaultLlamaServer = async (
  options: LocalLlmServerResourceOptions = {}
): Promise<boolean> => await stopRecordedLocalServer(LLAMA_STOP_PROFILE, options)

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
