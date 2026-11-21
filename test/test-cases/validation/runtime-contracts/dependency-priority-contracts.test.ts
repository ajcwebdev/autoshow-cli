import { expect, test } from 'bun:test'
import { chmod, cp, mkdir, mkdtemp, readlink, rm, stat, symlink, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { WHISPERFILE_ARTIFACTS, WHISPERFILE_REVISION } from '~/cli/commands/stt/local/whisperfile/whisperfile-artifacts'
import { verifyWhisperfileArtifact } from '~/cli/commands/stt/local/whisperfile/whisperfile-integrity'
import models from '~/cli/commands/setup-and-utilities/models/stt-config/stt-whisperfile.json'
import { validateManagedJsRuntime } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-js-runtime'
import { defuddleRuntimeDir, validateManagedDefuddleRuntime } from '~/cli/commands/text/url/url-local/defuddle/defuddle-cli'
import { getBunBinary, PROJECT_ROOT } from '~/utils/runtime-paths'

const modulePath = (path: string): string => join(PROJECT_ROOT, 'src', path)

const copyVerifiedDefuddleRuntime = async (directory: string): Promise<void> => {
  expect((await validateManagedDefuddleRuntime()).ok).toBe(true)
  expect((await validateManagedJsRuntime('bun')).ok).toBe(true)
  await mkdir(join(directory, 'runtime/tools'), { recursive: true })
  const options = { recursive: true, verbatimSymlinks: true, filter: (source: string): boolean => basename(source) !== '.DS_Store' }
  await cp(defuddleRuntimeDir, join(directory, 'runtime/defuddle'), options)
  await cp(join(PROJECT_ROOT, 'runtime/tools/bun'), join(directory, 'runtime/tools/bun'), options)
  await mkdir(join(directory, 'runtime/bin'))
  await symlink('../tools/bun/bin/bun', join(directory, 'runtime/bin/bun'))
  expect(await readlink(join(directory, 'runtime/bin/bun'))).toBe('../tools/bun/bin/bun')
}

test('every supported Whisperfile model has an immutable digest and size', () => {
  expect(WHISPERFILE_REVISION).toMatch(/^[a-f0-9]{40}$/)
  expect(Object.keys(WHISPERFILE_ARTIFACTS).sort()).toEqual(Object.keys(models.whisperfile.models).sort())
  for (const artifact of Object.values(WHISPERFILE_ARTIFACTS)) {
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(artifact.size).toBeGreaterThan(1000)
  }
})

test('corrupt, truncated and stale caches fail without changing cached bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-artifact-integrity-'))
  try {
    const path = join(directory, 'artifact')
    const valid = 'valid synthetic executable'
    const expected = { sha256: new Bun.CryptoHasher('sha256').update(valid).digest('hex'), size: valid.length }
    await Bun.write(path, valid)
    await verifyWhisperfileArtifact(path, expected)
    expect(await Bun.file(path).text()).toBe(valid)
    for (const invalid of [valid.slice(1), 'stale synthetic executable', valid.replace('valid', 'wrong')]) {
      await Bun.write(path, invalid)
      await expect(verifyWhisperfileArtifact(path, expected)).rejects.toThrow('Cache preserved')
      expect(await Bun.file(path).text()).toBe(invalid)
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('frozen Defuddle extracts article, metadata and math with Bun', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-defuddle-fixture-'))
  try {
    const path = join(directory, 'article.html')
    await Bun.write(path, '<!doctype html><html><head><title>Fixture article</title><meta name="author" content="Fixture author"></head><body><article><h1>Fixture article</h1><p>This synthetic article explains a mathematical identity in a paragraph with enough meaningful words to survive article extraction.</p><p><math><mi>x</mi><mo>=</mo><mn>2</mn></math></p></article></body></html>')
    expect((await validateManagedDefuddleRuntime()).ok).toBe(true)
    expect((await validateManagedJsRuntime('bun')).ok).toBe(true)
    const cli = join(defuddleRuntimeDir, 'node_modules/defuddle/dist/cli.js')
    const child = Bun.spawn([getBunBinary(), '--no-env-file', cli, 'parse', path, '--markdown', '--json'], { env: { PATH: '' }, stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(15_000) })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
    const parsed = JSON.parse(stdout)
    expect(parsed.title).toBe('Fixture article')
    expect(parsed.author).toBe('Fixture author')
    expect(parsed.content).toContain('mathematical identity')
    expect(parsed.content).toContain('x')
    expect(parsed.content).toContain('2')
  } finally { await rm(directory, { recursive: true, force: true }) }
})


test('managed frozen Defuddle is reused offline with Node absent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-defuddle-offline-'))
  try {
    await copyVerifiedDefuddleRuntime(directory)
    const packageReceipt = join(directory, 'runtime/defuddle/.autoshow-package.json')
    const bunReceipt = join(directory, 'runtime/tools/bun/.autoshow-runtime.json')
    const receipts = await Promise.all([Bun.file(packageReceipt).text(), Bun.file(bunReceipt).text()])
    const source = `import {ensureDefuddleCliSetup,validateManagedDefuddleRuntime} from ${JSON.stringify(modulePath('cli/commands/text/url/url-local/defuddle/defuddle-cli.ts'))};
      import {validateManagedJsRuntime} from ${JSON.stringify(modulePath('cli/commands/setup-and-utilities/setup/setup-download/managed-js-runtime.ts'))};
      const spawn = Bun.spawn;
      const processes = [];
      let downloads = 0, installs = 0;
      globalThis.fetch = () => { downloads++; throw new Error('Offline cache attempted network'); };
      Bun.spawn = (command, options) => {
        const args = Array.isArray(command) ? command : command.cmd;
        processes.push(args);
        if (args.includes('install')) { installs++; throw new Error('Offline cache attempted installation'); }
        if (args[0] !== ${JSON.stringify(join(directory, 'runtime/bin/bun'))}) throw new Error('Unexpected tool dispatch');
        return spawn(command, options);
      };
      Bun.spawnSync = () => { throw new Error('Unexpected synchronous tool dispatch'); };
      const nodeOnPath = Bun.which('node');
      const before = [(await validateManagedDefuddleRuntime()).ok, (await validateManagedJsRuntime('bun')).ok];
      const cli = await ensureDefuddleCliSetup();
      const after = [(await validateManagedDefuddleRuntime()).ok, (await validateManagedJsRuntime('bun')).ok];
      console.log(JSON.stringify({cli, before, after, nodeOnPath, downloads, installs, processes}));`
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], { cwd: PROJECT_ROOT, env: { PATH: '', AUTOSHOW_PROJECT_ROOT: directory }, stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(20_000) })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
    const cli = join(directory, 'runtime/defuddle/node_modules/defuddle/dist/cli.js')
    expect(JSON.parse(stdout)).toEqual({ cli, before: [true, true], after: [true, true], nodeOnPath: null, downloads: 0, installs: 0,
      processes: [[join(directory, 'runtime/bin/bun'), '--no-env-file', cli, '--version']] })
    expect(await Promise.all([Bun.file(packageReceipt).text(), Bun.file(bunReceipt).text()])).toEqual(receipts)
  } finally { await rm(directory, { recursive: true, force: true }) }
}, 30_000)

test('Whisperfile setup never executes a corrupt cached bundle', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-whisperfile-execution-'))
  try {
    const bundle = join(directory, 'runtime/bin/whisperfile/whisper-tiny.llamafile')
    await Bun.write(bundle, '#!/bin/sh\nexit 0\n')
    await chmod(bundle, 0o751)
    await utimes(bundle, new Date('2020-01-02T03:04:05Z'), new Date('2020-01-02T03:04:05Z'))
    const before = await stat(bundle)
    await expect(verifyWhisperfileArtifact(bundle, WHISPERFILE_ARTIFACTS['tiny']!)).rejects.toThrow('integrity check failed')
    const source = `import {ensureWhisperfileReady} from ${JSON.stringify(modulePath('cli/commands/stt/local/whisperfile/whisperfile.ts'))};
      import {InfraError} from ${JSON.stringify(modulePath('utils/error-handler.ts'))};
      let processes = 0;
      const blockedRequests = [];
      Bun.spawn = Bun.spawnSync = () => { processes++; throw new Error('UNSAFE_EXECUTION'); };
      globalThis.fetch = (url) => { blockedRequests.push(String(url)); throw InfraError('OFFLINE_REPAIR_BLOCKED', {stage:'setup:download',retryable:false}); };
      try { await ensureWhisperfileReady('tiny'); process.exit(2); }
      catch(error) { console.log(JSON.stringify({error:error.message,stage:error.stage,processes,blockedRequests})); }`
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], { env: { PATH: '', AUTOSHOW_PROJECT_ROOT: directory }, stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(15_000) })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code, stderr).toBe(0)
    expect(JSON.parse(stdout)).toEqual({ error: 'OFFLINE_REPAIR_BLOCKED', stage: 'setup:download', processes: 0,
      blockedRequests: [`https://huggingface.co/Mozilla/whisperfile/resolve/${WHISPERFILE_REVISION}/whisper-tiny.llamafile`] })
    expect(stderr).toContain('Repairing invalid Whisperfile model tiny')
    expect(stderr).toContain('Downloading whisperfile model: tiny')
    expect(stderr).not.toMatch(/UNSAFE_EXECUTION|Retrying/)
    expect(await Bun.file(bundle).text()).toBe('#!/bin/sh\nexit 0\n')
    const after = await stat(bundle)
    for (const key of ['dev', 'ino', 'size', 'mode', 'mtimeMs', 'ctimeMs', 'nlink'] as const) expect(after[key]).toBe(before[key])
  } finally { await rm(directory, { recursive: true, force: true }) }
})
