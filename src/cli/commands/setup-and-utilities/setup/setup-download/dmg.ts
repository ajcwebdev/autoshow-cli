import { cp, mkdir, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { downloadFile } from './download'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import type { InstallDmgAppOptions } from '~/types'
import { createRuntimeTempDirectory, getRuntimeCachePath } from '~/utils/runtime-state'
import { createManagedToolStagingDirectory, promoteManagedToolDirectory } from './managed-artifact'
import { collectManagedSourcePayload } from './managed-artifact-payload'
import { sha256File } from './managed-source-artifact'
import { pathExists } from '~/utils/filesystem'
import * as l from '~/utils/app-logger/app-logger'
import { assertRuntimeContainedPath, toProjectDisplayPath } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'

export const copyManagedApplicationBundle = async (source: string, destination: string): Promise<void> => {
  assertRuntimeContainedPath(destination)
  if (process.platform === 'darwin') {
    // Non-Mach-O code signatures can live in extended attributes. Preserve the
    // signed application metadata and original relative links with Apple's
    // bundle-aware copier; ordinary file copies omit those signatures.
    const result = await runCapture('/usr/bin/ditto', ['--rsrc', '--extattr', '--acl', source, destination], { allowFailure: true })
    if (result.exitCode !== 0) throw InfraError(`Managed application metadata copy failed: ${result.stderr.trim() || result.stdout.trim()}`, { stage: 'setup:calibre' })
  } else await cp(source, destination, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true })
}

export const installDmgApp = async (options: InstallDmgAppOptions): Promise<void> => {
  const tempRoot = await createRuntimeTempDirectory('autoshow-dmg-')
  const mountPoint = join(tempRoot, 'mount')
  const dmgPath = getRuntimeCachePath('downloads', `${options.sha256}-${basename(new URL(options.url).pathname)}`)
  let attached = false

  try {
    await mkdir(mountPoint, { recursive: true })
    assertRuntimeContainedPath(dmgPath)
    const cached = !options.forceRedownload && await pathExists(dmgPath) && await sha256File(dmgPath) === options.sha256
    if (!cached) await downloadFile({
      url: options.url,
      destination: dmgPath,
      sha256: options.sha256,
      flowId: 'calibre-dmg'
    })
    await runCapture('/usr/bin/hdiutil', ['attach', dmgPath, '-mountpoint', mountPoint, '-nobrowse', '-readonly', '-quiet'])
    attached = true

    const sourceAppPath = join(mountPoint, options.appName)
    await mkdir(dirname(options.destinationAppPath), { recursive: true })
    const stagingDir = await createManagedToolStagingDirectory(options.destinationAppPath)
    const stagedAppPath = join(stagingDir, options.appName)
    let committed = false
    try {
      await copyManagedApplicationBundle(sourceAppPath, stagedAppPath)
      await promoteManagedToolDirectory({
        stagingDir: stagedAppPath,
        destinationDir: options.destinationAppPath,
        validateStaging: async appPath => {
          // Inventory inspection rejects links escaping the copied application.
          await collectManagedSourcePayload(appPath)
          await options.validateApp?.(appPath)
        }
      })
      committed = true
    } catch (error) {
      l.warn('Managed application staging was preserved after failure', { category: 'artifact', metadata: { stagingDir: toProjectDisplayPath(stagingDir) } })
      throw error
    } finally { if (committed) await rm(stagingDir, { recursive: true, force: true }) }
  } finally {
    if (attached) {
      await runCapture('/usr/bin/hdiutil', ['detach', mountPoint, '-quiet']).catch(() => undefined)
    }
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}
