import { afterAll, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
const digest = `sha256:${'a'.repeat(64)}`
const image = 'ghcr.io/owner/autoshow-cli'
const revision = 'c'.repeat(40)
type Call = { command: string; args: string[] }

// Stub host tools only. The real Bash helpers, jq parsing, traps, and output artifacts execute.
const shim = `import { appendFile } from 'node:fs/promises';
import { basename } from 'node:path';
const [file, ...args] = process.argv.slice(2);
const command = basename(file);
const env = process.env;
await appendFile(env['RELEASE_TEST_LOG'], JSON.stringify({command, args}) + '\\n');
switch (command) {
  case 'git': console.log('2026-10-19T12:00:00Z'); break;
  case 'date': {
    const counter = Bun.file(env['RELEASE_TEST_CLOCK']);
    const count = await counter.exists() ? Number(await counter.text()) + 1 : 1;
    await Bun.write(counter, String(count));
    console.log(String(1000000000000000000n + BigInt(count) * 1000000n));
    break;
  }
  case 'uname': console.log(env['RELEASE_TEST_HOST_ARCH']); break;
  case 'id': console.log('1001'); break;
  case 'sudo': break;
  case 'sha256sum': console.log(new Bun.CryptoHasher('sha256').update(await Bun.file(args[0]).arrayBuffer()).digest('hex') + '  ' + args[0]); break;
  case 'docker': {
    const failure = env['RELEASE_TEST_FAIL_MATCH'];
    if (failure && args.join(' ').includes(failure)) { console.error('injected Docker failure'); process.exit(17); }
    if (args[0] === 'buildx' && args[1] === 'build') {
      const path = args[args.indexOf('--metadata-file') + 1];
      await Bun.write(path, env['RELEASE_TEST_METADATA']);
    } else if (args[0] === 'info') console.log(env['RELEASE_TEST_DAEMON_ARCH']);
    else if (args[0] === 'pull') console.log('fixture image pulled');
    else if (args[0] === 'history') console.log('{}');
    else if (args[0] === 'image' && args[1] === 'inspect') console.log('12345');
    else if (args[0] === 'run') {
      if (args.at(-1) === '--version') console.log('1.4.2');
      else if (args.join(' ').includes('/sys/fs/cgroup/memory.peak')) console.log('8388608');
      else if (args.includes('setup')) console.log('Setup doctor:\\nSetup doctor completed');
      else console.log(JSON.stringify({status: 'passed'}));
    } else throw new Error('Unexpected Docker command: ' + JSON.stringify(args));
    break;
  }
  default: throw new Error('Unexpected stub: ' + command);
}
`

async function execute(helper: 'build' | 'smoke', options: {
  arch?: string; hostArch?: string; daemonArch?: string; imageDigest?: string; metadata?: string; failMatch?: string
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'docker-release-shell-'))
  roots.push(root)
  const bin = join(root, 'bin'), runnerTemp = join(root, 'temp')
  await mkdir(bin)
  await mkdir(runnerTemp)
  const shimPath = join(root, 'shim.ts')
  await Bun.write(shimPath, shim)
  await Bun.write(join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }))
  await Bun.write(join(root, 'test/fixtures/setup/managed-toolchain-smoke.pdf'), 'synthetic no-cost fixture')
  for (const command of ['git', 'date', 'uname', 'id', 'sudo', 'sha256sum', 'docker']) {
    const path = join(bin, command)
    await Bun.write(path, '#!/bin/sh\nexec "$RELEASE_TEST_BUN" "$RELEASE_TEST_SHIM" "$0" "$@"\n')
    await chmod(path, 0o755)
  }
  const arch = options.arch ?? 'amd64'
  const log = join(root, 'calls.jsonl'), output = join(root, 'github-output')
  const env = {
    PATH: `${bin}:${process.env['PATH'] ?? ''}`, HOME: root, ARCH: arch,
    IMAGE_DIGEST: options.imageDigest ?? digest, BUILD_DURATION_MS: '42',
    GITHUB_REPOSITORY: 'Owner/AutoShow-CLI', GITHUB_SHA: revision,
    GITHUB_WORKSPACE: root, GITHUB_OUTPUT: output, RUNNER_TEMP: runnerTemp,
    RELEASE_TEST_BUN: process.execPath, RELEASE_TEST_SHIM: shimPath, RELEASE_TEST_LOG: log,
    RELEASE_TEST_CLOCK: join(root, 'clock'),
    RELEASE_TEST_HOST_ARCH: options.hostArch ?? (arch === 'arm64' ? 'aarch64' : 'x86_64'),
    RELEASE_TEST_DAEMON_ARCH: options.daemonArch ?? arch,
    RELEASE_TEST_METADATA: options.metadata ?? JSON.stringify({ 'containerimage.digest': digest }),
    RELEASE_TEST_FAIL_MATCH: options.failMatch ?? ''
  }
  const helperPath = resolve(import.meta.dir, `../../../../src/tools/docker-release-${helper}.sh`)
  const child = Bun.spawn(['bash', helperPath], { cwd: root, env, stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  const calls: Call[] = await Bun.file(log).exists() ? (await Bun.file(log).text()).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as Call) : []
  return { root, code, stdout, stderr, calls, output: await Bun.file(output).exists() ? await Bun.file(output).text() : '' }
}

test('native builds export job-scoped immutable digests with provenance, SBOM, and architecture-isolated caches', async () => {
  for (const arch of ['amd64', 'arm64']) {
    const result = await execute('build', { arch })
    expect(result.code, result.stderr).toBe(0)
    const calls = result.calls.filter(call => call.command === 'docker')
    expect(calls).toHaveLength(1)
    const args = calls[0]!.args
    expect(args.slice(0, 2)).toEqual(['buildx', 'build'])
    expect(args[args.indexOf('--platform') + 1]).toBe(`linux/${arch}`)
    expect(args[args.indexOf('--target') + 1]).toBe('production')
    expect(args).toContain(`VCS_REF=${revision}`)
    expect(args).toContain('AUTOSHOW_VERSION=1.2.3')
    expect(args).toContain('--provenance=mode=max')
    expect(args).toContain('--sbom=true')
    expect(args).toContain(`type=registry,ref=${image}:buildcache-${arch}`)
    expect(args).toContain(`type=registry,ref=${image}:buildcache-${arch},mode=max`)
    expect(args).toContain(`type=image,name=${image},push-by-digest=true,name-canonical=true,push=true`)
    expect(args).not.toContain('--tag')
    expect(args.join(' ')).not.toContain(':latest')
    expect(result.output).toBe(`digest=${digest}\nbuild_duration_ms=1\n`)
    expect(await Bun.file(args[args.indexOf('--metadata-file') + 1]!).exists()).toBe(false)
  }
})

test('failed builds and corrupt build metadata cannot export a digest and remove only their owned metadata file', async () => {
  for (const options of [
    { failMatch: 'buildx build' }, { metadata: '{}' }, { metadata: '{invalid' },
    ...['sha256:short', `${digest}\n`, ` ${digest}`, 123].map(value => ({ metadata: JSON.stringify({ 'containerimage.digest': value }) }))
  ]) {
    const result = await execute('build', options)
    expect(result.code).not.toBe(0)
    expect(result.output).toBe('')
    const build = result.calls.find(call => call.command === 'docker')!.args
    expect(await Bun.file(build[build.indexOf('--metadata-file') + 1]!).exists()).toBe(false)
    expect(await Bun.file(join(result.root, 'package.json')).exists()).toBe(true)
  }
})

test('unsupported architectures and invalid smoke digest inputs fail before Docker executes', async () => {
  for (const helper of ['build', 'smoke'] as const) {
    const result = await execute(helper, { arch: 'riscv64' })
    expect(result.code).not.toBe(0)
    expect(result.calls.some(call => call.command === 'docker')).toBe(false)
  }
  for (const imageDigest of ['sha256:short', `${digest}\n`, ` ${digest}`]) {
    const result = await execute('smoke', { imageDigest })
    expect(result.code).not.toBe(0)
    expect(result.calls.some(call => call.command === 'docker')).toBe(false)
  }
})

test('native smoke dispatches the installed dependency verifier, every container offline, both state users, and exact-digest measurements', async () => {
  for (const arch of ['amd64', 'arm64']) {
    const result = await execute('smoke', { arch })
    expect(result.code, result.stderr).toBe(0)
    const docker = result.calls.filter(call => call.command === 'docker').map(call => call.args)
    expect(docker.find(args => args[0] === 'pull')).toEqual(['pull', '--platform', `linux/${arch}`, `${image}@${digest}`])
    const runs = docker.filter(args => args[0] === 'run')
    expect(runs.length).toBeGreaterThan(10)
    for (const run of runs) {
      expect(run[run.indexOf('--network') + 1]).toBe('none')
      expect(run[run.indexOf('--platform') + 1]).toBe(`linux/${arch}`)
      expect(run).toContain(`${image}@${digest}`)
      expect(run).not.toContain('install')
      expect(run).not.toContain('--env-file')
      expect(run).not.toContain(`${image}:latest`)
    }
    const verifier = runs.filter(args => args.includes('src/tools/docker-installed-dependencies.ts'))
    expect(verifier).toHaveLength(3)
    expect(verifier.every(args => args.includes('--no-env-file'))).toBe(true)
    const state = verifier.filter(args => args.includes('--state'))
    expect(state).toHaveLength(2)
    expect(state[0]).not.toContain('--user')
    expect(state[1]?.slice(state[1].indexOf('--user'), state[1].indexOf('--user') + 2)).toEqual(['--user', '1001:1001'])
    for (const args of state) {
      for (const target of ['/app/runtime', '/home/bun', '/app/input', '/app/output']) expect(args.some(arg => arg.endsWith(`dst=${target}`))).toBe(true)
    }
    const rendering = runs.find(args => args.includes('/app/test/docker-acceptance/native-image-acceptance.ts'))!
    expect(rendering.at(-1)).toBe(arch === 'amd64' ? 'x64' : 'arm64')
    expect(rendering.some(arg => arg.endsWith('dst=/app/test/docker-acceptance/native-image-acceptance.ts,readonly'))).toBe(true)
    const measurements = await Bun.file(join(result.root, `runtime/ci/docker-${arch}/measurements.json`)).json()
    expect(measurements.platform).toBe(`linux/${arch}`)
    expect(measurements.digest).toBe(digest)
    expect(measurements.measurements).toMatchObject({ buildDurationMs: 42, imageSizeBytes: 12345, fixturePeakRssBytes: [8388608, 8388608, 8388608] })
    expect(measurements.measurements.coldHelpWallMs).toEqual([1, 1, 1, 1, 1])
    expect(measurements.fixture.sha256).toBe(new Bun.CryptoHasher('sha256').update('synthetic no-cost fixture').digest('hex'))
  }
})

test('cross-architecture hosts and daemons stop smoke before any image pull or container', async () => {
  for (const options of [{ hostArch: 'aarch64' }, { daemonArch: 'arm64' }]) {
    const result = await execute('smoke', options)
    expect(result.code).not.toBe(0)
    expect(result.calls.some(call => call.command === 'docker' && ['pull', 'run'].includes(call.args[0]!))).toBe(false)
  }
})

test('failed image pulls or installed graph validation stop smoke without successful acceptance or measurement artifacts', async () => {
  for (const failMatch of ['pull --platform', 'docker-installed-dependencies.ts']) {
    const result = await execute('smoke', { failMatch })
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('injected Docker failure')
    expect(await Bun.file(join(result.root, 'docs/reports/release-evidence/amd64/native-acceptance.json')).exists()).toBe(false)
    expect(await Bun.file(join(result.root, 'runtime/ci/docker-amd64/measurements.json')).exists()).toBe(false)
    expect(result.calls.some(call => call.command === 'docker' && call.args.includes('install'))).toBe(false)
  }
})
