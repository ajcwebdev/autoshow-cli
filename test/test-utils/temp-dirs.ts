import { mkdtempSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Creates a temp directory under the OS temp root. This is the one place the suite spells
 * `mkdtemp(join(tmpdir(), …))`; 71 test files previously repeated it across 165 call sites.
 * Cleanup is the caller's responsibility — use `withTempDir` or `createTempDirTracker` when
 * the directory should be removed automatically.
 */
export const makeTempDir = async (prefix: string): Promise<string> =>
  await mkdtemp(join(tmpdir(), prefix))

/** Synchronous sibling of `makeTempDir`, for the few suites that build fixtures eagerly. */
export const makeTempDirSync = (prefix: string): string =>
  mkdtempSync(join(tmpdir(), prefix))

export const withTempDir = async <T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> => {
  const dir = await makeTempDir(prefix)
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export const withLocalTestDir = async <T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> => {
  const dir = join(process.cwd(), '.test-work', `${prefix}-${crypto.randomUUID()}`)
  await mkdir(dir, { recursive: true })
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
    const dir = await makeTempDir(prefix)
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
