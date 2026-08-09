import type { LlamaServerIdentity, LlamaServerTarget } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import {
  getLlamaServerStartTimeoutMs,
  resolveLlamaServerBinary,
  resolveLlamaServerTarget
} from './llama-config'
import { LLAMA_SERVER_STDERR_TAIL_LIMIT } from './llama-constants'
import {
  throwIfServerStartupFailed,
  watchLlamaServerStderr
} from './llama-download-progress'
import {
  describeLlamaServerIdentity,
  describeLlamaServerTarget,
  evaluateLlamaServerIdentityMatch,
  inspectRunningLlamaServer
} from './llama-server-identity'
import {
  checkLlamaHealthQuiet,
  stopRecordedLlamaServerIfPresent,
  stopRunningLlamaServerForRestart,
  waitForLlamaHealth
} from './llama-server-process'
import { writeLlamaServerState } from './llama-server-state'

const startLlamaServer = async (target: LlamaServerTarget): Promise<LlamaServerIdentity> => {
  const llamaServerPath = resolveLlamaServerBinary()

  if (target.mode === 'repo' && target.expectedRepo !== target.requestedModel) {
    l.write('info', `Resolved llama model alias ${target.requestedModel} -> ${target.expectedRepo}`)
  }
  l.write('info', `Starting llama-server (${describeLlamaServerTarget(target)})`)
  const proc = Bun.spawn([llamaServerPath, ...target.startupArgs, '--host', '127.0.0.1', '--port', '8080', '--jinja'], {
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'pipe'
  })
  const stderrWatch = watchLlamaServerStderr(proc.stderr, LLAMA_SERVER_STDERR_TAIL_LIMIT)
  proc.unref()

  const startTimeoutMs = getLlamaServerStartTimeoutMs()
  const healthResult = await waitForLlamaHealth(startTimeoutMs, proc)
  stderrWatch.stop()
  throwIfServerStartupFailed(healthResult, stderrWatch.getTail(), startTimeoutMs, {
    serverLabel: 'llama-server',
    stderrLabel: 'llama-server',
    stage: 'write:llama'
  })

  const identity = await inspectRunningLlamaServer()
  if (!identity) {
    throw InfraError(`llama-server became healthy but could not verify the loaded model for ${describeLlamaServerTarget(target)}`, { stage: 'write:llama' })
  }

  const match = evaluateLlamaServerIdentityMatch(target, identity)
  if (!match.matches) {
    throw InfraError(
      `llama-server became healthy but loaded the wrong target (${describeLlamaServerIdentity(identity)}). Expected ${describeLlamaServerTarget(target)}. ${match.reason}`,
      { stage: 'write:llama' }
    )
  }

  await writeLlamaServerState(proc.pid)
  return identity
}

export const ensureLlamaServerRunning = async (model: string): Promise<LlamaServerIdentity> => {
  const target = resolveLlamaServerTarget(model)

  if (await checkLlamaHealthQuiet()) {
    const identity = await inspectRunningLlamaServer()
    if (!identity) {
      throw InfraError('A healthy service is already running on localhost:8080, but it could not be verified as llama.cpp.', { stage: 'write:llama' })
    }

    const match = evaluateLlamaServerIdentityMatch(target, identity)
    if (match.matches) {
      l.write('info', `Reusing llama-server (${describeLlamaServerIdentity(identity)})`)
      return identity
    }

    l.write('info', `Restarting llama-server on localhost:8080 (${describeLlamaServerIdentity(identity)}; expected ${describeLlamaServerTarget(target)})`)
    await stopRunningLlamaServerForRestart()
  }

  if (await stopRecordedLlamaServerIfPresent()) {
    l.write('info', 'Stopped stale recorded llama-server process before startup')
  }

  return await startLlamaServer(target)
}
