import * as l from '~/utils/app-logger/app-logger'
import { withProcessLock } from '~/utils/process-lock'
import { InfraError } from '~/utils/error-handler'
import {
  getLlamaServerStartTimeoutMs,
  resolveLlamaServerBinary
} from './llama-config'
import {
  LLAMA_PROCESS_LOCK_NAME,
  LLAMA_SERVER_STDERR_TAIL_LIMIT
} from './llama-constants'
import {
  throwIfServerStartupFailed,
  watchLlamaServerStderr
} from './llama-download-progress'
import {
  describeLlamaServerIdentity,
  inspectRunningLlamaServer
} from './llama-server-identity'
import {
  checkLlamaHealthQuiet,
  stopRecordedLlamaServerIfPresent,
  stopRunningLlamaServerForRestart,
  stopSpawnedLlamaServer,
  waitForLlamaHealth
} from './llama-server-process'
import { hasSetupManagedLlamaModel, recordSetupManagedLlamaModel } from './llama-model-metadata'
import { hasCachedLlamaModelWeights } from './llama-model-cache'

const ensureLlamaModelDownloadedUnlocked = async (model: string): Promise<void> => {
  const llamaServerPath = resolveLlamaServerBinary()

  const modelRepo = model

  // Without this, a re-run of setup stops a llama-server the user may be using
  // and pays a full boot plus health wait only to confirm a warm cache. Both the
  // marker and the weights must be present: either alone can be stale.
  if (await hasSetupManagedLlamaModel(model) && await hasCachedLlamaModelWeights(model)) {
    l.write('info', `llama model already downloaded: ${modelRepo}`)
    return
  }

  l.write('info', `Downloading llama model: ${modelRepo}`)

  if (await checkLlamaHealthQuiet()) {
    const identity = await inspectRunningLlamaServer()
    if (!identity) {
      throw InfraError('A healthy service is already running on localhost:8080, but it could not be verified as llama.cpp.', { stage: 'write:llama-download' })
    }

    l.write('info', `Stopping llama-server before model download (${describeLlamaServerIdentity(identity)})`)
    await stopRunningLlamaServerForRestart()
  } else if (await stopRecordedLlamaServerIfPresent()) {
    l.write('info', 'Stopped stale recorded llama-server before model download')
  }

  const proc = Bun.spawn([llamaServerPath, '-hf', modelRepo, '--host', '127.0.0.1', '--port', '8080', '--jinja'], {
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'pipe'
  })

  const stderrWatch = watchLlamaServerStderr(proc.stderr, LLAMA_SERVER_STDERR_TAIL_LIMIT)
  proc.unref()

  const startTimeoutMs = getLlamaServerStartTimeoutMs()
  const healthResult = await waitForLlamaHealth(startTimeoutMs, proc)
  stderrWatch.stop()

  await stopSpawnedLlamaServer(proc)

  throwIfServerStartupFailed(healthResult, stderrWatch.getTail(), startTimeoutMs, {
    serverLabel: 'llama-server',
    stderrLabel: 'llama-server',
    stage: 'write:llama-download'
  })

  await recordSetupManagedLlamaModel(model)
  l.write('success', `Model downloaded and ready: ${modelRepo}`)
}

export const ensureLlamaModelDownloaded = async (model: string): Promise<void> =>
  await withProcessLock(LLAMA_PROCESS_LOCK_NAME, async () => await ensureLlamaModelDownloadedUnlocked(model))
