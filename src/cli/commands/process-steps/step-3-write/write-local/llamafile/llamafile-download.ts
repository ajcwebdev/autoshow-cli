import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { llamaBinaryPath, pathExists } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { makeExecutable } from '~/utils/filesystem'
import { withRetry } from '~/utils/retries'
import * as l from '~/utils/app-logger/app-logger'
import { CLIUsageError } from '~/utils/error-handler'
import { LLAMAFILE_BUNDLES } from './llamafile-constants'

// Bundles live alongside the managed llama-server binary, under $RUNTIME/bin/llamafile.
// Resolved lazily (not at module top-level) so this module can be statically imported
// by run-complete-setup.ts without a circular import touching `llamaBinaryPath` before
// it is initialized.
const llamafileBundleDir = (): string => join(dirname(llamaBinaryPath), 'llamafile')

export const resolveLlamafileBundlePath = (model: string): string =>
  join(llamafileBundleDir(), `${model}.llamafile`)

export const ensureLlamafileBundleDownloaded = async (model: string): Promise<string> => {
  const url = LLAMAFILE_BUNDLES[model]
  if (!url) {
    throw CLIUsageError(
      `Unknown llamafile model "${model}". Supported bundles: ${Object.keys(LLAMAFILE_BUNDLES).join(', ')}`
    )
  }

  const destination = resolveLlamafileBundlePath(model)
  if (await pathExists(destination)) {
    return destination
  }

  await mkdir(llamafileBundleDir(), { recursive: true })
  l.write('info', `Downloading llamafile bundle: ${model} (this is a multi-GB download)`)

  await withRetry(
    { retryClass: 'setup_download', operationName: 'llamafile-binary' },
    async () => {
      await downloadFile({ url, destination, flowId: 'llamafile-binary' })
    }
  )

  await makeExecutable(destination)
  l.write('success', `llamafile bundle ready: ${model}`)
  return destination
}
