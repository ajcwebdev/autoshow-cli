import { expect, test } from 'bun:test'
import { lstat, mkdir, readdir, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'
import { withLocalTestDir } from '../../../test-utils/temp-dirs'

const runSyntheticInstaller = async (root: string, action: string): Promise<{ error: string, downloads: number, processes: number }> => {
  const script = `import {ensureManagedBunRuntime,ensureManagedAlignmentRuntime,writeManagedPackageManifest} from ${JSON.stringify(join(PROJECT_ROOT, 'src/cli/commands/setup-and-utilities/setup/setup-download/managed-js-runtime.ts'))};
import {setupDefuddleCli} from ${JSON.stringify(join(PROJECT_ROOT, 'src/cli/commands/text/url/url-local/defuddle/defuddle-cli.ts'))};
import {setupWhisperfile} from ${JSON.stringify(join(PROJECT_ROOT, 'src/cli/commands/stt/local/whisperfile/whisperfile.ts'))};
let downloads=0,processes=0;
globalThis.fetch=()=>{downloads++;throw new Error('Synthetic containment check attempted network')};
Bun.spawn=()=>{processes++;throw new Error('Synthetic containment check dispatched a tool')};
try{${action};console.log(JSON.stringify({error:'',downloads,processes}))}catch(error){console.log(JSON.stringify({error:error.message,downloads,processes}))}`
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', script], {
    env: { PATH: '/usr/bin:/bin', ...(process.env['HOME'] ? { HOME: process.env['HOME'] } : {}), AUTOSHOW_PROJECT_ROOT: root },
    stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(15_000)
  })
  const [status, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(status, stderr).toBe(0)
  const result = JSON.parse(stdout.trim().split('\n').at(-1)!) as { error: string, downloads: number, processes: number }
  expect(result.error).toMatch(/inside|installation/)
  expect(result.downloads).toBe(0)
  expect(result.processes).toBe(0)
  return result
}

test('JS runtime download caches reject nested external and dangling directory links before network or tool dispatch', async () => withLocalTestDir('js-cache-boundary', async fixture => {
  for (const dangling of [false, true]) {
    const root = join(fixture, dangling ? 'dangling-project' : 'project')
    const external = join(fixture, dangling ? 'not-created' : 'external')
    await mkdir(join(root, 'runtime/cache'), { recursive: true })
    if (!dangling) {
      await mkdir(external)
      await Bun.write(join(external, 'preserved.txt'), 'external cache sentinel\n')
    }
    await symlink(external, join(root, 'runtime/cache/downloads'))
    await runSyntheticInstaller(root, 'await ensureManagedBunRuntime()')
    if (dangling) expect(await lstat(external).then(() => true, () => false)).toBe(false)
    else {
      expect(await Bun.file(join(external, 'preserved.txt')).text()).toBe('external cache sentinel\n')
      expect(await readdir(external)).toEqual(['preserved.txt'])
    }
  }
}))

test('alignment, Defuddle and model setup reject escaping installation parents without changing external sentinels', async () => withLocalTestDir('js-install-boundary', async fixture => {
  const root = join(fixture, 'project'), external = join(fixture, 'external')
  await mkdir(join(root, 'runtime'), { recursive: true })
  await mkdir(external)
  await Bun.write(join(external, 'preserved.txt'), 'external install sentinel\n')
  await symlink(external, join(root, 'runtime/tools'))
  await runSyntheticInstaller(root, 'await ensureManagedAlignmentRuntime()')
  await symlink(external, join(root, 'runtime/package-home'))
  await runSyntheticInstaller(root, `await setupDefuddleCli({directory:${JSON.stringify(join(root, 'runtime/package-home/defuddle'))}})`)
  await symlink(external, join(root, 'runtime/bin'))
  await runSyntheticInstaller(root, 'await setupWhisperfile("tiny")')
  expect(await Bun.file(join(external, 'preserved.txt')).text()).toBe('external install sentinel\n')
  expect(await readdir(external)).toEqual(['preserved.txt'])
}))

test('package receipt generation refuses an external receipt symlink without overwriting its target', async () => withLocalTestDir('js-receipt-boundary', async fixture => {
  const root = join(fixture, 'project'), installation = join(root, 'runtime/private-package'), sentinel = join(fixture, 'preserved.txt')
  await mkdir(installation, { recursive: true })
  await Bun.write(sentinel, 'external receipt sentinel\n')
  await symlink(sentinel, join(installation, '.autoshow-package.json'))
  await runSyntheticInstaller(root, `await writeManagedPackageManifest(${JSON.stringify(installation)},'fixture@1')`)
  expect(await Bun.file(sentinel).text()).toBe('external receipt sentinel\n')
  expect(await readdir(installation)).toEqual(['.autoshow-package.json'])
}))
