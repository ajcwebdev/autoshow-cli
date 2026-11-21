import { expect, test } from 'bun:test'
import { chmod, lstat, mkdir, mkdtemp, readlink, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'

test('full setup preserves active, failed, and interrupted build workspaces and forwards replacement options', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-setup-workspace-preservation-'))
  const projectRoot = join(directory, 'isolated-project')
  const modulePath = join(PROJECT_ROOT, 'src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts')
  const statuses = ['active', 'failed', 'interrupted']
  try {
    for (const status of statuses) {
      const workspace = join(projectRoot, 'runtime/build', status)
      await mkdir(workspace, { recursive: true })
      await Bun.write(join(workspace, 'owner.json'), `${JSON.stringify({ status, pid: process.pid, producer: 'independent-selective-setup' })}\n`)
      await Bun.write(join(workspace, 'build.log'), `${status} compilation evidence\n`)
      await chmod(join(workspace, 'build.log'), 0o640)
      await symlink('build.log', join(workspace, 'latest'))
    }
    const source = `
      import { runCompleteSetup } from ${JSON.stringify(modulePath)};
      const events = [];
      const record = name => async options => { events.push({name,force:options.forceRedownload}); };
      const result = await runCompleteSetup({forceRedownload:true}, {
        toolchain: record('toolchain'), media:record('media'), documents:record('documents'),
        ocr:record('ocr'), rendering:record('rendering'), defuddle:record('defuddle'), alignment:record('alignment'),
        whisperfile:async(model,options)=>{events.push({name:'whisperfile',model,force:options.forceRedownload});},
        migrateState:async()=>{events.push({name:'migration'});},
        verifyRendering:async()=>{events.push({name:'verify-rendering'});},
        summarize:async()=>true
      });
      console.log(JSON.stringify({result,events}));
    `
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], {
      cwd: directory,
      env: { PATH: '/usr/bin:/bin', AUTOSHOW_PROJECT_ROOT: projectRoot, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', NO_COLOR: '1' },
      stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
    })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code, stderr).toBe(0)
    const result = JSON.parse(stdout.trim().split('\n').at(-1)!)
    expect(result.result).toBe(true)
    expect(result.events.filter((event: { force?: boolean }) => event.force !== undefined)).toHaveLength(8)
    expect(result.events.filter((event: { force?: boolean }) => event.force !== undefined).every((event: { force: boolean }) => event.force)).toBe(true)
    expect(result.events.find((event: { name: string }) => event.name === 'whisperfile')).toMatchObject({ model: 'tiny', force: true })
    expect(result.events.findIndex((event: { name: string }) => event.name === 'toolchain')).toBeLessThan(result.events.findIndex((event: { name: string }) => event.name === 'media'))
    for (const status of statuses) {
      const workspace = join(projectRoot, 'runtime/build', status)
      expect(await Bun.file(join(workspace, 'owner.json')).json()).toEqual({ status, pid: process.pid, producer: 'independent-selective-setup' })
      expect(await Bun.file(join(workspace, 'build.log')).text()).toBe(`${status} compilation evidence\n`)
      expect((await lstat(join(workspace, 'build.log'))).mode & 0o777).toBe(0o640)
      expect(await readlink(join(workspace, 'latest'))).toBe('build.log')
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})
