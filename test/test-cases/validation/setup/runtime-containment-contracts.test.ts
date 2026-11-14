import { expect, test } from 'bun:test'
import { chmod, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { childEnv, MANAGED_CHILD_PATH } from '~/utils/child-env'
import {
  assertRuntimeContainedPath,
  RUNTIME_DIR,
  resolveRuntimeToolInfo
} from '~/utils/runtime-paths'
import {
  createRuntimeTempDirectory,
  getRuntimeCachePath,
  RUNTIME_CACHE_DIR,
  RUNTIME_LOCK_DIR,
  RUNTIME_STATE_DIR,
  RUNTIME_TEMP_DIR
} from '~/utils/runtime-state'
import { withProcessLock } from '~/utils/process-lock'

test('managed resolution never consults an ambient executable on any platform', () => {
  let globalLookups = 0
  for (const platform of ['darwin', 'linux', 'win32'] as const) {
    expect(resolveRuntimeToolInfo('ffmpeg', {
      platform,
      exists: () => false,
      which: () => { globalLookups += 1; return '/external/tools/ffmpeg' }
    })).toBeUndefined()
  }
  expect(globalLookups).toBe(0)
})

test('a contained override dispatches its real executable with the managed child environment', async () => {
  const directory = await createRuntimeTempDirectory('managed-dispatch-')
  try {
    const binary = join(directory, 'ffmpeg')
    await writeFile(binary, '#!/bin/sh\nprintf "%s\\n" "$XDG_CACHE_HOME" "$TMPDIR"\n')
    await chmod(binary, 0o755)
    const resolved = resolveRuntimeToolInfo('ffmpeg', { overrideBinDir: directory })
    expect(resolved).toEqual({ id: 'ffmpeg', path: binary, source: 'override' })
    const proc = Bun.spawn([resolved!.path], { env: childEnv(), stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited
    ])
    expect(exitCode).toBe(0)
    expect(stderr).toBe('')
    expect(stdout.split('\n')[0]).toBe(RUNTIME_CACHE_DIR)
    expect(relative(RUNTIME_TEMP_DIR, stdout.split('\n')[1]!)).not.toStartWith('..')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('tool overrides reject external directories and executable or parent symlink escapes', async () => {
  expect(() => resolveRuntimeToolInfo('ffmpeg', { overrideBinDir: '/external/tools', exists: () => true })).toThrow('inside the project runtime directory')
  const directory = await createRuntimeTempDirectory('managed-escape-')
  try {
    const binary = join(directory, 'ffmpeg')
    await symlink('/usr/bin/true', binary)
    expect(() => resolveRuntimeToolInfo('ffmpeg', { overrideBinDir: directory })).toThrow('inside the project runtime directory')
    const external = join(directory, 'external')
    await symlink('/usr/bin', external)
    expect(() => assertRuntimeContainedPath(join(external, 'missing-tool'))).toThrow('inside the project runtime directory')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('child tools receive private runtime caches and temporary storage without ambient credentials', () => {
  const source = { PATH: '/external/tools', HOME: '/users/example', TMPDIR: '/external/tmp', OPENAI_API_KEY: 'sentinel', ORT_DISABLE_TELEMETRY: '0', PYTHONPATH: '/external/python', PYTHONUSERBASE: '/external/python-user-base', PYTHONNOUSERSITE: '0', PYTHONDONTWRITEBYTECODE: '0', BUN_RUNTIME_TRANSPILER_CACHE_PATH: '/external/bun-transpiler' }
  const env = childEnv({ source })
  expect(env['PATH']).toBe(MANAGED_CHILD_PATH)
  expect(env['HOME']).toBe(source.HOME)
  expect(env['TMPDIR']).toBe(RUNTIME_TEMP_DIR)
  expect(env['TMP']).toBe(RUNTIME_TEMP_DIR)
  expect(env['TEMP']).toBe(RUNTIME_TEMP_DIR)
  expect(env['XDG_CACHE_HOME']).toBe(RUNTIME_CACHE_DIR)
  expect(env['BUN_INSTALL_CACHE_DIR']).toBe(getRuntimeCachePath('bun'))
  expect(env['BUN_RUNTIME_TRANSPILER_CACHE_PATH']).toBe(getRuntimeCachePath('bun-transpiler'))
  expect(env['DENO_DIR']).toBe(getRuntimeCachePath('deno'))
  expect(env['CALIBRE_CACHE_DIRECTORY']).toBe(getRuntimeCachePath('calibre'))
  expect(env['CALIBRE_CONFIG_DIRECTORY']).toBe(join(RUNTIME_STATE_DIR, 'calibre'))
  expect(env['ORT_DISABLE_TELEMETRY']).toBe('1')
  expect(env['PYTHONNOUSERSITE']).toBe('1')
  expect(env['PYTHONDONTWRITEBYTECODE']).toBe('1')
  expect(env['PYTHONPYCACHEPREFIX']).toBe(getRuntimeCachePath('python'))
  expect(env).not.toHaveProperty('PYTHONPATH')
  expect(env).not.toHaveProperty('PYTHONUSERBASE')
  const explicit = childEnv({ source, set: { PYTHONNOUSERSITE: '0', PYTHONPYCACHEPREFIX: undefined } })
  expect(explicit['PYTHONNOUSERSITE']).toBe('0')
  expect(explicit).not.toHaveProperty('PYTHONPYCACHEPREFIX')
  expect(env).not.toHaveProperty('OPENAI_API_KEY')
  expect(relative(RUNTIME_DIR, env['FONTCONFIG_FILE']!)).not.toStartWith('..')
  expect(relative(RUNTIME_DIR, env['MAGICK_CONFIGURE_PATH']!)).not.toStartWith('..')
})

test('runtime temporary storage preserves a contained worker root and rejects unsafe workspace prefixes', async () => {
  const directory = await createRuntimeTempDirectory('managed-worker-')
  try {
    expect(childEnv({ source: { TMPDIR: directory } })['TMPDIR']).toBe(directory)
    await expect(createRuntimeTempDirectory('../outside')).rejects.toThrow('simple names')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('default process locks retain owner metadata in runtime state and release only their own lock', async () => {
  const lockName = `managed-state-${crypto.randomUUID()}`
  const lockDir = join(RUNTIME_LOCK_DIR, lockName)
  await mkdir(RUNTIME_LOCK_DIR, { recursive: true })
  await withProcessLock(lockName, async () => {
    const owner = await Bun.file(join(lockDir, 'owner.json')).json()
    expect(owner.lockName).toBe(lockName)
    expect(owner.pid).toBe(process.pid)
    expect(typeof owner.ownerId).toBe('string')
  })
  expect(await Bun.file(join(lockDir, 'owner.json')).exists()).toBe(false)
})

const runIsolatedRuntimeProbe = async (
  projectRoot: string,
  operation: string,
  temporaryDirectory?: string
): Promise<{ ok: boolean, error?: string }> => {
  const code = `try { ${operation}; process.stdout.write(JSON.stringify({ ok: true })) } catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })) }`
  const proc = Bun.spawn([process.execPath, '--no-env-file', '-e', code], {
    env: childEnv({ set: {
      AUTOSHOW_PROJECT_ROOT: projectRoot,
      AUTOSHOW_TEST_STATE_ROOT: undefined,
      ...(temporaryDirectory ? { TMPDIR: temporaryDirectory, TMP: temporaryDirectory, TEMP: temporaryDirectory } : {})
    } }),
    stdout: 'pipe', stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited
  ])
  expect(exitCode).toBe(0)
  expect(stderr).toBe('')
  return JSON.parse(stdout)
}

const withRuntimeEscapeFixture = async (
  fn: (projectRoot: string, outside: string) => Promise<void>
): Promise<void> => {
  const root = await createRuntimeTempDirectory('runtime-physical-fixture-')
  const projectRoot = join(root, 'project')
  const outside = join(root, 'external')
  await mkdir(join(projectRoot, 'runtime'), { recursive: true })
  await mkdir(outside)
  await writeFile(join(outside, 'sentinel.txt'), 'preserve-external-bytes\n')
  try { await fn(projectRoot, outside) } finally { await rm(root, { recursive: true, force: true }) }
}

for (const directory of ['tmp', 'cache', 'state'] as const) {
  test(`runtime directory preparation rejects an external ${directory} symlink before creating descendants`, async () => {
    await withRuntimeEscapeFixture(async (projectRoot, outside) => {
      await symlink(outside, join(projectRoot, 'runtime', directory))
      const result = await runIsolatedRuntimeProbe(projectRoot, 'const state = await import("./src/utils/runtime-state.ts"); await state.ensureRuntimeStateDirectories()')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('inside the project runtime directory')
      const environment = await runIsolatedRuntimeProbe(projectRoot, 'const { childEnv } = await import("./src/utils/child-env.ts"); childEnv({ source: {} })')
      expect(environment.ok).toBe(false)
      expect(environment.error).toContain('inside the project runtime directory')
      expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
      expect((await readdir(outside)).filter(name => name !== '.DS_Store')).toEqual(['sentinel.txt'])
    })
  })
}

test('temporary workspace creation rejects external and dangling parent symlinks without changing external storage', async () => {
  await withRuntimeEscapeFixture(async (projectRoot, outside) => {
    const tmp = join(projectRoot, 'runtime/tmp')
    await symlink(outside, tmp)
    const operation = 'const state = await import("./src/utils/runtime-state.ts"); await state.createRuntimeTempDirectory("probe-")'
    expect((await runIsolatedRuntimeProbe(projectRoot, operation)).ok).toBe(false)
    await rm(tmp)
    await symlink(join(outside, 'missing-target'), tmp)
    expect((await runIsolatedRuntimeProbe(projectRoot, operation)).ok).toBe(false)
    expect((await readdir(outside)).filter(name => name !== '.DS_Store')).toEqual(['sentinel.txt'])
    expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
  })
})

test('nested build and download directory preparation rejects physical escapes before mkdir writes', async () => {
  await withRuntimeEscapeFixture(async (projectRoot, outside) => {
    const runtime = join(projectRoot, 'runtime')
    await mkdir(join(runtime, 'cache/downloads'), { recursive: true })
    await mkdir(join(runtime, 'build'), { recursive: true })
    await symlink(outside, join(runtime, 'cache/downloads/native'))
    await symlink(outside, join(runtime, 'build/native'))
    for (const path of ['cache/downloads/native/archive-work', 'build/native/source-work']) {
      const operation = `const { ensureRuntimeDirectory } = await import("./src/utils/runtime-state.ts"); await ensureRuntimeDirectory(process.env.AUTOSHOW_PROJECT_ROOT + "/runtime/${path}")`
      const result = await runIsolatedRuntimeProbe(projectRoot, operation)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('inside the project runtime directory')
    }
    expect((await readdir(outside)).filter(name => name !== '.DS_Store')).toEqual(['sentinel.txt'])
    expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
  })
})

test('runtime downloads reject nested cache directory escapes before HTTP dispatch', async () => {
  await withRuntimeEscapeFixture(async (projectRoot, outside) => {
    const downloads = join(projectRoot, 'runtime/cache/downloads')
    await mkdir(downloads, { recursive: true })
    await symlink(outside, join(downloads, 'native'))
    const operation = 'const { downloadFile } = await import("./src/cli/commands/setup-and-utilities/setup/setup-download/download.ts"); globalThis.fetch = async () => { throw new Error("unexpected HTTP dispatch") }; await downloadFile({ url: "https://example.invalid/artifact", destination: process.env.AUTOSHOW_PROJECT_ROOT + "/runtime/cache/downloads/native/asset.bin" })'
    const result = await runIsolatedRuntimeProbe(projectRoot, operation)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('inside the project runtime directory')
    expect((await readdir(outside)).filter(name => name !== '.DS_Store')).toEqual(['sentinel.txt'])
    expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
  })
})

for (const suffix of ['', '.part', '.part.json']) {
  test(`runtime downloads reject an escaping ${suffix || 'destination'} file before HTTP dispatch`, async () => {
    await withRuntimeEscapeFixture(async (projectRoot, outside) => {
      const destination = join(projectRoot, 'runtime/cache/asset.bin')
      await mkdir(join(projectRoot, 'runtime/cache'), { recursive: true })
      await symlink(join(outside, 'sentinel.txt'), `${destination}${suffix}`)
      const operation = `const { downloadFile } = await import("./src/cli/commands/setup-and-utilities/setup/setup-download/download.ts"); globalThis.fetch = async () => { throw new Error("unexpected HTTP dispatch") }; await downloadFile({ url: "https://example.invalid/artifact", destination: ${JSON.stringify(destination)} })`
      const result = await runIsolatedRuntimeProbe(projectRoot, operation)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('inside the project runtime directory')
      expect((await readdir(outside)).filter(name => name !== '.DS_Store')).toEqual(['sentinel.txt'])
      expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
    })
  })
}

test('explicit artifact download destinations outside runtime retain their selected output behavior', async () => {
  await withRuntimeEscapeFixture(async (projectRoot, outside) => {
    const destination = join(outside, 'selected-output.bin')
    const operation = `const { downloadFile } = await import("./src/cli/commands/setup-and-utilities/setup/setup-download/download.ts"); globalThis.fetch = async () => new Response("explicit artifact bytes"); await downloadFile({ url: "https://example.invalid/artifact", destination: ${JSON.stringify(destination)} })`
    expect(await runIsolatedRuntimeProbe(projectRoot, operation)).toEqual({ ok: true })
    expect(await readFile(destination, 'utf8')).toBe('explicit artifact bytes')
    expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
  })
})

test('default lock acquisition rejects a symlinked state ancestor without creating an external lease', async () => {
  await withRuntimeEscapeFixture(async (projectRoot, outside) => {
    await symlink(outside, join(projectRoot, 'runtime/state'))
    const result = await runIsolatedRuntimeProbe(projectRoot, 'const { withProcessLock } = await import("./src/utils/process-lock.ts"); await withProcessLock("must-not-create", async () => {})')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('inside the project runtime directory')
    expect((await readdir(outside)).filter(name => name !== '.DS_Store')).toEqual(['sentinel.txt'])
    expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
  })
})

test('cache path resolution and direct cache writes reject nested physical escapes before reading or publishing', async () => {
  await withRuntimeEscapeFixture(async (projectRoot, outside) => {
    const cache = join(projectRoot, 'runtime/cache')
    await mkdir(cache)
    await symlink(outside, join(cache, 'redirect'))
    const pathProbe = await runIsolatedRuntimeProbe(projectRoot, 'const state = await import("./src/utils/runtime-state.ts"); state.getRuntimeCachePath("redirect", "probe.json")')
    expect(pathProbe.ok).toBe(false)
    const writeProbe = await runIsolatedRuntimeProbe(projectRoot, 'const { writeJsonCacheEntry } = await import("./src/utils/file-fingerprint-cache.ts"); await writeJsonCacheEntry({ cachePath: process.env.AUTOSHOW_PROJECT_ROOT + "/runtime/cache/redirect/probe.json", lockName: "probe-cache", key: "changed", value: true })')
    expect(writeProbe.ok).toBe(false)
    expect((await readdir(outside)).filter(name => name !== '.DS_Store')).toEqual(['sentinel.txt'])
    expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
  })
})

test('child environment rejects inherited temporary-directory symlinks before a subprocess can write through them', async () => {
  await withRuntimeEscapeFixture(async (projectRoot, outside) => {
    const tmp = join(projectRoot, 'runtime/tmp')
    await mkdir(tmp)
    const redirect = join(tmp, 'redirect')
    await symlink(outside, redirect)
    const result = await runIsolatedRuntimeProbe(projectRoot, 'const { childEnv } = await import("./src/utils/child-env.ts"); const child = Bun.spawn(["/bin/sh", "-c", "printf escaped > \\"$TMPDIR/probe-write\\""], { env: childEnv(), stdout: "ignore", stderr: "ignore" }); await child.exited', redirect)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('inside the project runtime directory')
    expect((await readdir(outside)).filter(name => name !== '.DS_Store')).toEqual(['sentinel.txt'])
    expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
  })
})

test('a canonical runtime-root symlink still permits physically contained cache and workspace creation', async () => {
  await withRuntimeEscapeFixture(async (projectRoot, outside) => {
    const runtime = join(projectRoot, 'runtime')
    await rm(runtime, { recursive: true })
    await symlink(outside, runtime)
    const result = await runIsolatedRuntimeProbe(projectRoot, 'const state = await import("./src/utils/runtime-state.ts"); await state.ensureRuntimeStateDirectories(); await state.createRuntimeTempDirectory("contained-"); await Bun.write(state.getRuntimeCachePath("probe.json"), "contained")')
    expect(result).toEqual({ ok: true })
    expect(await readFile(join(outside, 'cache/probe.json'), 'utf8')).toBe('contained')
    expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
  })
})

test('default English model links reject external data before any OCR subprocess probe', async () => {
  await withRuntimeEscapeFixture(async (projectRoot, outside) => {
    const runtime = join(projectRoot, 'runtime')
    const data = join(runtime, 'tools/tessdata')
    const bin = join(runtime, 'bin')
    const probe = join(runtime, 'probe-called')
    await mkdir(data, { recursive: true })
    await mkdir(bin, { recursive: true })
    await symlink(join(outside, 'sentinel.txt'), join(data, 'eng.traineddata'))
    const fake = join(bin, 'tesseract')
    await writeFile(fake, `#!/bin/sh\nprintf called > '${probe}'\nprintf unexpected-ocr-output\n`)
    await chmod(fake, 0o755)
    const structural = await runIsolatedRuntimeProbe(projectRoot, 'const { resolveTessdataPrefix } = await import("./src/utils/runtime-paths.ts"); resolveTessdataPrefix()')
    expect(structural.ok).toBe(false)
    expect(structural.error).toContain('inside the project runtime directory')
    const actual = await runIsolatedRuntimeProbe(projectRoot, 'const { ocrImage } = await import("./src/cli/commands/text/ocr/ocr-utils/tesseract-utils.ts"); await ocrImage("fixture.png", "eng", "text")')
    expect(actual.ok).toBe(false)
    expect(actual.error).toContain('inside the project runtime directory')
    expect(await Bun.file(probe).exists()).toBe(false)
    expect((await readdir(outside)).filter(name => name !== '.DS_Store')).toEqual(['sentinel.txt'])
    expect(await readFile(join(outside, 'sentinel.txt'), 'utf8')).toBe('preserve-external-bytes\n')
  })
})
