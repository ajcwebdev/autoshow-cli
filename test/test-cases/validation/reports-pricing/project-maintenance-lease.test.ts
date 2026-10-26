import { afterAll, expect, test } from 'bun:test'
import { chmod, mkdir, readFile, readdir, realpath, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { acquireProjectMaintenanceLease, acquireProjectWriterLease, resolveProjectMaintenanceRoots, withProjectWriterLease } from '~/utils/project-maintenance-lease'
import { commandRequiresProjectWriterLease } from '~/cli/native/dispatcher'
import { PROJECT_ROOT } from '~/utils/project-root'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const temporary = createTempDirTracker('autoshow-workspace-leases-')
afterAll(async () => await temporary.cleanup())
const fixture = async (): Promise<string> => {
  const root = await temporary.make()
  await writeFile(join(root, 'AGENTS.md'), '# Fixture workspace\n')
  return await realpath(root)
}
const leaseRoot = (root: string): string => join(root, 'output/.autoshow-workspace-leases')
const child = (cwd: string, code: string, overrides: Record<string, string> = {}) => Bun.spawn([
  process.execPath, '--no-env-file', '-e', code
], { cwd, env: { ...process.env, ...overrides }, stdout: 'pipe', stderr: 'pipe' })
const utilityImport = JSON.stringify(join(PROJECT_ROOT, 'src/utils/project-maintenance-lease.ts'))

test('maintenance excludes writers and other maintenance, then cleans solely created output', async () => {
  const root = await fixture(), lease = await acquireProjectMaintenanceLease(root)
  await lease.assertHeld()
  await expect(acquireProjectWriterLease(root)).rejects.toThrow('maintenance lease is active')
  await expect(acquireProjectMaintenanceLease(root)).rejects.toThrow('already held')
  await lease.release()
  await lease.release()
  await expect(lease.assertHeld()).rejects.toThrow('released')
  expect(await readdir(root)).toEqual(['AGENTS.md'])
})

test('concurrent writer leases coexist and exclude maintenance until every writer releases', async () => {
  const root = await fixture()
  const [a, b] = await Promise.all([acquireProjectWriterLease(root), acquireProjectWriterLease(root)])
  await expect(acquireProjectMaintenanceLease(root)).rejects.toThrow('writer leases are active')
  await a.release()
  await b.assertHeld()
  await expect(acquireProjectMaintenanceLease(root)).rejects.toThrow('writer leases are active')
  await b.release()
  expect(await readdir(root)).toEqual(['AGENTS.md'])
})

test('concurrent writer churn retries parent cleanup races without leaking claims', async () => {
  const root = await fixture()
  const results = await Promise.allSettled(Array.from({ length: 20 }, async () => {
    for (let index = 0; index < 10; index++) {
      const held = await acquireProjectWriterLease(root)
      try { await held.assertHeld() } finally { await held.release() }
    }
  }))
  expect(results.filter(result => result.status === 'rejected')).toEqual([])
  const maintenance = await acquireProjectMaintenanceLease(root)
  try { await maintenance.assertHeld() } finally { await maintenance.release() }
  expect(await readdir(root)).toEqual(['AGENTS.md'])
})

test('preexisting output and handler errors retain user directories without leaving leases', async () => {
  const root = await fixture()
  await mkdir(join(root, 'output'))
  await expect(withProjectWriterLease([root], async () => { throw new Error('handler failed') })).rejects.toThrow('handler failed')
  expect(await readdir(join(root, 'output'))).toEqual([])
})

test('second writer check catches exclusion appearing after its initial check', async () => {
  const root = await fixture(), exclusion = join(leaseRoot(root), 'maintenance')
  await expect(acquireProjectWriterLease(root, { afterWriterClaim: async () => { await mkdir(exclusion) } })).rejects.toThrow('began while the writer claimed')
  expect(await readdir(join(leaseRoot(root), 'writers'))).toEqual([])
  expect(await readdir(exclusion)).toEqual([])
})

test('foreign maintenance owner is never removed by assertHeld or release', async () => {
  const root = await fixture(), lease = await acquireProjectMaintenanceLease(root)
  const path = join(leaseRoot(root), 'maintenance/owner.json'), original = await readFile(path, 'utf8')
  const foreign = JSON.parse(original) as Record<string, unknown>
  foreign['token'] = 'foreign-owner'
  await writeFile(path, JSON.stringify(foreign))
  await expect(lease.assertHeld()).rejects.toThrow('ownership changed')
  await expect(lease.release()).rejects.toThrow('ownership changed')
  expect(JSON.parse(await readFile(path, 'utf8'))['token']).toBe('foreign-owner')
  await writeFile(path, original)
  await lease.release()
})

test('symlink roots, output paths, and lease directories fail closed', async () => {
  const outside = await fixture(), root = await fixture()
  await symlink(outside, join(root, 'alias'))
  await expect(acquireProjectMaintenanceLease(join(root, 'alias'))).rejects.toThrow('real directory')
  await symlink(outside, join(root, 'output'))
  await expect(acquireProjectMaintenanceLease(root)).rejects.toThrow('real directory')
  const other = await fixture()
  await mkdir(join(other, 'output'))
  await symlink(outside, leaseRoot(other))
  await expect(acquireProjectWriterLease(other)).rejects.toThrow('real directory')
  expect(await readdir(outside)).toEqual(['AGENTS.md'])
})

test('writer acquisition on a second project releases earlier claims if it is excluded', async () => {
  const a = await fixture(), b = await fixture(), exclusion = await acquireProjectMaintenanceLease(b)
  await expect(withProjectWriterLease([a, b], async () => 'unreachable')).rejects.toThrow('maintenance lease is active')
  expect(await readdir(a)).toEqual(['AGENTS.md'])
  await exclusion.release()
})

test('writer leases exclude maintenance across separate Bun processes', async () => {
  const root = await fixture()
  const worker = child(root, `import {acquireProjectWriterLease} from ${utilityImport}; const lease=await acquireProjectWriterLease(${JSON.stringify(root)}); console.log('held'); await Bun.sleep(250); await lease.release();`)
  const reader = worker.stdout.getReader()
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('held')
  await expect(acquireProjectMaintenanceLease(root)).rejects.toThrow('writer leases are active')
  expect(await worker.exited).toBe(0)
  expect(await new Response(worker.stderr).text()).toBe('')
  expect(await readdir(root)).toEqual(['AGENTS.md'])
})

test('workspace roots include cwd and external output/characters/resume ancestors', async () => {
  const a = await fixture(), b = await fixture()
  await mkdir(join(b, 'input'))
  await mkdir(join(b, 'output'))
  const roots = await resolveProjectMaintenanceRoots(a, { 'output-dir': join(b, 'output/new-run'), 'characters-root': join(b, 'input/characters') }, { outputDirs: [join(b, 'output/other-run')], input: 'https://example.com/file' })
  expect(roots).toEqual([a, b].sort())
  expect(await readdir(join(b, 'output'))).toEqual([])
})

test('explicit output destinations replace markerless cwd fallback and retain real source workspace exclusion', async () => {
  const cwd = await realpath(await temporary.make()), destination = await realpath(await temporary.make()), source = await fixture()
  await writeFile(join(source, 'recording.txt'), 'authored source')
  for (const key of ['output-root', 'output-dir']) {
    const roots = await resolveProjectMaintenanceRoots(cwd, { [key]: join(destination, 'new/nested-run') }, { input: join(source, 'recording.txt') })
    expect(roots).toEqual([destination, source].sort())
    const maintenance = await acquireProjectMaintenanceLease(source)
    try { await expect(withProjectWriterLease(roots, async () => 'unreachable')).rejects.toThrow('maintenance lease is active') }
    finally { await maintenance.release() }
    expect(await readdir(destination)).toEqual([])
  }
  expect(await resolveProjectMaintenanceRoots(cwd, {})).toEqual([cwd])
  expect(await readdir(cwd)).toEqual([])
})

test('dispatcher writes to explicit output from read-only markerless cwd and input directories', async () => {
  const cwd = await realpath(await temporary.make()), input = await realpath(await temporary.make()), destination = await realpath(await temporary.make())
  const inputPath = join(input, 'fixture.txt'), output = join(destination, 'new/nested-run')
  await writeFile(inputPath, 'authored local input')
  await chmod(inputPath, 0o444)
  await chmod(input, 0o555); await chmod(cwd, 0o555)
  try {
    const code = `
import {dispatchNativeCli} from ${JSON.stringify(join(PROJECT_ROOT, 'src/cli/native/dispatcher.ts'))};
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
const definition={name:'extract',description:'Local output fixture',parameters:[{key:'[input]'}],flags:{},handler:async(ctx)=>{
  const claims=await readdir(${JSON.stringify(join(leaseRoot(destination), 'writers'))});if(claims.length!==1)throw new Error('Destination writer lease missing');
  await mkdir(ctx.flags['output-root'],{recursive:true});await writeFile(ctx.flags['output-root']+'/extraction.txt',await readFile(ctx.parameters.input));console.log('HANDLER');
}};
const root={scriptName:'fixture',description:'fixture',version:'1',globalFlags:{'output-root':{description:'Destination',type:String}},commandGroups:[],flagGroups:[]};
await dispatchNativeCli(['extract',${JSON.stringify(inputPath)},'--output-root',${JSON.stringify(output)}],root,[definition]);`
    const proc = child(cwd, code, { AUTOSHOW_REQUIRED_IMAGE_MODEL: '' })
    const [exitCode, stdout, stderr] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()])
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' })
    expect(stdout).toContain('HANDLER')
    expect(await readFile(join(output, 'extraction.txt'), 'utf8')).toBe('authored local input')
    expect(await readdir(cwd)).toEqual([])
    expect(await readdir(input)).toEqual(['fixture.txt'])
    expect(await readdir(destination)).toEqual(['new'])
  } finally { await chmod(cwd, 0o755); await chmod(input, 0o755) }
})

test('price and unrelated read-only commands do not require writer leases', () => {
  expect(commandRequiresProjectWriterLease('comic generate-images', { price: true })).toBe(false)
  expect(commandRequiresProjectWriterLease('resume', { price: true })).toBe(false)
  expect(commandRequiresProjectWriterLease('models', {})).toBe(false)
  expect(commandRequiresProjectWriterLease('comic generate-audio', {})).toBe(true)
  expect(commandRequiresProjectWriterLease('image', {})).toBe(true)
  for (const command of ['metadata', 'links', 'voice']) {
    expect(commandRequiresProjectWriterLease(command, {})).toBe(true)
    expect(commandRequiresProjectWriterLease(command, { price: true })).toBe(false)
  }
  expect(commandRequiresProjectWriterLease('setup', {})).toBe(false)
})

const dispatchFixtureCode = (command: string, price: boolean): string => `
import {dispatchNativeCli} from ${JSON.stringify(join(PROJECT_ROOT, 'src/cli/native/dispatcher.ts'))};
const definition={name:${JSON.stringify(command)},description:'Lease fixture',flags:{price:{description:'Read only',type:Boolean},provider:{description:'Provider',type:String}},handler:async()=>console.log('HANDLER')};
const root={scriptName:'fixture',description:'fixture',version:'1',globalFlags:{help:{description:'Help',type:Boolean},version:{description:'Version',type:Boolean}},commandGroups:[],flagGroups:[]};
await dispatchNativeCli([${JSON.stringify(command)}${price ? ",'--price'" : ''}],root,[definition]);`

test('dispatcher price preflight remains write-free and can run during maintenance', async () => {
  const root = await fixture(), exclusion = await acquireProjectMaintenanceLease(root)
  const before = await readFile(join(leaseRoot(root), 'state.json'))
  const proc = child(root, dispatchFixtureCode('resume', true), { AUTOSHOW_REQUIRED_IMAGE_MODEL: '' })
  expect(await proc.exited).toBe(0)
  expect(await new Response(proc.stdout).text()).toContain('HANDLER')
  expect(await readFile(join(leaseRoot(root), 'state.json'))).toEqual(before)
  expect((await readdir(leaseRoot(root))).sort()).toEqual(['maintenance', 'state.json'])
  await exclusion.release()
})

test('dispatcher blocks mutating handlers during maintenance and singleton rejection creates no leases', async () => {
  const root = await fixture(), exclusion = await acquireProjectMaintenanceLease(root)
  const blocked = child(root, dispatchFixtureCode('resume', false), { AUTOSHOW_REQUIRED_IMAGE_MODEL: '' })
  expect(await blocked.exited).not.toBe(0)
  expect(await new Response(blocked.stdout).text()).not.toContain('HANDLER')
  expect(await new Response(blocked.stderr).text()).toContain('maintenance lease is active')
  await exclusion.release()
  const singleton = child(root, dispatchFixtureCode('image', false), { AUTOSHOW_REQUIRED_IMAGE_MODEL: 'gpt-image-2.5-sunburst' })
  expect(await singleton.exited).not.toBe(0)
  expect(await new Response(singleton.stderr).text()).toContain('exactly --provider')
  expect(await readdir(root)).toEqual(['AGENTS.md'])
})
