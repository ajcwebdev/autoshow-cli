import { lstat, mkdir, open, readlink, rename, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { InfraError } from '~/utils/error-handler'
import { assertDefaultConfigPath } from './config-loader'

const configWriteTarget = async (configPath: string): Promise<string> => {
  let target = resolve(configPath)
  const visited = new Set<string>()
  while (true) {
    if (visited.has(target)) throw InfraError(`Config path contains a symlink cycle: ${configPath}`, { stage: 'config:write' })
    visited.add(target)
    const entry = await lstat(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined
      throw error
    })
    if (!entry?.isSymbolicLink()) return target
    target = resolve(dirname(target), await readlink(target))
  }
}

export type WriteConfigOptions = { managedDefault?: boolean }

export const writeConfig = async (configPath: string, config: Record<string, unknown>, options: WriteConfigOptions = {}): Promise<void> => {
  const text = JSON.stringify(config, null, 2) + '\n'
  let target = resolve(configPath)
  const assertPath = (): void => { if (options.managedDefault) assertDefaultConfigPath(configPath, target) }
  assertPath()
  target = await configWriteTarget(configPath)
  assertPath()
  await mkdir(dirname(target), { recursive: true })
  assertPath()
  const previous = await stat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
  const temporaryPath = `${target}.tmp-${process.pid}-${crypto.randomUUID()}`
  try {
    assertPath()
    const file = await open(temporaryPath, 'wx', previous ? previous.mode & 0o777 : 0o600)
    try {
      await file.writeFile(text)
      if (previous) await file.chmod(previous.mode & 0o777)
      await file.sync()
    } finally {
      await file.close()
    }
    assertPath()
    await rename(temporaryPath, target)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}
