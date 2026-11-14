import { join } from 'node:path'
import { PROJECT_ROOT } from './project-root'
import { assertManagedRuntimePath, pathIsPhysicallyWithinRoot, pathIsWithinRoot } from './runtime-containment'
import {
  RUNTIME_CACHE_DIR,
  RUNTIME_FONTCONFIG_DIR,
  RUNTIME_FONT_CACHE_DIR,
  RUNTIME_STATE_DIR,
  RUNTIME_TEMP_DIR
} from './runtime-state'

export const TEMP_DIRECTORY_ENV_KEYS = ['TMPDIR', 'TMP', 'TEMP'] as const

export const DEFAULT_CHILD_ENV_KEYS = [
  'PATH',
  'HOME',
  'AUTOSHOW_TEST_STATE_ROOT',
  ...TEMP_DIRECTORY_ENV_KEYS,
  'FORCE_COLOR',
  'NO_COLOR'
] as const

export type ChildEnvOptions = {
  allow?: readonly string[] | undefined
  set?: Readonly<Record<string, string | undefined>> | undefined
  source?: Readonly<Record<string, string | undefined>> | undefined
}

export const MANAGED_CHILD_PATH = [
  join(PROJECT_ROOT, 'runtime/bin'),
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin'
].join(':')

const containedTemporaryDirectory = (source: Readonly<Record<string, string | undefined>>): string => {
  assertManagedRuntimePath(RUNTIME_TEMP_DIR)
  const candidate = source['TMPDIR']?.trim()
  if (!candidate) return RUNTIME_TEMP_DIR
  if (!pathIsWithinRoot(RUNTIME_TEMP_DIR, candidate)) return RUNTIME_TEMP_DIR
  assertManagedRuntimePath(candidate)
  if (!pathIsPhysicallyWithinRoot(RUNTIME_TEMP_DIR, candidate)) {
    throw new TypeError('Managed temporary paths must resolve inside runtime/tmp/.')
  }
  return candidate
}

export const childEnv = (options: ChildEnvOptions = {}): Record<string, string> => {
  const source = options.source ?? process.env
  const result: Record<string, string> = {}
  for (const key of [...DEFAULT_CHILD_ENV_KEYS, ...(options.allow ?? [])]) {
    const value = source[key]
    if (typeof value === 'string') result[key] = value
  }
  const temporaryDirectory = containedTemporaryDirectory(source)
  Object.assign(result, {
    PATH: MANAGED_CHILD_PATH,
    TMPDIR: temporaryDirectory,
    TMP: temporaryDirectory,
    TEMP: temporaryDirectory,
    XDG_CACHE_HOME: RUNTIME_CACHE_DIR,
    XDG_CONFIG_HOME: join(RUNTIME_STATE_DIR, 'config'),
    XDG_DATA_HOME: join(RUNTIME_STATE_DIR, 'data'),
    BUN_INSTALL_CACHE_DIR: join(RUNTIME_CACHE_DIR, 'bun'),
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: join(RUNTIME_CACHE_DIR, 'bun-transpiler'),
    CALIBRE_CACHE_DIRECTORY: join(RUNTIME_CACHE_DIR, 'calibre'),
    CALIBRE_CONFIG_DIRECTORY: join(RUNTIME_STATE_DIR, 'calibre'),
    DENO_DIR: join(RUNTIME_CACHE_DIR, 'deno'),
    PYTHONNOUSERSITE: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONPYCACHEPREFIX: join(RUNTIME_CACHE_DIR, 'python'),
    // POSIX native initialization otherwise creates a host-side telemetry database.
    ORT_DISABLE_TELEMETRY: '1',
    FONTCONFIG_PATH: RUNTIME_FONTCONFIG_DIR,
    FONTCONFIG_FILE: join(RUNTIME_FONTCONFIG_DIR, 'fonts.conf'),
    FONTCONFIG_CACHE: RUNTIME_FONT_CACHE_DIR,
    PANGOCAIRO_BACKEND: 'fontconfig',
    MAGICK_HOME: join(PROJECT_ROOT, 'runtime/tools/native/imagemagick'),
    MAGICK_CONFIGURE_PATH: join(PROJECT_ROOT, 'runtime/tools/native/imagemagick/etc/ImageMagick-7'),
    MAGICK_TEMPORARY_PATH: temporaryDirectory
  })
  for (const key of ['XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'BUN_INSTALL_CACHE_DIR', 'BUN_RUNTIME_TRANSPILER_CACHE_PATH', 'CALIBRE_CACHE_DIRECTORY', 'CALIBRE_CONFIG_DIRECTORY', 'DENO_DIR', 'PYTHONPYCACHEPREFIX', 'FONTCONFIG_PATH', 'FONTCONFIG_FILE', 'FONTCONFIG_CACHE', 'MAGICK_HOME', 'MAGICK_CONFIGURE_PATH']) {
    assertManagedRuntimePath(result[key]!)
  }
  assertManagedRuntimePath(join(PROJECT_ROOT, 'runtime/bin'))
  for (const [key, value] of Object.entries(options.set ?? {})) {
    if (typeof value === 'string') result[key] = value
    else delete result[key]
  }
  return result
}
