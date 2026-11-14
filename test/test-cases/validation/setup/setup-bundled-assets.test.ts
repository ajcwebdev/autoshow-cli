import { expect, test } from 'bun:test'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { SOURCE_ROOT } from '~/utils/project-root'
import { withTempDir } from '../../../test-utils/temp-dirs'

test('a nested source bundle previews an empty mutable root using its checkout assets', async () => {
  await withTempDir('setup-bundled-assets-', async directory => {
    const bundlePath = join(directory, 'nested/cache/cli.js')
    await mkdir(dirname(bundlePath), { recursive: true })
    const built = await Bun.build({
      entrypoints: [join(SOURCE_ROOT, 'src/cli/create-cli.ts')],
      target: 'bun', format: 'esm'
    })
    expect(built.success, built.logs.map(log => log.message).join('\n')).toBe(true)
    expect(built.outputs).toHaveLength(1)
    await Bun.write(bundlePath, built.outputs[0]!)

    const mutableRoot = join(directory, 'empty-mutable-root')
    const child = Bun.spawn([
      process.execPath, '--no-env-file', bundlePath,
      'setup', '--step', 'ocr', '--dry-run', '--json'
    ], {
      cwd: directory,
      env: { PATH: '/usr/bin:/bin', AUTOSHOW_PROJECT_ROOT: mutableRoot, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' },
      stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()
    ])
    expect(exitCode, stderr).toBe(0)
    expect(JSON.parse(stdout)).toMatchObject({
      type: 'result', status: 'success', data: { mode: 'plan', dryRun: true, step: 'ocr' }
    })
    await expect(stat(mutableRoot)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
