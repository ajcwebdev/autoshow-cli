import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WHISPERFILE_ARTIFACTS, WHISPERFILE_REVISION } from '~/cli/commands/stt/local/whisperfile/whisperfile-artifacts'
import { verifyWhisperfileArtifact } from '~/cli/commands/stt/local/whisperfile/whisperfile-integrity'
import models from '~/cli/commands/setup-and-utilities/models/stt-config/stt-whisperfile.json'

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
    const cli = join(process.cwd(), 'config/defuddle/node_modules/defuddle/dist/cli.js')
    const child = Bun.spawn([process.execPath, '--no-env-file', cli, 'parse', path, '--markdown', '--json'], { env: { PATH: '' }, stdout: 'pipe', stderr: 'pipe' })
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
    await mkdir(join(directory, 'config'), { recursive: true })
    await cp(join(process.cwd(), 'config/defuddle'), join(directory, 'config/defuddle'), { recursive: true, verbatimSymlinks: true })
    await cp(join(process.cwd(), 'config/defuddle'), join(directory, 'runtime/defuddle'), { recursive: true, verbatimSymlinks: true })
    await Bun.write(join(directory, 'runtime/defuddle/.frozen-install'), '0.19.3\n')
    const module = join(process.cwd(), 'src/cli/commands/text/url/url-local/defuddle/defuddle-cli.ts')
    const source = `import {ensureDefuddleCliSetup} from ${JSON.stringify(module)};
      const spawn = Bun.spawn;
      Bun.spawn = (args, options) => { if (args.includes('install')) throw new Error('Offline cache attempted installation'); return spawn(args, options); };
      console.log(await ensureDefuddleCliSetup());`
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], { cwd: process.cwd(), env: { PATH: '', AUTOSHOW_PROJECT_ROOT: directory }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
    expect(stdout).toContain(join(directory, 'runtime/defuddle/node_modules/defuddle/dist/cli.js'))
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('Whisperfile setup never executes a corrupt cached bundle', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-whisperfile-execution-'))
  try {
    const bundle = join(directory, 'runtime/bin/whisperfile/whisper-tiny.llamafile')
    await Bun.write(bundle, '#!/bin/sh\nexit 0\n')
    const module = join(process.cwd(), 'src/cli/commands/stt/local/whisperfile/whisperfile.ts')
    const source = `import {ensureWhisperfileReady} from ${JSON.stringify(module)};
      Bun.spawn = () => { throw new Error('UNSAFE_EXECUTION'); };
      globalThis.fetch = () => { throw new Error('UNEXPECTED_NETWORK'); };
      try { await ensureWhisperfileReady('tiny'); process.exit(2); } catch(error) { console.log(String(error)); }`
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], { env: { PATH: '', AUTOSHOW_PROJECT_ROOT: directory }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
    expect(stdout).toContain('integrity check failed')
    expect(stdout).not.toContain('UNSAFE_EXECUTION')
    expect(await Bun.file(bundle).text()).toBe('#!/bin/sh\nexit 0\n')
  } finally { await rm(directory, { recursive: true, force: true }) }
})
