import { mkdir } from 'node:fs/promises'
import { runCapture, whisperfileBinaryPath, whisperfileDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { pathExists } from '~/utils/filesystem'
import * as l from '~/utils/app-logger/app-logger'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { withRetry } from '~/utils/retries'
import { makeExecutable } from '~/utils/filesystem'
import { InternalError, InfraError } from '~/utils/error-handler'

import { WHISPERFILE_ARTIFACTS, WHISPERFILE_REVISION } from './whisperfile-artifacts'
import { verifyWhisperfileArtifact } from './whisperfile-integrity'

const WHISPERFILE_BASE_URL = `https://huggingface.co/Mozilla/whisperfile/resolve/${WHISPERFILE_REVISION}`

const artifactFileName = (modelName: string): string => `whisper-${modelName}.llamafile`

const verifyWhisperfileBinary = async (binaryPath: string): Promise<boolean> => {
  const result = await runCapture('sh', [binaryPath, '--help'], { allowFailure: true })
  return result.exitCode === 0
}

export const downloadWhisperfileBinary = async (modelName: string): Promise<void> => {
  const artifact = Object.hasOwn(WHISPERFILE_ARTIFACTS, modelName) ? WHISPERFILE_ARTIFACTS[modelName] : undefined
  if (!artifact) throw InfraError(`No pinned whisperfile artifact for model: ${modelName}`, { stage: 'setup:whisperfile' })
  await mkdir(whisperfileDir, { recursive: true })

  const destination = whisperfileBinaryPath(modelName)

  if (await pathExists(destination)) {
    await verifyWhisperfileArtifact(destination, artifact)
    await makeExecutable(destination)
    return
  }

  l.write('info', `Downloading whisperfile model: ${modelName}`, { category: 'command', metadata: { engine: 'whisperfile', model: modelName } })

  const url = `${WHISPERFILE_BASE_URL}/${artifactFileName(modelName)}`

  await withRetry(
    { retryClass: 'setup_download', operationName: `whisperfile-${modelName}` },
    async () => {
      await downloadFile({
        url,
        destination,
        expectedMinBytes: artifact.size,
        sha256: artifact.sha256,
        flowId: 'whisperfile-binary'
      })
    }
  )

  await verifyWhisperfileArtifact(destination, artifact)
  await makeExecutable(destination)

  l.write('info', `Whisperfile model ${modelName} downloaded`, { category: 'command', metadata: { engine: 'whisperfile', model: modelName } })
}

export const setupWhisperfile = async (modelName: string): Promise<void> => {
  await downloadWhisperfileBinary(modelName)

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
