import { expect, test } from 'bun:test'
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { hydrateDockerRuntime, writeDockerRuntimeSeedManifest } from '~/tools/docker-runtime-seed'
import { dockerCommandUsesBootstrapBun, dockerInvocationCanDispatch, dockerInvocationLaunchPlan, dockerInvocationNeedsRuntime, dockerRuntimeNeedsHydration } from '~/tools/docker-runtime-entry'

const withDockerSeed = async (run: (seed: string, runtime: string) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-docker-seed-'))
  const seed = join(directory, 'seed')
  const runtime = join(directory, 'runtime')
  try {
    await mkdir(join(seed, 'bin'), { recursive: true })
    await mkdir(join(seed, 'tools', 'example', 'data'), { recursive: true })
    await writeFile(join(seed, 'bin', 'example-tool'), '#!/bin/sh\nprintf "ready\\n"\n')
    await chmod(join(seed, 'bin', 'example-tool'), 0o755)
    await writeFile(join(seed, 'tools', 'example', 'library.bin'), Uint8Array.of(0, 1, 2, 255))
    await chmod(join(seed, 'tools', 'example', 'library.bin'), 0o644)
    await writeFile(join(seed, 'tools', 'example', 'data', 'notice.txt'), 'Example dependency notice.\n')
    await symlink('../tools/example/data', join(seed, 'bin', 'example-data'))
    await writeDockerRuntimeSeedManifest(seed)
    await run(seed, runtime)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('Docker seed hydration preserves executable modes, binary bytes, relative resource links and their relationships', async () => withDockerSeed(async (seed, runtime) => {
  await hydrateDockerRuntime(seed, runtime)
  const installed = await realpath(join(runtime, 'bin', 'example-tool'))
  const payload = dirname(dirname(installed))
  expect(await readFile(installed, 'utf8')).toBe(await readFile(join(seed, 'bin', 'example-tool'), 'utf8'))
  expect((await stat(installed)).mode & 0o777).toBe(0o755)
  expect(await readFile(join(payload, 'tools', 'example', 'library.bin'))).toEqual(Buffer.from([0, 1, 2, 255]))
  expect((await stat(join(payload, 'tools', 'example', 'library.bin'))).mode & 0o777).toBe(0o644)
  expect(await readlink(join(payload, 'bin', 'example-data'))).toBe('../tools/example/data')
  expect(await readFile(join(runtime, 'bin', 'example-data', 'notice.txt'), 'utf8')).toBe('Example dependency notice.\n')
  expect(installed.startsWith(`${await realpath(runtime)}/`)).toBe(true)
}))

test('Docker seed hydration preserves existing configuration, authored audio and unrelated state', async () => withDockerSeed(async (seed, runtime) => {
  await mkdir(join(runtime, 'protected-audio'), { recursive: true })
  await mkdir(join(runtime, 'state'), { recursive: true })
  await writeFile(join(runtime, 'autoshow.json'), '{"pricing":{"maxCents":25}}\n')
  const audioPath = join(runtime, 'protected-audio', 'segment.wav')
  await writeFile(audioPath, Uint8Array.of(82, 73, 70, 70, 0, 255))
  await chmod(audioPath, 0o640)
  await writeFile(join(runtime, 'state', 'existing.json'), '{"model":"local","segment":"../protected-audio/segment.wav"}\n')
  const before = { audio: await readFile(audioPath), mode: (await stat(audioPath)).mode & 0o777 }
  await hydrateDockerRuntime(seed, runtime)
  expect(await readFile(join(runtime, 'autoshow.json'), 'utf8')).toBe('{"pricing":{"maxCents":25}}\n')
  expect(await readFile(audioPath)).toEqual(before.audio)
  expect((await stat(audioPath)).mode & 0o777).toBe(before.mode)
  expect(JSON.parse(await readFile(join(runtime, 'state', 'existing.json'), 'utf8'))).toEqual({ model: 'local', segment: '../protected-audio/segment.wav' })
}))

test('warm Docker seed hydration reuses the selected payload without replacing its files', async () => withDockerSeed(async (seed, runtime) => {
  await hydrateDockerRuntime(seed, runtime)
  const selected = await realpath(join(runtime, 'bin', 'example-tool'))
  const before = await stat(selected)
  await hydrateDockerRuntime(seed, runtime)
  const after = await stat(await realpath(join(runtime, 'bin', 'example-tool')))
  expect(await realpath(join(runtime, 'bin', 'example-tool'))).toBe(selected)
  expect({ inode: after.ino, modified: after.mtimeMs, mode: after.mode }).toEqual({ inode: before.ino, modified: before.mtimeMs, mode: before.mode })
}))

test('Docker seed updates activate a complete replacement while retaining the earlier working payload', async () => withDockerSeed(async (seed, runtime) => {
  await hydrateDockerRuntime(seed, runtime)
  const earlier = await realpath(join(runtime, 'bin', 'example-tool'))
  const earlierBytes = await readFile(earlier)
  await writeFile(join(seed, 'bin', 'example-tool'), '#!/bin/sh\nprintf "updated\\n"\n')
  await writeDockerRuntimeSeedManifest(seed)
  await hydrateDockerRuntime(seed, runtime)
  const selected = await realpath(join(runtime, 'bin', 'example-tool'))
  expect(selected).not.toBe(earlier)
  expect(await readFile(selected, 'utf8')).toContain('updated')
  expect(await readFile(earlier)).toEqual(earlierBytes)
  expect(await readFile(join(runtime, 'bin', 'example-data', 'notice.txt'), 'utf8')).toBe('Example dependency notice.\n')
}))

test('a corrupted Docker seed cannot replace an existing working payload', async () => withDockerSeed(async (seed, runtime) => {
  await hydrateDockerRuntime(seed, runtime)
  const earlier = await realpath(join(runtime, 'bin', 'example-tool'))
  const earlierBytes = await readFile(earlier)
  await writeFile(join(seed, 'bin', 'example-tool'), '#!/bin/sh\nprintf "replacement\\n"\n')
  await writeDockerRuntimeSeedManifest(seed)
  await writeFile(join(seed, 'tools', 'example', 'library.bin'), 'corrupt seed bytes')
  await expect(hydrateDockerRuntime(seed, runtime)).rejects.toThrow()
  expect(await realpath(join(runtime, 'bin', 'example-tool'))).toBe(earlier)
  expect(await readFile(earlier)).toEqual(earlierBytes)
}))

test('Docker seed hydration repairs modified active bytes and permissions in a new generation', async () => withDockerSeed(async (seed, runtime) => {
  await hydrateDockerRuntime(seed, runtime)
  const damaged = await realpath(join(runtime, 'bin', 'example-tool'))
  await writeFile(damaged, '#!/bin/sh\nprintf "wrong\\n"\n')
  await chmod(damaged, 0o644)
  const result = await hydrateDockerRuntime(seed, runtime)
  const repaired = await realpath(join(runtime, 'bin', 'example-tool'))
  expect(result.reused).toBe(false)
  expect(repaired).not.toBe(damaged)
  expect(await readFile(repaired, 'utf8')).toBe(await readFile(join(seed, 'bin', 'example-tool'), 'utf8'))
  expect((await stat(repaired)).mode & 0o777).toBe(0o755)
  expect(await readFile(damaged, 'utf8')).toContain('wrong')
  expect((await stat(damaged)).mode & 0o777).toBe(0o644)
  expect(await readFile(join(runtime, 'bin', 'example-data', 'notice.txt'), 'utf8')).toBe('Example dependency notice.\n')
}))

test('Docker seed hydration detects changed resource directory permissions and restores a complete generation', async () => withDockerSeed(async (seed, runtime) => {
  await hydrateDockerRuntime(seed, runtime)
  const previousDirectory = await realpath(join(runtime, 'tools/example/data'))
  const originalMode = (await stat(previousDirectory)).mode & 0o777
  await chmod(previousDirectory, 0o777)
  const result = await hydrateDockerRuntime(seed, runtime)
  const repairedDirectory = await realpath(join(runtime, 'tools/example/data'))
  expect(result.reused).toBe(false)
  expect(repairedDirectory).not.toBe(previousDirectory)
  expect((await stat(repairedDirectory)).mode & 0o777).toBe(originalMode)
  expect((await stat(previousDirectory)).mode & 0o777).toBe(0o777)
  expect(await readFile(join(runtime, 'bin/example-data/notice.txt'), 'utf8')).toBe('Example dependency notice.\n')
}))

test('Docker seed manifest creation rejects a resource symlink escaping the distribution', async () => withDockerSeed(async seed => {
  await symlink('../../outside', join(seed, 'bin', 'escape'))
  await expect(writeDockerRuntimeSeedManifest(seed)).rejects.toThrow()
}))

test('Docker seed hydration detects payload root permissions and nested manifest-named resource changes', async () => withDockerSeed(async (seed, runtime) => {
  const resource = join(seed, 'tools/example/.autoshow-docker-runtime.json')
  await writeFile(resource, 'ordinary packaged resource\n')
  await writeDockerRuntimeSeedManifest(seed)
  await hydrateDockerRuntime(seed, runtime)
  const previous = await realpath(join(runtime, 'tools/docker-image/current'))
  const originalMode = (await stat(previous)).mode & 0o777
  await chmod(previous, 0o777)
  expect((await hydrateDockerRuntime(seed, runtime)).reused).toBe(false)
  const repaired = await realpath(join(runtime, 'tools/docker-image/current'))
  expect(repaired).not.toBe(previous)
  expect((await stat(repaired)).mode & 0o777).toBe(originalMode)
  expect(await readFile(join(repaired, 'tools/example/.autoshow-docker-runtime.json'), 'utf8')).toBe('ordinary packaged resource\n')
  expect((await stat(previous)).mode & 0o777).toBe(0o777)
  await writeFile(join(repaired, 'tools/example/.autoshow-docker-runtime.json'), 'changed resource\n')
  expect((await hydrateDockerRuntime(seed, runtime)).reused).toBe(false)
  const final = await realpath(join(runtime, 'tools/docker-image/current'))
  expect(final).not.toBe(repaired)
  expect(await readFile(join(final, 'tools/example/.autoshow-docker-runtime.json'), 'utf8')).toBe('ordinary packaged resource\n')
  expect(await readFile(join(repaired, 'tools/example/.autoshow-docker-runtime.json'), 'utf8')).toBe('changed resource\n')
}))

test('Docker seed hydration preserves a legitimately absent optional internal symlink target', async () => withDockerSeed(async (seed, runtime) => {
  await symlink('../tools/example/optional-data', join(seed, 'bin', 'optional-data'))
  await writeDockerRuntimeSeedManifest(seed)
  await hydrateDockerRuntime(seed, runtime)
  const installed = await realpath(join(runtime, 'bin', 'example-tool'))
  const optionalLink = join(dirname(installed), 'optional-data')
  expect((await lstat(optionalLink)).isSymbolicLink()).toBe(true)
  expect(await readlink(optionalLink)).toBe('../tools/example/optional-data')
  await expect(realpath(optionalLink)).rejects.toMatchObject({ code: 'ENOENT' })
  expect((await hydrateDockerRuntime(seed, runtime)).reused).toBe(true)
}))

test('Docker seed hydration detects when an absent optional target appears in an active payload', async () => withDockerSeed(async (seed, runtime) => {
  await symlink('../tools/example/optional-data', join(seed, 'bin', 'optional-data'))
  await writeDockerRuntimeSeedManifest(seed)
  await hydrateDockerRuntime(seed, runtime)
  const previous = await realpath(join(runtime, 'bin', 'example-tool'))
  const addedTarget = join(dirname(dirname(previous)), 'tools', 'example', 'optional-data')
  await writeFile(addedTarget, 'Unrecorded optional resource.\n')
  const result = await hydrateDockerRuntime(seed, runtime)
  expect(result.reused).toBe(false)
  expect(await realpath(join(runtime, 'bin', 'example-tool'))).not.toBe(previous)
  await expect(realpath(join(runtime, 'bin', 'optional-data'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(addedTarget, 'utf8')).toBe('Unrecorded optional resource.\n')
}))

test('Docker seed manifest rejects a dangling resource target whose existing parent resolves outside the distribution', async () => withDockerSeed(async seed => {
  const external = join(dirname(seed), 'external-resources')
  await mkdir(external)
  await symlink(external, join(seed, 'tools', 'external-resources'))
  await symlink('../tools/external-resources/missing-resource', join(seed, 'bin', 'escape-via-parent'))
  await expect(writeDockerRuntimeSeedManifest(seed)).rejects.toThrow()
}))

test('Docker seed hydration refuses a destination route through an external symlink', async () => withDockerSeed(async (seed, runtime) => {
  const external = join(dirname(runtime), 'external')
  await mkdir(external)
  await mkdir(runtime)
  await symlink(external, join(runtime, 'tools'))
  await expect(hydrateDockerRuntime(seed, runtime)).rejects.toThrow()
  expect(await readlink(join(runtime, 'tools'))).toBe(external)
  expect((await lstat(external)).isDirectory()).toBe(true)
}))

test('Docker seed hydration rejects an existing unrelated tool without replacing its bytes or permissions', async () => withDockerSeed(async (seed, runtime) => {
  await mkdir(join(runtime, 'bin'), { recursive: true })
  const existing = join(runtime, 'bin', 'example-tool')
  await writeFile(existing, 'An independently installed tool.\n')
  await chmod(existing, 0o750)
  await expect(hydrateDockerRuntime(seed, runtime)).rejects.toThrow(/unrelated existing path/)
  expect(await readFile(existing, 'utf8')).toBe('An independently installed tool.\n')
  expect((await stat(existing)).mode & 0o777).toBe(0o750)
}))

test('concurrent Docker seed hydration selects one complete payload and reuses it for the other caller', async () => withDockerSeed(async (seed, runtime) => {
  const results = await Promise.all([hydrateDockerRuntime(seed, runtime), hydrateDockerRuntime(seed, runtime)])
  expect(results.map(result => result.reused).sort()).toEqual([false, true])
  expect(new Set(results.map(result => result.revision)).size).toBe(1)
  expect(await readFile(join(runtime, 'bin', 'example-tool'), 'utf8')).toContain('ready')
  expect(await readFile(join(runtime, 'bin', 'example-data', 'notice.txt'), 'utf8')).toBe('Example dependency notice.\n')
}))

test('Docker bootstrap distinguishes read-only CLI modes from setup and processing', () => {
  for (const args of [[], ['help'], ['--version'], ['extract', '--help'], ['setup', '--doctor'], ['setup', '--dry-run'], ['setup', '--network-check', 'serve'], ['config', '--show']]) {
    expect(dockerInvocationNeedsRuntime(args), JSON.stringify(args)).toBe(false)
  }
  for (const args of [['extract', 'fixture.pdf'], ['setup'], ['setup', '--step', 'rendering']]) {
    expect(dockerInvocationNeedsRuntime(args), JSON.stringify(args)).toBe(true)
  }
})

test('Docker bootstrap respects boolean flag values and literal arguments after the terminator', () => {
  expect(dockerInvocationNeedsRuntime(['setup', '--doctor=true'])).toBe(false)
  expect(dockerInvocationNeedsRuntime(['setup', '--dry-run=true'])).toBe(false)
  expect(dockerInvocationNeedsRuntime(['setup', '--doctor=false'])).toBe(true)
  expect(dockerInvocationNeedsRuntime(['setup', '--dry-run=false'])).toBe(true)
  expect(dockerInvocationNeedsRuntime(['image', '--', '--help'])).toBe(true)
  expect(dockerInvocationNeedsRuntime(['setup', '--help-topic', 'unknown'])).toBe(false)
  expect(dockerInvocationNeedsRuntime(['setup', '--help-topic=unknown'])).toBe(false)
  expect(dockerInvocationNeedsRuntime(['setup', '--help-format', 'json'])).toBe(false)
  expect(dockerInvocationNeedsRuntime(['image', '--', '--help-topic=literal'])).toBe(true)
})

test('Docker warm processing preserves a contained executable managed launcher and setup keeps its trusted repair launcher', async () => {
  expect(await dockerRuntimeNeedsHydration(() => undefined)).toBe(true)
  expect(await dockerRuntimeNeedsHydration(() => '/managed/bun', async () => {})).toBe(false)
  expect(await dockerRuntimeNeedsHydration(() => '/managed/bun', async () => { throw new Error('not executable') })).toBe(true)
  await expect(dockerRuntimeNeedsHydration(() => { throw new Error('outside managed root') })).rejects.toThrow('outside managed root')
  expect(dockerCommandUsesBootstrapBun(['setup'])).toBe(true)
  expect(dockerCommandUsesBootstrapBun(['setup', '--step', 'toolchain'])).toBe(true)
  expect(dockerCommandUsesBootstrapBun(['setup', '--doctor'])).toBe(true)
  expect(dockerCommandUsesBootstrapBun(['extract', 'fixture.pdf'])).toBe(false)
})

test('Docker bootstrap preflight reuses native parsing before any runtime provisioning', async () => {
  for (const args of [['does-not-exist'], ['write'], ['extract', 'fixture.pdf', '--unknown-processing-flag']]) {
    expect(await dockerInvocationCanDispatch(args), JSON.stringify(args)).toBe(false)
  }
  for (const args of [
    ['extract', 'fixture.pdf', '--provider', 'tesseract'],
    ['--json', 'extract', 'fixture.pdf', '--provider', 'tesseract'],
    ['--json', '--result-file', 'runtime/result.json', 'extract', 'fixture.pdf', '--provider', 'tesseract'],
    ['config', '--show'],
    ['comic', 'review', '05-01']
  ]) expect(await dockerInvocationCanDispatch(args), JSON.stringify(args)).toBe(true)
})

test('Docker launcher classifies canonical JSON and result-file arguments before choosing hydration or repair launcher', async () => {
  for (const args of [
    ['--json', 'setup', '--doctor'],
    ['--result-file', 'runtime/doctor.json', '--json', 'setup', '--doctor'],
    ['--json', 'config', '--show'],
    ['--json', 'unknown-command']
  ]) expect(await dockerInvocationLaunchPlan(args)).toEqual({ needsRuntime: false, bootstrap: true })
  expect(await dockerInvocationLaunchPlan(['--json', 'setup', '--step', 'toolchain'])).toEqual({ needsRuntime: true, bootstrap: true })
  expect(await dockerInvocationLaunchPlan(['--json', 'extract', 'fixture.pdf', '--provider', 'tesseract'])).toEqual({ needsRuntime: true, bootstrap: false })
})

test('Docker native parser preflight leaves a fresh project and requested result path untouched', async () => withDockerSeed(async (_seed, runtime) => {
  const project = join(dirname(runtime), 'preflight-project')
  await mkdir(project)
  const module = Bun.fileURLToPath(import.meta.resolve('~/tools/docker-runtime-entry'))
  const script = `const {dockerInvocationCanDispatch}=await import(${JSON.stringify(module)});console.log(JSON.stringify({valid:await dockerInvocationCanDispatch(['--json','--result-file',${JSON.stringify(join(project, 'result.json'))},'extract','fixture.pdf','--provider','tesseract']),invalid:await dockerInvocationCanDispatch(['write'])}));`
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', script], {
    env: { PATH: process.env['PATH'], HOME: process.env['HOME'], AUTOSHOW_PROJECT_ROOT: project },
    stdout: 'pipe', stderr: 'pipe'
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(code, stderr).toBe(0)
  expect(JSON.parse(stdout.trim().split('\n').at(-1)!)).toEqual({ valid: true, invalid: false })
  expect(await readdir(project)).toEqual([])
}))
