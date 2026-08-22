import { rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withProcessLock } from '~/utils/process-lock'
import { readTextFile, statPath as stat, writeFileExact } from '~/utils/bun-file-io'
import type { FileFingerprint } from '~/types'

export const getFileFingerprint = async (filePath: string): Promise<FileFingerprint | undefined> => {
  try {
    const stats = await stat(filePath)
    return {
      dev: stats.dev,
      ino: stats.ino,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
      size: stats.size
    }
  } catch {
    return undefined
  }
}

export const fileFingerprintsMatch = (
  left: FileFingerprint | undefined,
  right: FileFingerprint | undefined
): boolean =>
  left !== undefined &&
  right !== undefined &&
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs &&
  left.size === right.size

export const readJsonCacheMap = async <T>(cachePath: string): Promise<Record<string, T>> => {
  try {
    const parsed = JSON.parse(await readTextFile(cachePath)) as unknown
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, T>
      : {}
  } catch {
    return {}
  }
}

export const writeJsonCacheEntry = async <T>(options: {
  cachePath: string
  lockName: string
  key: string
  value: T
}): Promise<void> => {
  const lockRoot = join(tmpdir(), 'autoshow-cache-locks')

  await withProcessLock(options.lockName, async () => {
    const cache = await readJsonCacheMap<T>(options.cachePath)
    cache[options.key] = options.value

    const tempPath = `${options.cachePath}.${process.pid}.${crypto.randomUUID()}.tmp`
    try {
      await writeFileExact(tempPath, JSON.stringify(cache, null, 2), { mode: 0o600 })
      await rename(tempPath, options.cachePath)
    } finally {
      await rm(tempPath, { force: true })
    }
  }, {
    lockRoot,
    waitMs: 5
  })
}
