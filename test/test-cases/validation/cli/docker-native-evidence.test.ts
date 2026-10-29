import { afterAll, expect, test } from 'bun:test'
import { chmod, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
const repository = resolve(import.meta.dir, '../../../..')
const imageId = `sha256:${'a'.repeat(64)}`, digest = `sha256:${'b'.repeat(64)}`, revision = 'c'.repeat(40)
type Failure = 'wrong-arch' | 'wrong-revision' | 'invalid-id' | 'invalid-notices' | 'invalid-packages' | 'invalid-pins' | 'empty-rendering' | 'capture-failed'

async function capture(arch: 'amd64' | 'arm64', release: boolean, failure?: Failure, repositoryName = 'Owner/AutoShow-CLI') {
  const root = await mkdtemp(join(tmpdir(), 'docker-native-evidence-'))
  roots.push(root)
  const bin = join(root, 'bin'), source = join(root, 'src/tools'), notices = join(root, 'notices')
  await Promise.all([mkdir(bin), mkdir(source, { recursive: true }), mkdir(notices)])
  await copyFile(join(repository, 'src/tools/docker-capture-native-evidence.sh'), join(source, 'docker-capture-native-evidence.sh'))
  await copyFile(join(repository, 'src/tools/docker-image-name.sh'), join(source, 'docker-image-name.sh'))
  await Bun.write(join(notices, 'copyright'), 'Synthetic notice bytes\n')
  const archive = join(root, 'notices.tar.gz')
  const packed = Bun.spawnSync(['tar', '-czf', archive, '-C', notices, 'copyright'], { stdout: 'pipe', stderr: 'pipe' })
  expect(packed.exitCode, packed.stderr.toString()).toBe(0)
  const shim = join(root, 'docker.ts'), log = join(root, 'calls.jsonl')
  await Bun.write(shim, `import { appendFile } from 'node:fs/promises';
const args = process.argv.slice(2), env = process.env, failure = env['CAPTURE_TEST_FAILURE'];
await appendFile(env['CAPTURE_TEST_LOG'], JSON.stringify(args)+'\\n');
if(args[0] === 'info') console.log(env['CAPTURE_TEST_ARCH']);
else if(args[0] === 'pull') console.log('pulled synthetic image');
else if(args[0] === 'image' && args[1] === 'inspect') console.log(JSON.stringify([{ Id: failure === 'invalid-id' ? 'bad' : '${imageId}', Os:'linux', Architecture: failure === 'wrong-arch' ? 'wrong' : env['CAPTURE_TEST_ARCH'], Config:{Labels:{'org.opencontainers.image.revision':failure === 'wrong-revision'?'wrong':'${revision}'}} }]));
else if(args[0] === 'run') {
  const entry = args[args.indexOf('--entrypoint')+1];
  if(failure === 'capture-failed' && entry === 'dpkg-query') process.exit(9);
  switch(entry) {
    case 'dpkg-query': console.log(failure === 'invalid-packages'?'invalid':'bun\\t1.4.2\\t'+env['CAPTURE_TEST_ARCH']+'\\nfonts\\t1\\tall'); break;
    case 'tar': process.stdout.write(failure === 'invalid-notices'?Buffer.from('bad archive'):Buffer.from(await Bun.file(env['CAPTURE_TEST_NOTICES']).arrayBuffer())); break;
    case 'sh': if(failure !== 'empty-rendering') console.log('Synthetic FFmpeg filters, ImageMagick formats, and DejaVu font'); break;
    case 'bun': console.log(failure === 'invalid-pins'?'[]':JSON.stringify({'yt-dlp':{version:'2026.08.19',linuxSha256:'${'d'.repeat(64)}'}})); break;
    case 'cat': console.log(args.at(-1).includes('whisperfile')?'export const fixtureModelPins = "from-image"':'export const fixturePolicy = "from-image"'); break;
    default: throw new Error('Unexpected capture entrypoint '+entry);
  }
} else throw new Error('Unexpected Docker command');
`)
  await Bun.write(join(bin, 'docker'), '#!/bin/sh\nexec "$CAPTURE_TEST_BUN" "$CAPTURE_TEST_SHIM" "$@"\n')
  await chmod(join(bin, 'docker'), 0o755)
  const env = {
    PATH: `${bin}:${process.env['PATH'] ?? ''}`, ARCH: arch, GITHUB_SHA: revision,
    GITHUB_REPOSITORY: repositoryName, GITHUB_ENV: join(root, 'github-env'), IMAGE_DIGEST: digest,
    IMAGE_REFERENCE: `autoshow-audit:${revision}`, EVIDENCE_DIR: 'runtime/dependency-evidence',
    CAPTURE_TEST_BUN: process.execPath, CAPTURE_TEST_SHIM: shim, CAPTURE_TEST_LOG: log,
    CAPTURE_TEST_ARCH: arch, CAPTURE_TEST_NOTICES: archive, CAPTURE_TEST_FAILURE: failure ?? ''
  }
  const action = Bun.YAML.parse(await Bun.file(join(repository, '.github/actions/audit-native-image/action.yml')).text()) as { runs: { steps: Array<{ run?: string }> } }
  const command = release ? ['bash', '-c', action.runs.steps[0]!.run!] : ['bash', join(source, 'docker-capture-native-evidence.sh')]
  const child = Bun.spawn(command, { cwd: root, env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  const calls = await Bun.file(log).exists() ? (await Bun.file(log).text()).trim().split('\n').map(line => JSON.parse(line) as string[]) : []
  return { root, code, stdout, stderr, calls, evidence: join(root, release ? `runtime/ci/docker-${arch}` : 'runtime/dependency-evidence') }
}

test('exact-digest release and local audit capture preserve the same complete native evidence offline', async () => {
  for (const arch of ['amd64', 'arm64'] as const) {
    const captures = await Promise.all([capture(arch, true), capture(arch, false)])
    for (const result of captures) {
      expect(result.code, result.stderr).toBe(0)
      const evidence = await Bun.file(join(result.evidence, 'native-evidence.json')).json()
      expect(evidence.image).toMatchObject({ id: imageId, platform: `linux/${arch}`, revision })
      expect(evidence.network).toBe('none')
      const runs = result.calls.filter(args => args[0] === 'run')
      expect(runs).toHaveLength(6)
      for (const args of runs) {
        expect(args[args.indexOf('--platform') + 1]).toBe(`linux/${arch}`)
        expect(args[args.indexOf('--network') + 1]).toBe('none')
        expect(args[args.indexOf('--entrypoint') + 2]).toBe(imageId)
      }
      expect(runs.find(args => args.includes('sh'))).toContain('-ec')
      expect(await Bun.file(join(result.evidence, 'native-distribution-policy.ts')).text()).toContain('from-image')
      expect(await Bun.file(join(result.evidence, 'model-artifact-pins.ts')).text()).toContain('from-image')
      const verified = Bun.spawnSync(['sha256sum', '-c', 'SHA256SUMS'], { cwd: result.evidence, stdout: 'pipe', stderr: 'pipe' })
      expect(verified.exitCode, verified.stderr.toString()).toBe(0)
    }
    const [release, audit] = captures
    expect(release!.calls.find(args => args[0] === 'pull')).toContain(`ghcr.io/owner/autoshow-cli@${digest}`)
    expect(audit!.calls.some(args => args[0] === 'pull')).toBe(false)
    for (const file of ['debian-packages.tsv', 'rendering-capabilities.txt', 'native-source-pins.json', 'native-distribution-policy.ts', 'model-artifact-pins.ts']) {
      expect(await Bun.file(join(release!.evidence, file)).bytes()).toEqual(await Bun.file(join(audit!.evidence, file)).bytes())
    }
    for (const result of captures) {
      const notice = Bun.spawnSync(['tar', '-xOzf', join(result.evidence, 'native-notices.tar.gz'), 'copyright'], { stdout: 'pipe', stderr: 'pipe' })
      expect(notice.stdout.toString()).toBe('Synthetic notice bytes\n')
    }
  }
})

test('wrong image platform, revision, and identity stop capture before any container executes', async () => {
  for (const failure of ['wrong-arch', 'wrong-revision', 'invalid-id'] as const) {
    const result = await capture('arm64', false, failure)
    expect(result.code).not.toBe(0)
    expect(result.calls.some(args => args[0] === 'run')).toBe(false)
    expect(await Bun.file(join(result.evidence, 'native-evidence.json')).exists()).toBe(false)
  }
})

test('the release audit rejects invalid repository identities before pulling or inspecting an image', async () => {
  const result = await capture('amd64', true, undefined, 'owner/invalid repo')
  expect(result.code).toBe(2)
  expect(result.stderr).toContain('Expected a valid owner/repository identity')
  expect(result.calls).toEqual([])
  expect(await Bun.file(join(result.evidence, 'native-evidence.json')).exists()).toBe(false)
})

test('failed capture and invalid package, notice, pin, and capability artifacts cannot emit completed evidence', async () => {
  for (const failure of ['capture-failed', 'invalid-packages', 'invalid-notices', 'invalid-pins', 'empty-rendering'] as const) {
    const result = await capture('amd64', true, failure)
    expect(result.code).not.toBe(0)
    expect(await Bun.file(join(result.evidence, 'native-evidence.json')).exists()).toBe(false)
    expect(await Bun.file(join(result.evidence, 'SHA256SUMS')).exists()).toBe(false)
  }
})
