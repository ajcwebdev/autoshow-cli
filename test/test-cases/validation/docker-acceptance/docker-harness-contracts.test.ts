import { afterAll, expect, test } from 'bun:test'
import { chmod, mkdtemp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { DockerEngine, containerArguments, mapArtifactPath } from '../../../docker-acceptance/docker-engine'
import { REQUESTED_IMAGE, parseDockerOptions } from '../../../docker-acceptance/docker-options'
import { createDockerProcessRunner, dockerClientEnvironment } from '../../../../src/tools/docker-process'
import type { ProcessRunner } from '../../../../src/tools/docker-process'
import { acceptancePassed, discoverOutputDir, runDockerAcceptance } from '../../../docker-acceptance/docker-runner'
import { dockerScenarios, mappedManifest, MODEL_SELECTORS, selectDockerScenarios } from '../../../docker-acceptance/docker-scenarios'
import { containerFixture } from '../../../docker-acceptance/docker-fixtures'
import { rejectionScenarios } from '../../../scenarios/local-cli-contracts'
import { acquireAcceptanceCacheLease, releaseAcceptanceCacheLease } from '../../../docker-acceptance/docker-cache-lease'
import type { LocalExecutionAdapter } from '../../../scenarios/local-cli-contracts'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
const digest = `sha256:${'a'.repeat(64)}`
const pinned = `ghcr.io/ajcwebdev/autoshow-cli@${digest}`

async function harness(options: { pullFails?: boolean; timeout?: boolean; imageArchitecture?: string; imageDigest?: string } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-docker-contract-'))
  roots.push(root)
  const calls: string[][] = []
  const runner: ProcessRunner = async (args, _timeout, _log, onTimeout) => {
    calls.push(args)
    let stdout = ''
    let exitCode = 0
    let timedOut = false
    if (args[0] === 'info') stdout = '"aarch64"'
    if (args[0] === 'pull') { stdout = `Digest: ${digest}\n`; if (options.pullFails) exitCode = 1 }
    if (args[0] === 'image' && args.includes('--platform')) {
      return { exitCode: 125, stdout: '', stderr: 'unknown flag: --platform', timedOut: false, durationMs: 1 }
    }
    if (args[0] === 'image') stdout = JSON.stringify([{
      Id: `sha256:${'d'.repeat(64)}`, Os: 'linux', Architecture: options.imageArchitecture ?? 'arm64', Size: 123,
      RepoDigests: [options.imageDigest ?? pinned], Config: { User: 'bun', Entrypoint: ['bun', '--no-env-file', '/app/src/cli/create-cli.ts'], Env: ['HOME=/home/bun'], Labels: { 'org.opencontainers.image.revision': 'c'.repeat(40) } }
    }])
    if (args[0] === 'run' && options.timeout) { await onTimeout?.(); exitCode = 137; timedOut = true }
    return { exitCode, stdout, stderr: exitCode ? 'fixture failure' : '', timedOut, durationMs: 1 }
  }
  const engine = new DockerEngine(parseDockerOptions(['--output', join(root, 'evidence'), '--cache', join(root, 'cache')]), runner)
  return { engine, calls, root }
}

test('pull failure never inspects a cached tag or runs a container', async () => {
  const { engine, calls } = await harness({ pullFails: true })
  await expect(engine.resolveImage()).rejects.toThrow(`Pull ${REQUESTED_IMAGE} failed`)
  expect(calls.map(call => call[0])).toEqual(['info', 'pull'])
  expect(engine.identity).toBeUndefined()
})

test('failed image resolution produces a failed report with zero executions', async () => {
  const { engine } = await harness({ pullFails: true })
  const logged: string[] = []
  const errored: string[] = []
  expect(await runDockerAcceptance(engine.options, engine, { log: line => logged.push(line), error: line => errored.push(line) })).toBe(1)
  expect(errored).toHaveLength(1)
  expect(errored[0]).toStartWith('image-resolution: ')
  expect(logged.at(-1)).toMatch(/^0\/\d+ passed\. Evidence: /)
  const report = await Bun.file(join(engine.options.output, 'results.json')).json()
  expect(report.passed).toBe(false)
  expect(report.selectedCount).toBeGreaterThan(0)
  expect(report.executedCount).toBe(0)
  expect(report.errors[0]).toContain(`Pull ${REQUESTED_IMAGE} failed`)
})

test('latest is pulled once and all CLI and helper containers use its immutable digest', async () => {
  const { engine, calls } = await harness()
  const identity = await engine.resolveImage()
  await engine.prepareMounts()
  const args = ['download', '/fixtures/audio with spaces;$(touch nope)`x`.mp3']
  engine.authorize(args, 'none')
  await engine.cli(args, 'literal', 'none')
  await engine.container(['-v', 'error', '/results/literal/video.mp4'], 'none', 100, 'ffprobe')
  expect(identity.digest).toBe(digest)
  expect(calls.filter(call => call[0] === 'pull')).toEqual([['pull', '--platform', 'linux/arm64', REQUESTED_IMAGE]])
  expect(calls.find(call => call[0] === 'image')).toEqual(['image', 'inspect', pinned])
  const runs = calls.filter(call => call[0] === 'run')
  expect(runs).toHaveLength(2)
  for (const run of runs) {
    expect(run).toContain(pinned)
    expect(run).not.toContain(REQUESTED_IMAGE)
    expect(run).not.toContain('--env-file')
    expect(run).not.toContain('--user')
    expect(run).toContain('never')
  }
  expect(runs[0]).not.toContain('--entrypoint')
  expect(runs[0]?.slice(runs[0].indexOf(pinned) + 1, runs[0].indexOf(pinned) + 3)).toEqual(args)
  expect(runs[0]?.join('\n')).toContain('dst=/app/runtime')
  expect(runs[0]?.join('\n')).not.toContain('dst=/app,')
  expect(runs[0]).toContain('/fixtures/empty-config.json')
})

test('cross-architecture requests fail before pulling and unexpected publication digest fails before execution', async () => {
  const { engine, calls } = await harness()
  engine.options.platform = 'linux/amd64'
  await expect(engine.resolveImage()).rejects.toThrow('not native')
  expect(calls).toHaveLength(1)
  engine.options.platform = 'linux/arm64'
  engine.options.expectedDigest = `sha256:${'b'.repeat(64)}`
  await expect(engine.resolveImage()).rejects.toThrow('differs from the expected digest')
  expect(calls.some(call => call[0] === 'run')).toBe(false)
})

test('native digest inspection rejects a mismatched architecture or digest before execution', async () => {
  for (const [options, message] of [
    [{ imageArchitecture: 'amd64' }, 'Selected architecture differs from native daemon'],
    [{ imageDigest: `ghcr.io/ajcwebdev/autoshow-cli@sha256:${'b'.repeat(64)}` }, 'Image inspection did not confirm the selected manifest digest']
  ] as const) {
    const { engine, calls } = await harness(options)
    await expect(engine.resolveImage()).rejects.toThrow(message)
    expect(engine.identity).toBeUndefined()
    expect(calls.some(call => call[0] === 'run')).toBe(false)
  }
})

test('unregistered commands and network changes fail before Docker execution', async () => {
  const { engine, calls } = await harness()
  await engine.resolveImage()
  engine.authorize(['write', '/fixtures/text.md', '--price'], 'none')
  await expect(engine.cli(['write', '/fixtures/text.md'], 'unsafe', 'none')).rejects.toThrow('allowlist')
  await expect(engine.cli(['write', '/fixtures/text.md', '--price'], 'unsafe', 'bridge')).rejects.toThrow('allowlist')
  expect(calls.some(call => call[0] === 'run')).toBe(false)
})

test('timeout and interruption cleanup target only owned containers and retain mounts', async () => {
  const { engine, calls } = await harness({ timeout: true })
  await engine.resolveImage()
  await engine.prepareMounts()
  const sentinel = join(engine.options.output, 'outputs', 'paid-work-is-never-deleted.txt')
  await Bun.write(sentinel, 'keep')
  const result = await engine.container(['--help'], 'none', 10)
  expect(result.timedOut).toBe(true)
  const removals = calls.filter(call => call[0] === 'rm')
  expect(removals).toHaveLength(1)
  expect(removals[0]?.[2]).toStartWith(engine.runId)
  await engine.removeOwned('somebody-elses-container')
  await engine.cleanup()
  expect(calls.filter(call => call[0] === 'rm')).toEqual(removals)
  expect(await Bun.file(sentinel).text()).toBe('keep')
  engine.interrupted = true
  await expect(engine.container(['--help'], 'none', 10)).rejects.toThrow('interrupted')
})

test('real subprocess deadline kills the Docker client, invokes cleanup, and retains logs', async () => {
  const { root } = await harness()
  const fakeDocker = join(root, 'docker')
  await Bun.write(fakeDocker, '#!/bin/sh\nprintf \'%s\\n\' "${OPENAI_API_KEY:-isolated}"\nexec /bin/sleep 10\n')
  await chmod(fakeDocker, 0o755)
  const run = createDockerProcessRunner(fakeDocker, { PATH: process.env['PATH'], HOME: root, OPENAI_API_KEY: 'never-forward-this' })
  let cleaned = 0
  const prefix = join(root, 'deadline')
  const result = await run(['run', 'literal argument'], 1000, prefix, async () => { cleaned++ })
  expect(result.timedOut).toBe(true)
  expect(result.exitCode).not.toBe(0)
  expect(result.durationMs).toBeLessThan(3000)
  expect(cleaned).toBe(1)
  expect(result.stdout).toBe('isolated\n')
  expect(await Bun.file(`${prefix}.stdout.log`).text()).toBe('isolated\n')
})

test('Docker client environment never includes credentials, provider overrides, or host dotenv settings', () => {
  expect(dockerClientEnvironment({ PATH: '/bin', HOME: '/home/test', DOCKER_CONTEXT: 'desktop-linux', OPENAI_API_KEY: 'secret', MISTRAL_API_KEY: 'secret', AUTOSHOW_PROJECT_ROOT: '/checkout', BUN_ENV_FILE: '.env', HTTPS_PROXY: 'secret' })).toEqual({ PATH: '/bin', HOME: '/home/test', DOCKER_CONTEXT: 'desktop-linux' })
})

test('restored state keeps its permissions and explicit host identity is checked without root repair', async () => {
  const { engine, calls } = await harness()
  await engine.resolveImage()
  engine.options.user = '1001:1001'
  engine.options.restricted = true
  const runtime = join(engine.options.cache, 'linux-arm64', 'runtime')
  await mkdir(runtime, { recursive: true, mode: 0o750 })
  await Bun.write(join(runtime, 'protected-paid-asset.txt'), 'preserved')
  await engine.prepareMounts()
  await engine.verifyStateAccess()
  expect((await stat(runtime)).mode & 0o777).toBe(0o750)
  expect(await Bun.file(join(runtime, 'protected-paid-asset.txt')).text()).toBe('preserved')
  const run = calls.find(call => call[0] === 'run')!
  expect(run[run.indexOf('--user') + 1]).toBe('1001:1001')
  expect(run[run.indexOf('--cap-drop') + 1]).toBe('ALL')
  expect(run).toContain('no-new-privileges:true')
  expect(run).toContain('AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1')
  expect(run).not.toContain('chown')
  expect(run).toContain('none')
  expect(run.join('\n')).toContain('dst=/fixtures,readonly')
})

test('runtime options reject root and malformed users before any Docker process', () => {
  for (const user of ['0:0', '000:1000', '-1:1', 'bun', '1:4294967295', '4294967295:1', '1:1 --privileged']) {
    expect(() => parseDockerOptions(['--user', user])).toThrow('non-root numeric UID:GID')
  }
  const selected = parseDockerOptions(['--user', '1234:5678', '--restricted'])
  expect(selected.user).toBe('1234:5678')
  expect(selected.restricted).toBe(true)
  expect(parseDockerOptions([]).user).toBeUndefined()
  expect(parseDockerOptions([]).restricted).toBe(false)
  expect(() => parseDockerOptions(['--restricted', '--restricted'])).toThrow('Repeated option')
})

test('shared caches are leased exclusively and cleanup never removes replacement ownership or unknown files', async () => {
  const { root } = await harness()
  const cache = join(root, 'leased-cache')
  const owner = { runId: 'first-run', pid: process.pid, output: 'evidence', startedAt: '2026-10-26T00:00:00Z' }
  const lease = await acquireAcceptanceCacheLease(cache, owner)
  const original = await Bun.file(join(lease.path, 'owner.json')).text()
  await expect(acquireAcceptanceCacheLease(cache, { ...owner, runId: 'second-run' })).rejects.toThrow('Cache already in use')
  expect(await Bun.file(join(lease.path, 'owner.json')).text()).toBe(original)
  await expect(releaseAcceptanceCacheLease({ ...lease, runId: 'somebody-else' })).rejects.toThrow('ownership changed')
  expect(await Bun.file(join(lease.path, 'owner.json')).text()).toBe(original)
  await Bun.write(join(lease.path, 'unknown-asset'), 'keep')
  await expect(releaseAcceptanceCacheLease(lease)).rejects.toThrow('unexpected files')
  expect(await Bun.file(join(lease.path, 'unknown-asset')).text()).toBe('keep')
  await rm(join(lease.path, 'unknown-asset'))
  await releaseAcceptanceCacheLease(lease)
  expect(await readdir(cache)).toEqual([])
  const reused = await acquireAcceptanceCacheLease(cache, { ...owner, runId: 'next-run' })
  await releaseAcceptanceCacheLease(reused)
})

test('mount mapping handles absolute and relative batch paths, spaces, and rejects traversal', async () => {
  const { engine } = await harness()
  await engine.resolveImage()
  await engine.prepareMounts()
  expect(mapArtifactPath('/results/batch/a b/file.mp4', engine.mounts)).toBe(join(engine.options.output, 'outputs/batch/a b/file.mp4'))
  expect(mapArtifactPath('child/file.mp4', engine.mounts, '/results/batch')).toBe(join(engine.options.output, 'outputs/batch/child/file.mp4'))
  expect(() => mapArtifactPath('../../etc/passwd', engine.mounts)).toThrow('outside')
  expect(() => mapArtifactPath('/results-neighbor/manifest.json', engine.mounts)).toThrow('outside')
  expect(() => containerArguments(engine.identity!, 'name', 'owner', [{ host: '/checkout', container: '/app' }], 'none', ['help'])).toThrow('replace image source')
  const manifestDir = join(engine.options.output, 'outputs', 'batch')
  const manifest = { command: 'download', scope: 'batch', items: [{ outputDir: '/results/batch/child', metadata: { artifact: '/results/batch/child/audio.mp3' } }] }
  await Bun.write(join(manifestDir, 'manifest.json'), JSON.stringify(manifest))
  const adapter = { hostPath: (path: string) => mapArtifactPath(path, engine.mounts) } as LocalExecutionAdapter
  const mapped = await mappedManifest(adapter, manifestDir)
  expect(mapped.items[0]?.outputDir).toBe(join(manifestDir, 'child'))
  expect(await Bun.file(join(manifestDir, 'manifest.json')).json()).toEqual(manifest)
})

test('every recommended selector executes inference and CI contains every native shard', async () => {
  const all = selectDockerScenarios({ suite: 'all' })
  expect(MODEL_SELECTORS).toHaveLength(4)
  for (const model of MODEL_SELECTORS) {
    const cases = selectDockerScenarios({ suite: 'models', model })
    expect(cases.length).toBeGreaterThan(0)
    expect(cases.some(item => item.args[0] === 'extract' && item.args.includes(model.replace(':', '=')))).toBe(true)
    expect(cases.every(item => item.network === 'none')).toBe(true)
  }
  expect(() => selectDockerScenarios({ suite: 'models', model: 'whisperfile:unknown' })).toThrow('No scenarios')
  expect(() => selectDockerScenarios({ suite: 'all' }, all.filter(item => item.model !== 'whisperfile:small'))).toThrow('Missing inference')
  const workflow = Bun.YAML.parse(await Bun.file('.github/workflows/docker-publish.yml').text()) as {
    concurrency: { 'cancel-in-progress': boolean | string; group: string }
    jobs: Record<string, { needs?: string | string[]; if?: string; 'runs-on'?: string; strategy?: { 'fail-fast': boolean; matrix: { arch: string[]; shard: string[] } }; steps?: Array<{ if?: string; uses?: string; with?: Record<string, string> }> }>
  }
  // Pushes share one serialized lock and are never cancelled so a publication cannot be interrupted mid-run;
  // only superseded pull-request runs are cancelled. Bun.YAML keeps the unquoted expression as a string.
  expect(workflow.concurrency.group).toBe("autoshow-ghcr-${{ github.event_name == 'push' && 'latest' || github.ref }}")
  expect(workflow.concurrency['cancel-in-progress']).toBe("${{ github.event_name == 'pull_request' }}")
  const job = workflow.jobs['acceptance']!
  expect(job.needs).toBe('publish-manifest')
  expect(job.strategy?.matrix.arch).toEqual(['amd64', 'arm64'])
  expect(job.strategy?.matrix.shard).toEqual(['core', 'network', ...MODEL_SELECTORS])
  expect(job.strategy?.['fail-fast']).toBe(false)
  expect(job['runs-on']).toContain('ubuntu-24.04-arm')
  expect(job.steps?.find(step => step.uses?.startsWith('actions/upload-artifact'))?.if).toBe('always()')
  const restore = job.steps?.find(step => step.uses?.startsWith('actions/cache/restore@'))
  expect(restore?.with?.['key']).toMatch(/^docker-local-v1-\$\{\{ matrix\.arch \}\}-\$\{\{ matrix\.shard \}\}-\$\{\{ hashFiles\('Dockerfile', /)
  expect(restore?.with?.['key']).not.toMatch(/run_id|run_attempt|run_number/)
  expect(restore?.with?.['restore-keys']).toBe('docker-local-v1-${{ matrix.arch }}-${{ matrix.shard }}-')
  const save = job.steps?.find(step => step.uses?.startsWith('actions/cache/save@'))
  expect(save?.if).toBe("always() && steps.assets.outputs.cache-hit != 'true'")
  expect(save?.with?.['key']).toBe('${{ steps.assets.outputs.cache-primary-key }}')
  expect(workflow.jobs['acceptance-required']?.needs).toEqual(['changes', 'publish-manifest', 'acceptance'])
  expect(workflow.jobs['promote-latest']?.needs).toEqual(['changes', 'publish-manifest', 'acceptance-required', 'build-amd64', 'build-arm64'])
  expect(workflow.jobs['promote-latest']?.if).not.toContain('always()')
})

test('zero selected/executed cases and incomplete runs cannot pass', async () => {
  expect(acceptancePassed(0, [], [])).toBe(false)
  expect(acceptancePassed(1, [], [])).toBe(false)
  expect(acceptancePassed(1, [{ id: 'a', category: 'local', status: 'passed', durationMs: 1 }], ['pull failed'])).toBe(false)
  expect(acceptancePassed(1, [{ id: 'a', category: 'local', status: 'passed', durationMs: 1 }], [])).toBe(true)
  const { root } = await harness()
  expect(await discoverOutputDir(root)).toBeNull()
  await mkdir(join(root, 'empty'))
  expect(await discoverOutputDir(root)).toBeNull()
})

test('no-cost service CLI rejections are imported as data and require disabled networking', () => {
  const cases = dockerScenarios()
  const rejections = rejectionScenarios(containerFixture)
  expect(rejections.map(item => item.id)).toStrictEqual([
    'reject-mistral-tts', 'reject-tts-reference', 'reject-unknown-bfl', 'reject-gemini-lite-size',
    'reject-openai-image-count', 'reject-grok-image-format', 'reject-gemini-video-duration', 'reject-music-provider'
  ])
  for (const rejection of rejections) {
    const scenario = cases.find(item => item.id === rejection.id)!
    expect(scenario.network).toBe('none')
    expect(scenario.args).toEqual(rejection.args)
    expect(rejection.exitCode).toBe(2)
  }
})

test('current image and video control rejections execute without credentials, network requests, or run outputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-service-rejections-'))
  roots.push(root)
  const configPath = join(root, 'empty-config.json')
  const networkAttempt = join(root, 'network-attempt.txt')
  const preload = join(root, 'deny-network.mjs')
  await Bun.write(configPath, '{}')
  await Bun.write(preload, `
    import { writeFileSync } from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    import http from 'node:http';
    import https from 'node:https';
    import net from 'node:net';
    import tls from 'node:tls';
    const deny = () => { writeFileSync(${JSON.stringify(networkAttempt)}, 'blocked'); throw new Error('Network requests are disabled for rejection contracts'); };
    globalThis.fetch = deny;
    http.request = http.get = https.request = https.get = deny;
    net.connect = net.createConnection = tls.connect = deny;
    Bun.connect = deny;
    syncBuiltinESMExports();
  `)
  const currentIds = new Set(['reject-openai-image-count', 'reject-grok-image-format', 'reject-gemini-video-duration'])
  const selected = rejectionScenarios(name => join(root, name)).filter(scenario => currentIds.has(scenario.id))
  expect(selected).toHaveLength(3)
  for (const scenario of selected) {
    expect(scenario.args).toContain('--price')
    const outputRoot = join(root, scenario.id)
    const child = Bun.spawn([process.execPath, '--no-env-file', '--preload', preload, resolve('src/cli/create-cli.ts'), ...scenario.args, '--config-path', configPath, '--output-root', outputRoot, '--no-color'], {
      env: { PATH: process.env['PATH'], NO_COLOR: '1', CI: 'true' }, stdout: 'pipe', stderr: 'pipe'
    })
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(exitCode, stderr).toBe(2)
    expect(`${stdout}\n${stderr}`).toContain(scenario.diagnostic)
    for (const absent of scenario.absent ?? []) expect(`${stdout}\n${stderr}`).not.toContain(absent)
    expect(await Bun.file(networkAttempt).exists()).toBe(false)
    expect(await readdir(outputRoot).catch(() => [])).toStrictEqual([])
  }
}, 15_000)

test('runner parsing bounds timeouts and preserves native model selection', () => {
  expect(parseDockerOptions([]).suite).toBe('all')
  expect(() => parseDockerOptions(['--model', 'whisperfile:tiny'])).toThrow('requires')
  expect(() => parseDockerOptions(['--case-timeout', '0'])).toThrow('1–7200')
  expect(() => parseDockerOptions(['--setup-timeout', '8000'])).toThrow('1–7200')
  expect(() => parseDockerOptions(['--suite', 'core', '--suite', 'all'])).toThrow('Repeated')
  expect(() => parseDockerOptions(['--output', '/tmp/a,b'])).toThrow('commas')
})

test('production image has no dedicated STT compiler layer', async () => {
  expect(await Bun.file('Dockerfile').text()).not.toContain('cmake make gcc g++ libc6-dev')
})

test('acceptance guards and strict matchers run standalone with useful diagnostics', async () => {
  const guard = resolve('test/test-utils/require-condition.ts')
  const source = `import { expect } from 'bun:test';
    import { requireCondition } from ${JSON.stringify(guard)};
    requireCondition({ ok: true }, 'present');
    expect({ a: [1, 2] }).toStrictEqual({ a: [1, 2] });
    expect(() => expect({ a: undefined }).toStrictEqual({})).toThrow();
    expect(() => expect([, 1]).toStrictEqual([undefined, 1])).toThrow();
    requireCondition(null, 'fixture guard failed');`
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], {
    env: { PATH: process.env['PATH'] }, stdout: 'pipe', stderr: 'pipe'
  })
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  expect(code).toBe(1)
  expect(stderr).toContain('fixture guard failed')
})
