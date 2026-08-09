import type { LocalLlmServerResourceOptions } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { pollUntil } from '~/utils/retries'
import {
  getErrorCode,
  isPidRunning,
  waitForLocalServerHealthState
} from './local-server-health'

export type RecordedLocalServerStopProfile = {
  serverName: string
  baseUrl: string
  stopTimeoutMs: number
  stopPolicy: 'verified-pid' | 'health-clear'
  failureMessage?: ((pid: number) => string) | undefined
  stage: string
  readState: (options?: LocalLlmServerResourceOptions) => Promise<{ pid: number } | null>
  clearState: (pid: number | undefined, options?: LocalLlmServerResourceOptions) => Promise<void>
}

const waitForPidExit = async (
  profile: RecordedLocalServerStopProfile,
  pid: number
): Promise<boolean> => {
  try {
    await pollUntil({
      operationName: `${profile.serverName}-server-wait-process-exit`,
      intervalMs: 100,
      deadlineMs: profile.stopTimeoutMs,
      pollFn: async () => !isPidRunning(pid),
      isDone: (exited) => exited
    })
    return true
  } catch {
    return false
  }
}

export const stopRecordedLocalServer = async (
  profile: RecordedLocalServerStopProfile,
  options: LocalLlmServerResourceOptions = {}
): Promise<boolean> => {
  const state = await profile.readState(options)
  if (!state) {
    return false
  }
  const verifyPid = profile.stopPolicy === 'verified-pid'
  const clearState = async (): Promise<void> =>
    await profile.clearState(verifyPid ? state.pid : undefined, options)
  const waitForStopped = async (): Promise<boolean> => {
    const healthStopped = await waitForLocalServerHealthState({
      baseUrl: profile.baseUrl,
      healthy: false,
      operationName: `${profile.serverName}-server-wait-stopped`,
      timeoutMs: profile.stopTimeoutMs
    })
    return healthStopped && (!verifyPid || await waitForPidExit(profile, state.pid))
  }

  if (!isPidRunning(state.pid)) {
    await clearState()
    return false
  }

  try {
    process.kill(state.pid, 'SIGTERM')
  } catch (error) {
    if (getErrorCode(error) === 'ESRCH') {
      await clearState()
      return false
    }
    throw error
  }

  if (await waitForStopped()) {
    await clearState()
    return true
  }

  try {
    process.kill(state.pid, 'SIGKILL')
  } catch (error) {
    if (getErrorCode(error) !== 'ESRCH') {
      throw error
    }
  }

  if (await waitForStopped() || !verifyPid) {
    await clearState()
    return true
  }

  throw InfraError(
    profile.failureMessage?.(state.pid) ?? `Failed to stop recorded ${profile.serverName} server (pid: ${state.pid})`,
    { stage: profile.stage }
  )
}
