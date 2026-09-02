import { mkdir } from 'node:fs/promises'
import { runCapture, whisperfileBinaryPath, whisperfileDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { pathExists } from '~/utils/filesystem'
import * as l from '~/utils/app-logger/app-logger'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { withRetry } from '~/utils/retries'
import { makeExecutable } from '~/utils/filesystem'
import { InternalError } from '~/utils/error-handler'

const WHISPERFILE_BASE_URL = 'https://huggingface.co/Mozilla/whisperfile/resolve/main'

const artifactFileName = (modelName: string): string => `whisper-${modelName}.llamafile`

const verifyWhisperfileBinary = async (binaryPath: string): Promise<boolean> => {
  const result = await runCapture('sh', [binaryPath, '--help'], { allowFailure: true })
  return result.exitCode === 0
}

export const downloadWhisperfileBinary = async (modelName: string): Promise<void> => {
  await mkdir(whisperfileDir, { recursive: true })

  const destination = whisperfileBinaryPath(modelName)

  if (await pathExists(destination)) {
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
        expectedMinBytes: 1000,
        flowId: 'whisperfile-binary'
      })
    }
  )

  await makeExecutable(destination)

  l.write('info', `Whisperfile model ${modelName} downloaded`, { category: 'command', metadata: { engine: 'whisperfile', model: modelName } })
}

export const setupWhisperfile = async (modelName: string): Promise<void> => {
  await downloadWhisperfileBinary(modelName)

  if (!await verifyWhisperfileBinary(whisperfileBinaryPath(modelName))) {
    l.warn('Whisperfile installation may have issues, but continuing', { category: 'command' })
  }
}

export const ensureWhisperfileReady = async (modelName: string): Promise<void> => {
  if (!modelName) {
    throw InternalError('Model name required', { stage: 'setup:whisperfile' })
  }

  const binaryPath = whisperfileBinaryPath(modelName)

  if (await pathExists(binaryPath)) {
    await makeExecutable(binaryPath)
    if (await verifyWhisperfileBinary(binaryPath)) {
      return
    }
    l.write('info', 'Whisperfile binary found but not working, re-downloading', { category: 'command' })
  }

  await setupWhisperfile(modelName)
}
