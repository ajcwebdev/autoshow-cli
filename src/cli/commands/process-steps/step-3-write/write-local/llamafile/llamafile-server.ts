import type { LocalLlmServerResourceOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import {
  collectStreamTail,
  stripAnsi,
  throwIfServerStartupFailed
} from '../llama/llama-download-progress'
import {
  checkLocalServerHealthQuiet,
  isPidRunning,
  waitForLocalServerHealth
} from '../local-server-health'
import {
  stopRecordedLocalServer,
  type RecordedLocalServerStopProfile
} from '../local-server-stop'
import { ensureLlamafileBundleDownloaded } from './llamafile-download'
import {
  DEFAULT_LLAMAFILE_SERVER_START_TIMEOUT_MS,
  LLAMAFILE_BASE_URL,
  LLAMAFILE_PORT,
  LLAMAFILE_SERVER_HEALTH_HEARTBEAT_MS,
  LLAMAFILE_SERVER_HEALTH_POLL_INTERVAL_MS,
  LLAMAFILE_SERVER_STDERR_TAIL_LIMIT,
  LLAMAFILE_SERVER_STOP_TIMEOUT_MS
} from './llamafile-constants'
import {
  clearLlamafileServerState,
  readLlamafileServerState,
  writeLlamafileServerState
} from './llamafile-server-state'

export const checkLlamafileHealthQuiet = async (): Promise<boolean> =>
  await checkLocalServerHealthQuiet(LLAMAFILE_BASE_URL)

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

export const LLAMAFILE_STOP_PROFILE = {
  serverName: 'llamafile',
  baseUrl: LLAMAFILE_BASE_URL,
  stopTimeoutMs: LLAMAFILE_SERVER_STOP_TIMEOUT_MS,
  stopPolicy: 'health-clear',
  stage: 'write:llamafile',
  readState: readLlamafileServerState,
  clearState: clearLlamafileServerState
} satisfies RecordedLocalServerStopProfile

const stopRecordedLlamafileServer = async (
  options: LocalLlmServerResourceOptions = {}
): Promise<boolean> => await stopRecordedLocalServer(LLAMAFILE_STOP_PROFILE, options)

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

  const healthResult = await waitForLocalServerHealth(DEFAULT_LLAMAFILE_SERVER_START_TIMEOUT_MS, proc, {
    baseUrl: LLAMAFILE_BASE_URL,
    operationName: 'llamafile-server-health',
    pollIntervalMs: LLAMAFILE_SERVER_HEALTH_POLL_INTERVAL_MS,
    heartbeatMs: LLAMAFILE_SERVER_HEALTH_HEARTBEAT_MS,
    label: 'llamafile server'
  })
  cancelStderrReader()

  throwIfServerStartupFailed(healthResult, stderrTail, DEFAULT_LLAMAFILE_SERVER_START_TIMEOUT_MS, {
    serverLabel: 'llamafile server',
    stderrLabel: 'llamafile',
    stage: 'write:llamafile'
  })

  await writeLlamafileServerState(proc.pid, model)
  const requestModel = await resolveLlamafileRequestModel(model)
  return { requestModel }
}

export const ensureLlamafileServerRunning = async (model: string): Promise<{ requestModel: string }> => {
  const bundlePath = await ensureLlamafileBundleDownloaded(model)

  if (await checkLlamafileHealthQuiet()) {
    const state = await readLlamafileServerState()
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
