import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { downloadFile } from './download'
import { InfraError } from '~/utils/error-handler'
import type { InstallDmgAppOptions } from '~/types'

const runCommand = async (command: string, args: string[]): Promise<string> => {
  const proc = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(''),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(''),
    proc.exited
  ])
  if (exitCode !== 0) {
    throw InfraError(`${command} failed with exit code ${exitCode}: ${stderr.trim() || stdout.trim()}`, { stage: 'setup:dmg' })
  }
  return stdout
}

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
    await runCommand('hdiutil', ['attach', dmgPath, '-mountpoint', mountPoint, '-nobrowse', '-readonly', '-quiet'])
    attached = true

    const sourceAppPath = join(mountPoint, options.appName)
    await rm(options.destinationAppPath, { recursive: true, force: true })
    await mkdir(dirname(options.destinationAppPath), { recursive: true })
    await cp(sourceAppPath, options.destinationAppPath, { recursive: true })
  } finally {
    if (attached) {
      await runCommand('hdiutil', ['detach', mountPoint, '-quiet']).catch(() => undefined)
    }
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}
