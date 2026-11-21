import { hasErrorCode } from '~/utils/error-handler'
import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { withProcessLock } from '~/utils/process-lock'
import { readTextFile, statPath as stat, writeFileExact } from '~/utils/bun-file-io'
import type { FileFingerprint } from '~/types'
import { RUNTIME_LOCK_DIR } from '~/utils/runtime-state'
import { assertManagedRuntimePath, pathIsWithinRoot, RUNTIME_ROOT_PATH } from './runtime-containment'

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
  } catch (error) {
    // Expected miss: path absent. Propagate permission/I/O so callers can diagnose.
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR') || hasErrorCode(error, 'ENAMETOOLONG')) {
      return undefined
    }
    throw error
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
  } catch (error) {
    // Absent cache file → empty map (expected miss). Corrupt JSON / I/O → empty map but only for
    // parse errors and absence; permission failures propagate.
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR') || hasErrorCode(error, 'ENAMETOOLONG')) {
      return {}
    }
    if (error instanceof SyntaxError) {
      return {}
    }
    throw error
  }
}

export const writeJsonCacheEntry = async <T>(options: {
  cachePath: string
  lockName: string
  key: string
  value: T
}): Promise<void> => {
  const lockRoot = join(RUNTIME_LOCK_DIR, 'file-cache')
  const validateCachePath = (): void => {
    if (pathIsWithinRoot(RUNTIME_ROOT_PATH, options.cachePath)) assertManagedRuntimePath(options.cachePath)
    assertManagedRuntimePath(lockRoot)
  }
  validateCachePath()

  await withProcessLock(options.lockName, async () => {
    validateCachePath()
    const cache = await readJsonCacheMap<T>(options.cachePath)
    cache[options.key] = options.value
    await mkdir(dirname(options.cachePath), { recursive: true })
    validateCachePath()

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
