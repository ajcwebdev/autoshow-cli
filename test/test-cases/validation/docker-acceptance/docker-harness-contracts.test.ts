import { afterAll, expect, test } from 'bun:test'
import { chmod, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DockerEngine, containerArguments, mapArtifactPath } from '../../../../scripts/docker-acceptance/docker-engine'
import { REQUESTED_IMAGE, parseDockerOptions } from '../../../../scripts/docker-acceptance/docker-options'
import { createDockerProcessRunner, dockerClientEnvironment } from '../../../../scripts/docker-acceptance/docker-process'
import type { ProcessRunner } from '../../../../scripts/docker-acceptance/docker-process'
import { acceptancePassed, discoverOutputDir, runDockerAcceptance } from '../../../../scripts/docker-acceptance/docker-runner'
import { whisperToolchainLayer } from '../../../../scripts/docker-acceptance/measure-whisper-toolchain'
import { dockerScenarios, mappedManifest, MODEL_SELECTORS, selectDockerScenarios } from '../../../../scripts/docker-acceptance/docker-scenarios'
import { containerFixture } from '../../../../scripts/docker-acceptance/docker-fixtures'
import { rejectionScenarios } from '../../../scenarios/local-cli-contracts'
import type { LocalExecutionAdapter } from '../../../scenarios/local-cli-contracts'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
const digest = `sha256:${'a'.repeat(64)}`
const pinned = `ghcr.io/ajcwebdev/autoshow-cli@${digest}`

async function harness(options: { pullFails?: boolean; timeout?: boolean } = {}) {
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
    if (args[0] === 'image') stdout = JSON.stringify([{
      Id: 'sha256:local-config', Os: 'linux', Architecture: 'arm64', Size: 123,
      RepoDigests: [pinned], Config: { User: 'bun', Entrypoint: ['bun', '--no-env-file', '/app/src/cli/create-cli.ts'], Env: ['HOME=/home/bun'], Labels: { 'org.opencontainers.image.revision': 'c'.repeat(40) } }
    }])
    if (args[0] === 'run' && options.timeout) { await onTimeout?.(); exitCode = 137; timedOut = true }
    return { exitCode, stdout, stderr: exitCode ? 'fixture failure' : '', timedOut, durationMs: 1 }
  }
  const engine = new DockerEngine(parseDockerOptions(['--output', join(root, 'evidence'), '--cache', join(root, 'cache')]), runner)
  return { engine, calls, root }
}

test('pull failure never inspects a cached tag or runs a container', async () => {
  const { engine, calls } = await harness({ pullFails: true })
  await expect(engine.resolveImage()).rejects.toThrow('Pull latest failed')
  expect(calls.map(call => call[0])).toEqual(['info', 'pull'])
  expect(engine.identity).toBeUndefined()
})

test('failed image resolution produces a failed report with zero executions', async () => {
  const { engine } = await harness({ pullFails: true })
  expect(await runDockerAcceptance(engine.options, engine)).toBe(1)
  const report = await Bun.file(join(engine.options.output, 'results.json')).json()
  expect(report.passed).toBe(false)
  expect(report.selectedCount).toBeGreaterThan(0)
  expect(report.executedCount).toBe(0)
  expect(report.errors[0]).toContain('Pull latest failed')
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
  expect(calls.find(call => call[0] === 'image')).toEqual(['image', 'inspect', '--platform', 'linux/arm64', pinned])
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
  await expect(engine.resolveImage()).rejects.toThrow('latest changed')
  expect(calls.some(call => call[0] === 'run')).toBe(false)
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

test('restored-cache ownership helper is offline and can only see the asset mounts', async () => {
  const { engine, calls } = await harness()
  await engine.resolveImage()
  await engine.prepareMounts()
  await engine.repairCacheOwnership()
  const run = calls.find(call => call[0] === 'run')!
  expect(run.slice(run.indexOf(pinned) + 1)).toEqual(['-R', 'bun', '/app/runtime', '/home/bun'])
  expect(run).toContain('chown')
  expect(run).toContain('none')
  expect(run.filter(arg => arg.startsWith('type=bind'))).toHaveLength(2)
  expect(run.join('\n')).not.toContain('dst=/fixtures')
  expect(run.join('\n')).not.toContain('dst=/results')
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

test('every supported selector executes inference and CI contains every native shard', async () => {
  const all = selectDockerScenarios({ suite: 'all' })
  expect(MODEL_SELECTORS).toHaveLength(13)
  for (const model of MODEL_SELECTORS) {
    const cases = selectDockerScenarios({ suite: 'models', model })
    expect(cases.length).toBeGreaterThan(0)
    expect(cases.some(item => item.args[0] === 'extract' && item.args.includes(model.replace(':', '=')))).toBe(true)
    expect(cases.every(item => item.network === 'none')).toBe(true)
  }
  expect(() => selectDockerScenarios({ suite: 'models', model: 'whisper:unknown' })).toThrow('No scenarios')
  expect(() => selectDockerScenarios({ suite: 'all' }, all.filter(item => item.model !== 'whisper:medium'))).toThrow('Missing inference')
  const workflow = Bun.YAML.parse(await Bun.file('.github/workflows/docker-publish.yml').text()) as {
    concurrency: { 'cancel-in-progress': boolean; group: string }
    jobs: Record<string, { needs?: string | string[]; if?: string; 'runs-on'?: string; strategy?: { 'fail-fast': boolean; matrix: { arch: string[]; shard: string[] } }; steps?: Array<{ if?: string; uses?: string }> }>
  }
  expect(workflow.concurrency['cancel-in-progress']).toBe(false)
  const job = workflow.jobs['acceptance']!
  expect(job.needs).toBe('publish-manifest')
  expect(job.strategy?.matrix.arch).toEqual(['amd64', 'arm64'])
  expect(job.strategy?.matrix.shard).toEqual(['core', 'network', ...MODEL_SELECTORS])
  expect(job.strategy?.['fail-fast']).toBe(false)
  expect(job['runs-on']).toContain('ubuntu-24.04-arm')
  expect(job.steps?.find(step => step.uses?.startsWith('actions/upload-artifact'))?.if).toBe('always()')
  expect(workflow.jobs['acceptance-required']?.needs).toEqual(['publish-manifest', 'acceptance'])
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
  expect(rejections).toHaveLength(10)
  for (const rejection of rejections) {
    const scenario = cases.find(item => item.id === rejection.id)!
    expect(scenario.network).toBe('none')
    expect(scenario.args).toEqual(rejection.args)
    expect(rejection.exitCode).toBeGreaterThan(0)
  }
})

test('runner parsing bounds timeouts and preserves native model selection', () => {
  expect(parseDockerOptions([]).suite).toBe('all')
  expect(() => parseDockerOptions(['--model', 'whisper:tiny'])).toThrow('requires')
  expect(() => parseDockerOptions(['--case-timeout', '0'])).toThrow('1–7200')
  expect(() => parseDockerOptions(['--setup-timeout', '8000'])).toThrow('1–7200')
  expect(() => parseDockerOptions(['--suite', 'core', '--suite', 'all'])).toThrow('Repeated')
  expect(() => parseDockerOptions(['--output', '/tmp/a,b'])).toThrow('commas')
})

test('size experiments use the exact isolated production prerequisite layer', async () => {
  const layer = whisperToolchainLayer(await Bun.file('Dockerfile').text())
  expect(layer).toContain('cmake make gcc g++ libc6-dev')
  expect(layer).toContain('rm -rf /var/lib/apt/lists/*')
})
