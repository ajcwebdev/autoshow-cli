import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LlamafileServerState, LocalLlmServerResourceOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import { pollUntil } from '~/utils/retries'
import { resolveProcessLockRoot } from '~/utils/process-lock'
import { collectStreamTail, stripAnsi } from '../llama/llama-download-progress'
import { ensureLlamafileBundleDownloaded } from './llamafile-download'
import {
  DEFAULT_LLAMAFILE_SERVER_START_TIMEOUT_MS,
  LLAMAFILE_BASE_URL,
  LLAMAFILE_PORT,
  LLAMAFILE_SERVER_HEALTH_HEARTBEAT_MS,
  LLAMAFILE_SERVER_HEALTH_POLL_INTERVAL_MS,
  LLAMAFILE_SERVER_STDERR_TAIL_LIMIT,
  LLAMAFILE_SERVER_STOP_TIMEOUT_MS,
  LLAMAFILE_STATE_FILE_NAME
} from './llamafile-constants'

const getErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined

const getStatePath = (options: LocalLlmServerResourceOptions = {}): string =>
  join(resolveProcessLockRoot(options), LLAMAFILE_STATE_FILE_NAME)

const readState = async (options: LocalLlmServerResourceOptions = {}): Promise<LlamafileServerState | null> => {
  try {
    const parsed = JSON.parse(await readFile(getStatePath(options), 'utf-8')) as Record<string, unknown>
    const pid = typeof parsed['pid'] === 'number' ? parsed['pid'] : null
    if (!Number.isInteger(pid) || (pid ?? 0) < 1) {
      return null
    }
    return {
      pid: pid as number,
      port: typeof parsed['port'] === 'number' ? parsed['port'] : LLAMAFILE_PORT,
      model: typeof parsed['model'] === 'string' ? parsed['model'] : null,
      createdAt: typeof parsed['createdAt'] === 'string' ? parsed['createdAt'] : ''
    }
  } catch {
    return null
  }
}

const writeState = async (pid: number, model: string, options: LocalLlmServerResourceOptions = {}): Promise<void> => {
  await mkdir(resolveProcessLockRoot(options), { recursive: true })
  await writeFile(getStatePath(options), JSON.stringify({
    pid,
    port: LLAMAFILE_PORT,
    model,
    createdAt: new Date().toISOString()
  } satisfies LlamafileServerState, null, 2))
}

const clearState = async (options: LocalLlmServerResourceOptions = {}): Promise<void> => {
  await rm(getStatePath(options), { force: true })
}

const isPidRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return getErrorCode(error) === 'EPERM'
  }
}

export const checkLlamafileHealthQuiet = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${LLAMAFILE_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    if (!response.ok) {
      return false
    }
    const body = await response.json() as { status?: string }
    return body?.status === 'ok'
  } catch {
    return false
  }
}

// The chat completions endpoint serves whatever model the bundle loaded. We query
// /v1/models to report the server's own id; if unavailable we fall back to the alias.
const resolveLlamafileRequestModel = async (fallback: string): Promise<string> => {
  try {
    const response = await fetch(`${LLAMAFILE_BASE_URL}/v1/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    if (!response.ok) {
      return fallback
    }
    const body = await response.json() as { data?: Array<{ id?: unknown }> }
    const id = body?.data?.find((entry) => typeof entry?.id === 'string')?.id
    return typeof id === 'string' && id.trim().length > 0 ? id : fallback
  } catch {
    return fallback
  }
}

const waitForHealthState = async (healthy: boolean, timeoutMs: number): Promise<boolean> => {
  try {
    await pollUntil({
      operationName: healthy ? 'llamafile-server-wait-healthy' : 'llamafile-server-wait-stopped',
      intervalMs: 250,
      deadlineMs: timeoutMs,
      pollFn: async () => await checkLlamafileHealthQuiet(),
      isDone: (result) => result === healthy
    })
    return true
  } catch {
    return false
  }
}

const waitForLlamafileHealth = async (
  timeoutMs: number,
  proc: ReturnType<typeof Bun.spawn>
): Promise<
  | { healthy: true }
  | { healthy: false, reason: 'timeout' }
  | { healthy: false, reason: 'process_exit', exitCode: number | null }
> => {
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
      operationName: 'llamafile-server-health',
      intervalMs: LLAMAFILE_SERVER_HEALTH_POLL_INTERVAL_MS,
      deadlineMs: timeoutMs,
      pollFn: async () => {
        const healthy = await checkLlamafileHealthQuiet()
        const now = Date.now()
        if ((now - lastHeartbeatAt) >= LLAMAFILE_SERVER_HEALTH_HEARTBEAT_MS) {
          const elapsedSec = Math.floor((now - startedAt) / 1000)
          l.debug(`waiting for llamafile server to become healthy (${elapsedSec}s elapsed)`)
          lastHeartbeatAt = now
        }
        return { healthy, exitCode }
      },
      isDone: (result) => result.healthy,
      isFailed: (result) => {
        if (result.exitCode !== null) {
          return { failed: true, reason: `process exited with code ${result.exitCode}` }
        }
        return { failed: false }
      }
    })
    return { healthy: true }
  } catch {
    if (exitCode !== null) {
      return { healthy: false, reason: 'process_exit', exitCode }
    }
    return { healthy: false, reason: 'timeout' }
  }
}

const stopRecordedLlamafileServer = async (options: LocalLlmServerResourceOptions = {}): Promise<boolean> => {
  const state = await readState(options)
  if (!state) {
    return false
  }

  if (!isPidRunning(state.pid)) {
    await clearState(options)
    return false
  }

  try {
    process.kill(state.pid, 'SIGTERM')
  } catch (error) {
    if (getErrorCode(error) === 'ESRCH') {
      await clearState(options)
      return false
    }
    throw error
  }

  if (await waitForHealthState(false, LLAMAFILE_SERVER_STOP_TIMEOUT_MS)) {
    await clearState(options)
    return true
  }

  try {
    process.kill(state.pid, 'SIGKILL')
  } catch (error) {
    if (getErrorCode(error) !== 'ESRCH') {
      throw error
    }
  }
  await waitForHealthState(false, LLAMAFILE_SERVER_STOP_TIMEOUT_MS)
  await clearState(options)
  return true
}

export const stopLlamafileServer = async (options: LocalLlmServerResourceOptions = {}): Promise<void> => {
  await stopRecordedLlamafileServer(options)
}

export const stopLlamafileServerForRecovery = async (): Promise<void> => {
  await stopRecordedLlamafileServer()
}

const startLlamafileServer = async (bundlePath: string, model: string): Promise<{ requestModel: string }> => {
  l.write('info', `Starting llamafile server (${model}) on ${LLAMAFILE_BASE_URL}`)
  // llamafiles are Cosmopolitan APE binaries; macOS posix_spawn cannot exec them
  // directly (ENOEXEC), so launch through a shell that reads the self-extracting
  // script. The stub execs in place, so proc.pid stays the server pid for stop/kill.
  const proc = Bun.spawn(
    ['sh', bundlePath, '--server', '--host', '127.0.0.1', '--port', String(LLAMAFILE_PORT)],
    { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' }
  )

  let stderrTail = ''
  const cancelStderrReader = collectStreamTail(proc.stderr, chunk => {
    stderrTail = (stderrTail + stripAnsi(chunk)).slice(-LLAMAFILE_SERVER_STDERR_TAIL_LIMIT)
  })
  proc.unref()

  const healthResult = await waitForLlamafileHealth(DEFAULT_LLAMAFILE_SERVER_START_TIMEOUT_MS, proc)
  cancelStderrReader()

  if (!healthResult.healthy) {
    const details = stderrTail.trim()
    if (healthResult.reason === 'process_exit') {
      const exitLabel = healthResult.exitCode ?? 'unknown'
      throw InfraError(
        details.length > 0
          ? `llamafile server exited before becoming healthy (exit code ${exitLabel}).\nllamafile stderr:\n${details}`
          : `llamafile server exited before becoming healthy (exit code ${exitLabel})`,
        { stage: 'write:llamafile' }
      )
    }
    const timeoutSeconds = Math.floor(DEFAULT_LLAMAFILE_SERVER_START_TIMEOUT_MS / 1000)
    throw InfraError(
      details.length > 0
        ? `llamafile server failed to become healthy within ${timeoutSeconds} seconds.\nllamafile stderr (tail):\n${details}`
        : `llamafile server failed to become healthy within ${timeoutSeconds} seconds`,
      { stage: 'write:llamafile' }
    )
  }

  await writeState(proc.pid, model)
  const requestModel = await resolveLlamafileRequestModel(model)
  return { requestModel }
}

export const ensureLlamafileServerRunning = async (model: string): Promise<{ requestModel: string }> => {
  const bundlePath = await ensureLlamafileBundleDownloaded(model)

  if (await checkLlamafileHealthQuiet()) {
    const state = await readState()
    if (state && state.model === model && isPidRunning(state.pid)) {
      l.write('info', `Reusing llamafile server on ${LLAMAFILE_BASE_URL} (${model})`)
      const requestModel = await resolveLlamafileRequestModel(model)
      return { requestModel }
    }

    if (state && isPidRunning(state.pid)) {
      l.write('info', `Restarting llamafile server on ${LLAMAFILE_BASE_URL} for model ${model}`)
      await stopRecordedLlamafileServer()
    } else {
      throw InfraError(
        `A healthy service is already running on localhost:${LLAMAFILE_PORT}, but no recorded AutoShow-managed llamafile server was found. Stop that service before running a llamafile model.`,
        { stage: 'write:llamafile' }
      )
    }
  } else {
    await stopRecordedLlamafileServer()
  }

  return await startLlamafileServer(bundlePath, model)
}
