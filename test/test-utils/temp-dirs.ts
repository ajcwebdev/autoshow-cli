import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const withTempDir = async <T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export const createTempDirTracker = (
  defaultPrefix: string
): {
  make: (prefix?: string) => Promise<string>
  withDir: <T>(fn: (dir: string) => Promise<T>, prefix?: string) => Promise<T>
  cleanup: () => Promise<void>
} => {
  const tempDirs: string[] = []

  const make = async (prefix = defaultPrefix): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    tempDirs.push(dir)
    return dir
  }

  return {
    make,
    withDir: async <T>(fn: (dir: string) => Promise<T>, prefix?: string): Promise<T> =>
      await fn(await make(prefix)),
    cleanup: async (): Promise<void> => {
      await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
    }
  }
}
