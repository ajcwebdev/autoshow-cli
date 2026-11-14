import { mkdir, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { assertManagedRuntimePath, pathIsPhysicallyWithinRoot, RUNTIME_ROOT_PATH } from './runtime-containment'

const runtimeRoot = RUNTIME_ROOT_PATH

export const RUNTIME_TEMP_DIR = join(runtimeRoot, 'tmp')

const testStateRoot = (): string | undefined => {
  const requested = process.env['AUTOSHOW_TEST_STATE_ROOT']?.trim()
  if (!requested) return undefined
  const candidate = assertManagedRuntimePath(requested)
  assertManagedRuntimePath(RUNTIME_TEMP_DIR)
  if (candidate === resolve(RUNTIME_TEMP_DIR) || !pathIsPhysicallyWithinRoot(RUNTIME_TEMP_DIR, candidate) || !existsSync(candidate)) {
    throw new TypeError('The test state root must be an existing private directory below runtime/tmp/.')
  }
  return candidate
}

const stateRoot = testStateRoot() ?? runtimeRoot
export const RUNTIME_CACHE_DIR = join(stateRoot, 'cache')
export const RUNTIME_STATE_DIR = join(stateRoot, 'state')
export const RUNTIME_LOCK_DIR = join(RUNTIME_STATE_DIR, 'process-locks')
export const RUNTIME_FONTS_DIR = join(runtimeRoot, 'fonts')
export const RUNTIME_FONTCONFIG_DIR = join(RUNTIME_FONTS_DIR, 'fontconfig')
export const RUNTIME_FONT_CACHE_DIR = join(RUNTIME_CACHE_DIR, 'fontconfig')

export const getRuntimeCachePath = (...parts: string[]): string =>
  assertManagedRuntimePath(join(RUNTIME_CACHE_DIR, ...parts))

export const ensureRuntimeDirectory = async (path: string): Promise<void> => {
  const contained = assertManagedRuntimePath(path)
  await mkdir(contained, { recursive: true })
  assertManagedRuntimePath(contained)
}

export const ensureRuntimeStateDirectories = async (): Promise<void> => {
  const directories = [
    RUNTIME_CACHE_DIR,
    RUNTIME_TEMP_DIR,
    RUNTIME_STATE_DIR,
    RUNTIME_LOCK_DIR,
    RUNTIME_FONTS_DIR,
    RUNTIME_FONT_CACHE_DIR
  ]
  for (const path of directories) assertManagedRuntimePath(path)
  for (const path of directories) await ensureRuntimeDirectory(path)
}

export const createRuntimeTempDirectory = async (prefix: string): Promise<string> => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(prefix)) {
    throw new TypeError('Runtime temporary-directory prefixes must be simple names.')
  }
  await ensureRuntimeDirectory(RUNTIME_TEMP_DIR)
  const directory = await mkdtemp(join(RUNTIME_TEMP_DIR, prefix))
  return assertManagedRuntimePath(directory)
}
