import { expect, test } from 'bun:test'
import { mkdtemp, rm, chmod } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

async function invoke(args: string[], linux = false, unavailable = false) {
  const dir = await mkdtemp(join(tmpdir(), 'docker-invocation-'))
  try {
    const docs = await Bun.file(resolve(import.meta.dir, '../../../../docs/docker.md')).text()
    const functionText = docs.match(/```bash\n(autoshow\(\) \([\s\S]*?\n\))\n```/)?.[1]
    expect(functionText).toBeString()
    const docker = join(dir, 'docker')
    await Bun.write(docker, `#!/bin/sh\nprintf '%s\\0' "$@" > "$DOCKER_TEST_LOG"\nexit "$DOCKER_TEST_EXIT"\n`)
    const uname = join(dir, 'uname')
    await Bun.write(uname, `#!/bin/sh\nprintf '%s' '${linux ? 'Linux' : 'Darwin'}'\n`)
    await chmod(docker, 0o755); await chmod(uname, 0o755)
    const child = Bun.spawn(['bash', '-c', functionText + '\nautoshow "$@"', 'test', ...args], { cwd: dir, env: { PATH: dir + ':' + process.env['PATH'], AUTOSHOW_WORKSPACE: '/project with spaces', AUTOSHOW_IMAGE: 'autoshow-cli:test', DOCKER_TEST_LOG: join(dir, 'args'), DOCKER_TEST_EXIT: unavailable ? '125' : '0' }, stdout: 'pipe', stderr: 'pipe' })
    const [code] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { code, args: (await Bun.file(join(dir, 'args')).text()).split('\0').slice(0, -1) }
  } finally { await rm(dir, { recursive: true, force: true }) }
}
test('documented container invocation preserves arguments, mounts, policy environment, image override and bridge default', async () => {
  const args = ['image', 'literal spaces $() `text` --help', '--provider', 'openai=gpt-image-2', '--price']
  const result = await invoke(args)
  expect(result.code).toBe(0)
  expect(result.args.slice(-args.length)).toEqual(args)
  expect(result.args).toContain('type=bind,src=/project with spaces,dst=/workspace')
  expect(result.args).toContain('type=bind,src=/project with spaces/.autoshow,dst=/app/runtime')
  expect(result.args).toContain('/project with spaces/.env')
  expect(result.args).toContain('/workspace')
  expect(result.args).toContain('AUTOSHOW_REQUIRED_IMAGE_MODEL=gpt-image-2')
  expect(result.args).toContain('autoshow-cli:test')
  expect(result.args).not.toContain('--network')
  expect(result.args.join(' ')).not.toContain('docker.sock')
})
test('Linux ownership and unavailable Docker propagate without native fallback', async () => {
  expect((await invoke(['--version'], true)).args).toContain('--user')
  expect((await invoke(['--version'], false, true)).code).toBe(125)
})
test('QA-only reaches the container unchanged', async () => {
  const args = ['comic', 'generate-images', 'fixture', '--qa-only']
  expect((await invoke(args)).args.slice(-args.length)).toEqual(args)
})
