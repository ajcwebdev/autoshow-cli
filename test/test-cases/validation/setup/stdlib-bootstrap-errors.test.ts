import { expect, test } from 'bun:test'
import { copyFile, lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { createRuntimeTempDirectory } from '~/utils/runtime-state'

const bootstrapSources = [
  'src/tools/project-runtime-dependencies.ts',
  'src/utils/app-error.ts',
  'src/utils/project-root.ts',
  'src/utils/runtime-containment.ts'
] as const

const isolatedBootstrap = async () => {
  const root = await createRuntimeTempDirectory('stdlib-bootstrap-')
  for (const path of bootstrapSources) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await copyFile(resolve(path), join(root, path))
  }
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'stdlib-bootstrap-fixture', dependencies: { fixture: '1.0.0' } }))
  await mkdir(join(root, 'src/cli'), { recursive: true })
  await writeFile(join(root, 'src/cli/create-cli.ts'), '// Source-root marker for the isolated bootstrap fixture.\n')
  await writeFile(join(root, 'bun.lock'), '{}\n')
  await writeFile(join(root, 'bunfig.toml'), '')
  const run = async (args: string[]) => {
    const child = Bun.spawn([process.execPath, '--no-env-file', '--no-install', ...args], {
      cwd: root,
      env: { PATH: '/usr/bin:/bin', BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' },
      stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(10_000)
    })
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { exitCode, stdout, stderr }
  }
  return { root, run }
}

test('source bootstrap reports plain protocol errors before any package graph exists', async () => {
  const { root, run } = await isolatedBootstrap()
  try {
    const failure = await run(['src/tools/project-runtime-dependencies.ts', '--unknown-fixture-option'])
    expect(failure).toEqual({ exitCode: 1, stdout: '', stderr: 'Project dependency runtime: unknown argument: --unknown-fixture-option\n' })
    expect(await Bun.file(join(root, 'node_modules')).exists()).toBe(false)
    const typed = await run(['-e', 'const { AppError } = await import("./src/utils/app-error.ts"); const { ensureProjectRuntimeDependencies } = await import("./src/tools/project-runtime-dependencies.ts"); try { await ensureProjectRuntimeDependencies({ runtimeRoot: "/external/runtime" }); } catch (error) { process.stdout.write(JSON.stringify({ application: error instanceof AppError, kind: error.kind, stage: error.stage, exitCode: error.exitCode })); }'])
    expect(typed.exitCode).toBe(0)
    expect(typed.stderr).toBe('')
    expect(JSON.parse(typed.stdout)).toEqual({ application: true, kind: 'infrastructure', stage: 'bootstrap:project-dependencies', exitCode: 1 })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('standalone bootstrap payloads retain one JSON record and no diagnostic output for a trusted local graph', async () => {
  const { root, run } = await isolatedBootstrap()
  try {
    const packageRoot = join(root, 'node_modules/.store/fixture')
    await mkdir(packageRoot, { recursive: true })
    await writeFile(join(packageRoot, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n')
    await symlink('.store/fixture', join(root, 'node_modules/fixture'))
    for (const args of [[], ['--verify']]) {
      const success = await run(['src/tools/project-runtime-dependencies.ts', ...args])
      expect(success.exitCode, success.stderr).toBe(0)
      expect(success.stderr).toBe('')
      expect(success.stdout.trim().split('\n')).toHaveLength(1)
      expect(JSON.parse(success.stdout)).toEqual({ status: args.length > 0 ? 'verified' : 'ready', production: true, entries: 5 })
    }
    expect((await lstat(join(root, 'node_modules'))).isSymbolicLink()).toBe(true)
    expect(await readFile(join(root, 'runtime/tools/project-dependencies/node_modules/fixture/package.json'), 'utf8')).toContain('"version":"1.0.0"')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('the bootstrap source boundary retains no installed-package runtime imports', async () => {
  for (const path of bootstrapSources) {
    const source = await Bun.file(path).text()
    const module = new Bun.Transpiler({ loader: 'ts' }).scanImports(source)
    for (const imported of module) {
      expect(imported.path.startsWith('node:') || imported.path.startsWith('.')).toBe(true)
    }
  }
})
