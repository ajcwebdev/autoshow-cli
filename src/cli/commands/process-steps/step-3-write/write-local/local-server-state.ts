import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LocalLlmServerResourceOptions } from '~/types'
import { resolveProcessLockRoot } from '~/utils/process-lock'

export type LocalServerStateProfile<T extends { pid: number }> = {
  fileName: string
  parse: (value: Record<string, unknown>) => T | null
}

export const createLocalServerStateStore = <T extends { pid: number }>(
  profile: LocalServerStateProfile<T>
): {
  read: (options?: LocalLlmServerResourceOptions) => Promise<T | null>
  write: (state: T, options?: LocalLlmServerResourceOptions) => Promise<void>
  clear: (expectedPid?: number, options?: LocalLlmServerResourceOptions) => Promise<void>
} => {
  const getPath = (options: LocalLlmServerResourceOptions): string =>
    join(resolveProcessLockRoot(options), profile.fileName)
  const read = async (options: LocalLlmServerResourceOptions = {}): Promise<T | null> => {
    try {
      const parsed = JSON.parse(await readFile(getPath(options), 'utf-8')) as Record<string, unknown>
      return profile.parse(parsed)
    } catch {
      return null
    }
  }

  return {
    read,
    write: async (state, options = {}) => {
      await mkdir(resolveProcessLockRoot(options), { recursive: true })
      await writeFile(getPath(options), JSON.stringify(state, null, 2))
    },
    clear: async (expectedPid, options = {}) => {
      if (expectedPid !== undefined && (await read(options))?.pid !== expectedPid) return
      await rm(getPath(options), { force: true })
    }
  }
}
