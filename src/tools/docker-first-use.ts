/** Offline first-use probe: synthetic dependencies only, with the image's original HOME. */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { childEnv } from '../utils/child-env'
import { ValidationError } from '../utils/error-handler'
import { writeCommandPayload } from '../utils/app-logger/result-emitter'

export const inspectFirstUse = async (home = process.env['HOME']) => {
  if (!home) throw ValidationError('First-use verification requires HOME')
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-first-use-'))
  try {
    const app = join(directory, 'app')
    const dependency = join(directory, 'dependency')
    await mkdir(app)
    await mkdir(dependency)
    await writeFile(join(dependency, 'package.json'), JSON.stringify({ name: '@autoshow/first-use', version: '1.0.0', main: './index.js', type: 'module' }))
    await writeFile(join(dependency, 'index.js'), 'export const ready = true;\n')
    const manifest = JSON.stringify({ private: true, dependencies: { '@autoshow/first-use': 'file:../dependency' } })
    await writeFile(join(app, 'package.json'), manifest)
    const proc = Bun.spawn([process.execPath, '--no-env-file', 'install', '--ignore-scripts', '--no-save'], {
      cwd: app,
      env: childEnv({ set: { HOME: home } }),
      stdout: 'pipe',
      stderr: 'pipe'
    })
    let expired = false
    const deadline = setTimeout(() => { expired = true; proc.kill('SIGKILL') }, 15_000)
    let result: [string, string, number]
    try { result = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]) }
    finally { clearTimeout(deadline) }
    const [stdout, stderr, exitCode] = result
    if (expired) throw ValidationError('Bun first-use local dependency install timed out')
    if (exitCode !== 0) throw ValidationError(`Bun first-use local dependency install failed: ${stderr.trim() || stdout.trim() || exitCode}`)
    if (await readFile(join(app, 'package.json'), 'utf8') !== manifest) throw ValidationError('First-use probe modified its manifest')
    const installed = await import(join(app, 'node_modules/@autoshow/first-use/index.js')) as { ready?: boolean }
    if (installed.ready !== true) throw ValidationError('First-use local dependency did not import correctly')
    return { status: 'passed', localPackageInstall: true, originalHome: true }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  if (process.getuid?.() === 0) throw ValidationError('Run first-use verification as the runtime user')
  writeCommandPayload(`${JSON.stringify(await inspectFirstUse())}\n`)
}
