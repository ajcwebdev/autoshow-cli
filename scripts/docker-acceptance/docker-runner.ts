import assert from 'node:assert/strict'
import { chmod, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import type { CliOutcome, LocalExecutionAdapter } from '../../test/scenarios/local-cli-contracts'
import { artifactExists } from '../../test/scenarios/local-cli-contracts'
import { DockerEngine, mapArtifactPath } from './docker-engine'
import { containerFixture, prepareDockerFixtures, startDockerFixtureServer } from './docker-fixtures'
import { selectDockerScenarios } from './docker-scenarios'
import type { DockerScenario, ModelSelector } from './docker-scenarios'
import { DOCKER_HELP, parseDockerOptions } from './docker-options'
import type { DockerOptions } from './docker-options'

interface CaseEvidence { id: string; category: string; status: 'passed' | 'failed'; durationMs: number; error?: string }

export async function discoverOutputDir(root: string): Promise<string | null> {
  if (!await artifactExists(root)) return null
  if (await artifactExists(join(root, 'manifest.json'))) return root
  const dirs = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory())
  const candidates = []
  for (const dir of dirs) if (await artifactExists(join(root, dir.name, 'manifest.json'))) candidates.push(join(root, dir.name))
  assert(candidates.length <= 1, `Ambiguous output runs under ${root}`)
  return candidates[0] ?? null
}

export class DockerScenarioAdapter implements LocalExecutionAdapter {
  constructor(readonly engine: DockerEngine, readonly scenario: DockerScenario) {}
  fixture = containerFixture
  hostPath(path: string, relativeTo?: string): string { return mapArtifactPath(path, this.engine.mounts, relativeTo) }
  async execute(args: string[]): Promise<CliOutcome> {
    assert.deepEqual(args, this.scenario.args, 'Scenario changed its authorized command')
    const network = this.scenario.network === 'public' ? 'bridge' : this.scenario.network === 'fixture' ? this.engine.fixtureNetwork : 'none'
    assert(network, 'Fixture network is unavailable')
    this.engine.authorize(args, network)
    const outputRoot = join(this.engine.options.output, 'outputs', this.scenario.id)
    await mkdir(outputRoot, { recursive: true })
    await chmod(outputRoot, 0o777)
    const result = await this.engine.cli(args, this.scenario.id, network)
    assert(!result.timedOut, `${this.scenario.id} timed out`)
    return { ...result, outputRoot, outputDir: await discoverOutputDir(outputRoot) }
  }
  async probe(path: string): Promise<{ codec_name: string; width: number; height: number }> {
    const hostRoot = join(this.engine.options.output, 'outputs')
    const suffix = relative(hostRoot, resolve(path))
    assert(!suffix.startsWith('..'), 'Probe must inspect an acceptance output')
    const result = this.engine.requireSuccess(await this.engine.container([
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', `/results/${suffix}`
    ], 'none', 30_000, 'ffprobe'), 'Probe rendered video')
    const data = JSON.parse(result.stdout) as { streams: Array<{ codec_name: string; width: number; height: number }> }
    assert(data.streams[0], 'No video stream')
    return data.streams[0]
  }
}

export function acceptancePassed(selectedCount: number, cases: CaseEvidence[], errors: string[]): boolean {
  return selectedCount > 0 && cases.length === selectedCount && cases.every(item => item.status === 'passed') && errors.length === 0
}

export async function runDockerAcceptance(options: DockerOptions, engine = new DockerEngine(options)): Promise<number> {
  const selected = selectDockerScenarios(options)
  // Refuse to mix old artifacts into a new run; no evidence directory is ever removed.
  await mkdir(options.output, { recursive: false })
  const cases: CaseEvidence[] = []
  const errors: string[] = []
  let lock: string | undefined
  let stage = 'image-resolution'
  const startedAt = new Date().toISOString()
  const interrupt = (): void => { engine.interrupted = true }
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', interrupt)
  async function save(): Promise<void> {
    await Bun.write(join(options.output, 'results.json'), `${JSON.stringify({
      schemaVersion: 1, startedAt, updatedAt: new Date().toISOString(), options, image: engine.identity,
      selectedCount: selected.length, attemptedCount: cases.length, executedCount: cases.filter(item => item.category !== 'provisioning').length, passed: acceptancePassed(selected.length, cases, errors),
      selected: selected.map(({ id, suite, model }) => ({ id, suite, model })), cases, errors,
      commands: engine.commands.map(({ stdout: _stdout, stderr: _stderr, ...command }) => command)
    }, null, 2)}\n`)
  }
  async function provision(args: string[], network = 'bridge'): Promise<void> {
    engine.authorize(args, network)
    engine.requireSuccess(await engine.cli(args, 'provisioning', network, options.setupTimeoutMs), `Provision ${args.join(' ')}`)
  }
  const ready = new Map<string, Promise<void>>()
  async function once(key: string, task: () => Promise<void>): Promise<void> {
    if (!ready.has(key)) ready.set(key, task())
    await ready.get(key)
  }
  async function provisionModel(selector: ModelSelector): Promise<void> {
    await once(selector, async () => {
      await provision(['setup', '--models', selector])
      // A second disposable container must find the model with downloads disabled.
      await provision(['setup', '--models', selector], 'none')
    })
  }
  await save()
  try {
    const identity = await engine.resolveImage()
    console.log(`Image ${identity.reference} (${identity.platform}), revision ${identity.revision}`)
    const cacheDir = join(options.cache, identity.platform.replace('/', '-'))
    await mkdir(cacheDir, { recursive: true })
    const candidateLock = join(cacheDir, 'acceptance.lock')
    await mkdir(candidateLock).catch(() => { throw new Error(`Cache already in use: ${candidateLock}. Inspect its owner.json before recovering an abandoned lock.`) })
    lock = candidateLock
    await Bun.write(join(lock, 'owner.json'), JSON.stringify({ runId: engine.runId, pid: process.pid, output: options.output, startedAt }))
    await engine.prepareMounts()
    if (process.platform === 'linux') await engine.repairCacheOwnership()
    await Bun.write(join(options.output, 'fixtures', 'empty-config.json'), '{}\n')
    stage = 'image-cli'
    const versionArgs = ['--version']
    engine.authorize(versionArgs, 'none')
    identity.cliVersion = engine.requireSuccess(await engine.cli(versionArgs, 'identity', 'none', 30_000), 'Image CLI version').stdout.trim()
    assert(identity.cliVersion, 'Missing CLI version')
    await Bun.write(join(options.output, 'image.json'), `${JSON.stringify(identity, null, 2)}\n`)
    await provision(['setup', '--doctor'], 'none')
    stage = 'fixtures'
    await prepareDockerFixtures(engine, selected.some(scenario => scenario.suite === 'models'))
    if (selected.some(scenario => scenario.network === 'fixture')) await startDockerFixtureServer(engine)
    stage = 'scenarios'
    for (const scenario of selected) {
      if (engine.interrupted) throw new Error('Acceptance interrupted')
      const started = performance.now()
      let category = 'provisioning'
      console.log(`Running ${scenario.id}`)
      try {
        if (scenario.provision) await once('defuddle', async () => {
          await provision(['setup', '--step', 'defuddle'])
          await provision(['setup', '--step', 'defuddle'], 'none')
        })
        if (scenario.model) await provisionModel(scenario.model)
        category = scenario.network === 'public' ? 'public-network' : 'local-acceptance'
        const adapter = new DockerScenarioAdapter(engine, scenario)
        await scenario.verify(adapter, await adapter.execute(scenario.args))
        cases.push({ id: scenario.id, category, status: 'passed', durationMs: Math.round(performance.now() - started) })
        console.log(`PASS ${scenario.id}`)
      } catch (error) {
        cases.push({ id: scenario.id, category, status: 'failed', durationMs: Math.round(performance.now() - started), error: String(error) })
        console.error(`FAIL ${scenario.id} (${category}): ${String(error).slice(-1500)}`)
      }
      await save()
    }
  } catch (error) {
    errors.push(`${stage}: ${String(error)}`)
    console.error(errors.at(-1))
  } finally {
    const fixture = `${engine.runId}-fixture`
    if (engine.owned.has(fixture)) await engine.command(['logs', fixture])
    try { await engine.cleanup() } catch (error) { errors.push(`cleanup: ${String(error)}`) }
    const runtime = engine.mounts.find(mount => mount.container === '/app/runtime')?.host
    if (runtime) {
      try {
        const inventory: Array<{ path: string; sizeBytes: number }> = []
        for await (const path of new Bun.Glob('**/*').scan({ cwd: runtime, onlyFiles: true })) {
          if (path.startsWith('defuddle/node_modules/')) continue
          inventory.push({ path, sizeBytes: (await stat(join(runtime, path))).size })
          if (path.startsWith('setup-performance/') || /(^|\/)(CMakeCache\.txt|CMakeConfigureLog\.yaml|CMakeError\.log|CMakeOutput\.log)$/.test(path)) {
            await Bun.write(join(options.output, 'provisioning', path), Bun.file(join(runtime, path)))
          }
        }
        await Bun.write(join(options.output, 'provisioning', 'inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`)
      } catch (error) { errors.push(`provisioning-evidence: ${String(error)}`) }
    }
    if (lock && engine.owned.size === 0) await rm(lock, { recursive: true })
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
    await save()
  }
  const passed = acceptancePassed(selected.length, cases, errors)
  console.log(`${cases.filter(item => item.status === 'passed').length}/${selected.length} passed. Evidence: ${options.output}`)
  return passed ? 0 : 1
}

if (import.meta.main) {
  let options: DockerOptions
  try { options = parseDockerOptions(process.argv.slice(2)) }
  catch (error) { console.error(`${String(error)}\n${DOCKER_HELP}`); process.exit(2) }
  if (options.help) { console.log(DOCKER_HELP); process.exit(0) }
  try {
    await mkdir(resolve(options.output, '..'), { recursive: true })
    process.exitCode = await runDockerAcceptance(options)
  } catch (error) { console.error(String(error)); process.exitCode = 1 }
}
