import { link, rename, rm } from 'node:fs/promises'
import { runCapture, whisperfileBinaryPath, whisperfileDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { pathExists } from '~/utils/filesystem'
import * as l from '~/utils/app-logger/app-logger'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { withRetry } from '~/utils/retries'
import { makeExecutable } from '~/utils/filesystem'
import { InternalError, InfraError } from '~/utils/error-handler'
import { withProcessLock } from '~/utils/process-lock'
import { assertManagedRuntimePath } from '~/utils/runtime-containment'
import { ensureRuntimeDirectory } from '~/utils/runtime-state'

import { WHISPERFILE_ARTIFACTS, WHISPERFILE_REVISION } from './whisperfile-artifacts'
import { verifyWhisperfileArtifact } from './whisperfile-integrity'

const WHISPERFILE_BASE_URL = `https://huggingface.co/Mozilla/whisperfile/resolve/${WHISPERFILE_REVISION}`

const artifactFileName = (modelName: string): string => `whisper-${modelName}.llamafile`

const verifyWhisperfileBinary = async (binaryPath: string): Promise<boolean> => {
  const result = await runCapture('/bin/sh', [assertManagedRuntimePath(binaryPath), '--help'], { allowFailure: true })
  return result.exitCode === 0
}

export const downloadWhisperfileBinary = async (modelName: string, options: { forceRedownload?: boolean } = {}): Promise<void> => withProcessLock(`setup-whisperfile-${modelName}`, async () => {
  const artifact = Object.hasOwn(WHISPERFILE_ARTIFACTS, modelName) ? WHISPERFILE_ARTIFACTS[modelName] : undefined
  if (!artifact) throw InfraError(`No pinned whisperfile artifact for model: ${modelName}`, { stage: 'setup:whisperfile' })
  await ensureRuntimeDirectory(whisperfileDir)

  const destination = assertManagedRuntimePath(whisperfileBinaryPath(modelName))

  if (!options.forceRedownload && await pathExists(destination)) {
    try {
      await verifyWhisperfileArtifact(destination, artifact)
      await makeExecutable(assertManagedRuntimePath(destination))
      return
    } catch (error) {
      l.warn(`Repairing invalid Whisperfile model ${modelName}`, { category: 'command', error })
    }
  }

  l.write('info', `Downloading whisperfile model: ${modelName}`, { category: 'command', metadata: { engine: 'whisperfile', model: modelName } })

  const url = `${WHISPERFILE_BASE_URL}/${artifactFileName(modelName)}`
  const candidate = assertManagedRuntimePath(`${destination}.download`)

  await withRetry(
    { retryClass: 'setup_download', operationName: `whisperfile-${modelName}` },
    async () => {
      await downloadFile({
        url,
        destination: assertManagedRuntimePath(candidate),
        expectedMinBytes: artifact.size,
        sha256: artifact.sha256,
        flowId: 'whisperfile-binary'
      })
    }
  )

  await verifyWhisperfileArtifact(candidate, artifact)
  await makeExecutable(assertManagedRuntimePath(candidate))
  if (!await verifyWhisperfileBinary(candidate)) throw InfraError('Downloaded Whisperfile failed its executable health check', { stage: 'setup:whisperfile' })
  const backup = assertManagedRuntimePath(`${destination}.backup-${crypto.randomUUID()}`)
  const hadPrevious = await pathExists(destination)
  let promoted = false
  try {
    if (hadPrevious) await link(assertManagedRuntimePath(destination), assertManagedRuntimePath(backup))
    await rename(assertManagedRuntimePath(candidate), assertManagedRuntimePath(destination))
    promoted = true
    if (!await verifyWhisperfileBinary(destination)) throw InfraError('Activated Whisperfile failed its executable health check', { stage: 'setup:whisperfile' })
  } catch (error) {
    if (promoted && hadPrevious) await link(assertManagedRuntimePath(destination), assertManagedRuntimePath(candidate)).catch(() => {})
    else if (promoted) await rename(assertManagedRuntimePath(destination), assertManagedRuntimePath(candidate))
    if (hadPrevious && await pathExists(backup)) {
      if (promoted) await rename(assertManagedRuntimePath(backup), assertManagedRuntimePath(destination))
      else await rm(assertManagedRuntimePath(backup), { force: true })
    }
    throw error
  }
  if (hadPrevious) await rm(assertManagedRuntimePath(backup), { force: true })

  l.write('info', `Whisperfile model ${modelName} downloaded`, { category: 'command', metadata: { engine: 'whisperfile', model: modelName } })
})

export const setupWhisperfile = async (modelName: string, options: { forceRedownload?: boolean } = {}): Promise<void> => {
  await downloadWhisperfileBinary(modelName, options)

  if (!await verifyWhisperfileBinary(whisperfileBinaryPath(modelName))) {
    throw InfraError('Verified Whisperfile failed its executable health check', { stage: 'setup:whisperfile' })
  }
}

export const ensureWhisperfileReady = async (modelName: string): Promise<void> => {
  if (!modelName) {
    throw InternalError('Model name required', { stage: 'setup:whisperfile' })
  }

  await setupWhisperfile(modelName)
}
