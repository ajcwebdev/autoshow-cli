import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { readDependencyTag } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { pathExists, detectArchitecture, detectPlatform, llamaBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { withRetry } from '~/utils/retries'
import { makeExecutable } from '~/utils/filesystem'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InternalError } from '~/utils/error-handler'

const shouldPrintCompletion = (): boolean => !isCompactSetupMode()

// Reads the same metadata the Pinned Versions table reports. The previous
// hand-rolled read resolved to a path that has never existed, so it always fell
// through to the hardcoded default while the table advertised the pinned tag.
const readLlamaTag = async (): Promise<string> =>
  await readDependencyTag('llama.cpp') ?? 'b8087'

export const checkLlamaInstalled = async (): Promise<boolean> => {
  return await pathExists(llamaBinaryPath)
}

const installLlama = async (): Promise<void> => {
  l.write('info', 'Installing llama.cpp')
  const platform = detectPlatform()
  const arch = detectArchitecture()
  const tag = await readLlamaTag()

  await mkdir(dirname(llamaBinaryPath), { recursive: true })

  const releaseBase = `https://github.com/ggml-org/llama.cpp/releases/download/${tag}`

  let tarballName: string

  if (platform === 'darwin') {
    tarballName = (arch === 'aarch64' || arch === 'arm64')
      ? `llama-${tag}-bin-macos-arm64.tar.gz`
      : `llama-${tag}-bin-macos-x64.tar.gz`
  } else if (platform === 'linux') {
    if (arch === 'x86_64') {
      tarballName = `llama-${tag}-bin-ubuntu-x64.tar.gz`
    } else if (arch === 'aarch64' || arch === 'arm64') {

      l.error(`No pre-built llama-server tarball for linux/${arch} in llama.cpp releases`)
      throw InternalError(`Unsupported architecture for llama setup: linux/${arch}`, { stage: 'setup:llama' })
    } else {
      l.error(`Unsupported architecture: ${arch}`)
      throw InternalError(`Unsupported architecture for llama setup: ${arch}`, { stage: 'setup:llama' })
    }
  } else {
    l.error('Unsupported platform for automatic llama.cpp installation')
    throw InternalError('Unsupported platform for llama setup', { stage: 'setup:llama' })
  }

  const tarballUrl = `${releaseBase}/${tarballName}`

  const binDir = dirname(llamaBinaryPath)

  await withRetry(
    { retryClass: 'setup_download', operationName: 'llama-tarball' },
    async () => {
      await downloadFile({
        url: tarballUrl,
        destination: binDir,
        mode: 'tar-gz',
        stripComponents: 1,
        flowId: 'llama-tarball'
      })
    }
  )

  await makeExecutable(llamaBinaryPath)
  l.write('success', 'llama.cpp installed')
}

const setupLlama = async (): Promise<void> => {
  if (!await checkLlamaInstalled()) {
    await installLlama()
  } else {
  }
}

export const runLlamaSetup = async (): Promise<void> => {
  await setupLlama()

  if (shouldPrintCompletion()) {
    l.write('success', 'llama.cpp setup complete')
  }
}
