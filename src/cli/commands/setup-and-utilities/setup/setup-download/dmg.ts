import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { downloadFile } from './download'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import type { InstallDmgAppOptions } from '~/types'

export const installDmgApp = async (options: InstallDmgAppOptions): Promise<void> => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-dmg-'))
  const mountPoint = join(tempRoot, 'mount')
  const dmgPath = join(tempRoot, basename(options.url))
  let attached = false

  try {
    await mkdir(mountPoint, { recursive: true })
    await downloadFile({
      url: options.url,
      destination: dmgPath,
      sha256: options.sha256,
      flowId: 'calibre-dmg'
    })
    await runCapture('hdiutil', ['attach', dmgPath, '-mountpoint', mountPoint, '-nobrowse', '-readonly', '-quiet'])
    attached = true

    const sourceAppPath = join(mountPoint, options.appName)
    await rm(options.destinationAppPath, { recursive: true, force: true })
    await mkdir(dirname(options.destinationAppPath), { recursive: true })
    await cp(sourceAppPath, options.destinationAppPath, { recursive: true })
  } finally {
    if (attached) {
      await runCapture('hdiutil', ['detach', mountPoint, '-quiet']).catch(() => undefined)
    }
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}
