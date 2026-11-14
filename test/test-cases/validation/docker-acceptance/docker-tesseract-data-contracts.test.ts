import { afterAll, expect, test } from 'bun:test'
import { chmod, lstat, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ProcessRunner } from '../../../../src/tools/docker-process'
import { runDockerTesseractDataAcceptance, TESSERACT_DATA_CASES } from '../../../docker-acceptance/docker-tesseract-data-acceptance'
import { RUNTIME_DIR } from '../../../../src/utils/runtime-paths'
import { DockerEngine, PASSED_AUTHORED_DIRECTORY_CLEANUP_SCRIPT } from '../../../docker-acceptance/docker-engine'
import { parseDockerOptions } from '../../../docker-acceptance/docker-options'

const image = `sha256:${'a'.repeat(64)}`
const fixtures: string[] = []
afterAll(async () => { for (const fixture of fixtures) await rm(fixture, { recursive: true, force: true }) })

const isPassedCleanup = (argv: readonly string[]): boolean => argv.includes(PASSED_AUTHORED_DIRECTORY_CLEANUP_SCRIPT)

function runner(options: { failCase?: string; timeoutCase?: string; failCleanup?: boolean; wrongArchitecture?: boolean; omitResetPhase?: boolean } = {}) {
  const runs: string[][] = []
  const cleanups: string[][] = []
  const removed: string[] = []
  const execute: ProcessRunner = async (argv, _timeoutMs, logPrefix) => {
    let stdout = ''
    let exitCode = 0
    if (argv[0] === 'info') stdout = '"aarch64"'
    if (argv[0] === 'image') stdout = JSON.stringify([{
      Id: image, Os: 'linux', Architecture: 'arm64', Size: 1,
      Config: { User: 'bun', Entrypoint: ['bun', '--no-env-file', '/app/src/cli/create-cli.ts'], Env: [] },
    }])
    if (argv[0] === 'run' && isPassedCleanup(argv)) {
      cleanups.push(argv)
      if (options.failCleanup) exitCode = 1
    } else if (argv[0] === 'run') {
      runs.push(argv)
      const mode = argv.at(-1)!
      if (mode === options.failCase || mode === options.timeoutCase) exitCode = 1
      stdout = `TESSERACT_DATA_ACCEPTANCE=${JSON.stringify({
        status: 'passed', case: mode, architecture: options.wrongArchitecture ? 'x64' : 'arm64',
        phases: Array.from({ length: mode === 'reset-managed' && !options.omitResetPhase ? 4 : 1 }, () => ({})),
      })}\n`
    }
    if (argv[0] === 'rm') removed.push(argv.at(-1)!)
    const stderr = exitCode ? 'authored container failure' : ''
    await Bun.write(`${logPrefix}.stdout.log`, stdout)
    await Bun.write(`${logPrefix}.stderr.log`, stderr)
    return { exitCode, stdout, stderr, timedOut: argv.at(-1) === options.timeoutCase, durationMs: 1 }
  }
  return { execute, runs, cleanups, removed }
}

test('Tesseract data gate uses the exact local image offline with fresh owned state and original HOME', async () => {
  const { execute, runs, cleanups, removed } = runner()
  const result = await runDockerTesseractDataAcceptance(image, execute)
  expect(result).toMatchObject({ status: 'passed', image, platform: 'linux/arm64', caseCount: 9, phaseCount: 12 })
  expect(runs.map(argv => argv.at(-1))).toEqual([...TESSERACT_DATA_CASES])
  for (const argv of runs) {
    expect(argv.slice(argv.indexOf('--network'), argv.indexOf('--network') + 2)).toEqual(['--network', 'none'])
    expect(argv.slice(argv.indexOf('--pull'), argv.indexOf('--pull') + 2)).toEqual(['--pull', 'never'])
    expect(argv).toContain(image)
    expect(argv).not.toContain('--user')
    expect(argv.join('\n')).not.toContain('dst=/home/bun')
    const runtime = argv.find(arg => arg.includes('dst=/app/runtime'))
    expect(Boolean(runtime)).toBe(argv.at(-1) !== 'no-runtime-mount')
    if (runtime) {
      const host = runtime.match(/src=([^,]+)/)![1]!
      expect(host).toStartWith(join(RUNTIME_DIR, 'tmp', 'autoshow-tesseract-data-acceptance-'))
      await expect(lstat(host)).rejects.toThrow()
    }
  }
  expect(cleanups).toHaveLength(TESSERACT_DATA_CASES.length)
  for (const argv of cleanups) {
    expect(argv.slice(argv.indexOf('--user'), argv.indexOf('--user') + 2)).toEqual(['--user', '0:0'])
    expect(argv).toContain('--read-only')
    expect(argv.slice(argv.indexOf('--network'), argv.indexOf('--network') + 2)).toEqual(['--network', 'none'])
    expect(argv.slice(argv.indexOf('--cap-drop'), argv.indexOf('--cap-drop') + 2)).toEqual(['--cap-drop', 'ALL'])
    expect(argv.slice(argv.indexOf('--cap-add'), argv.indexOf('--cap-add') + 2)).toEqual(['--cap-add', 'DAC_OVERRIDE'])
    expect(argv).toContain('no-new-privileges:true')
    expect(argv.filter(value => value.startsWith('type=bind,'))).toHaveLength(1)
    expect(argv.find(value => value.startsWith('type=bind,'))).toInclude(',dst=/authored-passed-state')
    expect(argv.join('\n')).not.toContain('dst=/app/runtime')
    expect(argv.join('\n')).not.toContain('dst=/results')
  }
  expect(removed).toHaveLength(TESSERACT_DATA_CASES.length + cleanups.length)
  expect(new Set(removed).size).toBe(removed.length)
})

test('Tesseract data gate rejects failed probes, architecture mismatches, and incomplete reset coverage', async () => {
  for (const options of [{ failCase: 'managed-valid' }, { timeoutCase: 'managed-valid' }, { wrongArchitecture: true }, { omitResetPhase: true }]) {
    const fixture = await mkdtemp(join(tmpdir(), 'tesseract-gate-evidence-test-'))
    fixtures.push(fixture)
    const output = join(fixture, 'evidence')
    const { execute, runs, cleanups, removed } = runner(options)
    await expect(runDockerTesseractDataAcceptance(image, execute, output)).rejects.toThrow('evidence retained at')
    expect(removed).toHaveLength(runs.length + cleanups.length)
    if (options.failCase || options.timeoutCase) expect(cleanups.every(argv => !argv.some(value => value.includes('/states/managed-valid,')))).toBe(true)
    const failure = await Bun.file(join(output, 'failure.json')).json() as { status: string; temporaryState: string }
    fixtures.push(failure.temporaryState)
    expect(failure.status).toBe('failed')
    expect((await lstat(failure.temporaryState)).isDirectory()).toBe(true)
    const logs = (await readdir(join(output, 'logs'))).filter(name => name.endsWith('.stdout.log'))
    expect(logs.length).toBeGreaterThan(0)
    expect((await Promise.all(logs.map(name => Bun.file(join(output, 'logs', name)).text()))).join('\n')).toContain('TESSERACT_DATA_ACCEPTANCE=')
    if (options.failCase) {
      const errors = (await readdir(join(output, 'logs'))).filter(name => name.endsWith('.stderr.log'))
      expect((await Promise.all(errors.map(name => Bun.file(join(output, 'logs', name)).text()))).join('\n')).toContain('authored container failure')
    }
  }
})

test('successful Tesseract probes retain configured diagnostics while removing only their authored temporary state', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'tesseract-gate-success-test-'))
  fixtures.push(fixture)
  const output = join(fixture, 'evidence')
  const { execute, runs } = runner()
  expect(await runDockerTesseractDataAcceptance(image, execute, output)).toMatchObject({ status: 'passed', caseCount: 9 })
  expect((await lstat(output)).isDirectory()).toBe(true)
  expect((await readdir(join(output, 'logs'))).some(name => name.endsWith('.result.json'))).toBe(true)
  expect(await Bun.file(join(output, 'failure.json')).exists()).toBe(false)
  const state = runs[0]!.find(arg => arg.includes('dst=/results'))!.match(/src=([^,]+)/)![1]!
  await expect(lstat(state)).rejects.toThrow()
})

test('Tesseract gate bounds successful payload storage and preserves the failing case bytes and permissions', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'tesseract-gate-bounded-storage-'))
  fixtures.push(fixture)
  const output = join(fixture, 'evidence')
  const base = runner({ failCase: 'managed-valid' })
  let previous: string | undefined
  let failedRuntime: string | undefined
  let successfulPayloads = 0
  const execute: ProcessRunner = async (argv, timeoutMs, logPrefix) => {
    if (argv[0] === 'run' && !isPassedCleanup(argv)) {
      if (previous) {
        await expect(lstat(previous)).rejects.toThrow()
        successfulPayloads++
      }
      const mount = argv.find(arg => arg.includes('dst=/app/runtime'))
      const runtime = mount?.match(/src=([^,]+)/)?.[1]
      if (runtime) {
        await Bun.write(join(runtime, 'authored-sentinel'), 'independent case state\n')
        await chmod(join(runtime, 'authored-sentinel'), 0o640)
        previous = runtime
        if (argv.at(-1) === 'managed-valid') failedRuntime = runtime
      }
    }
    return base.execute(argv, timeoutMs, logPrefix)
  }
  await expect(runDockerTesseractDataAcceptance(image, execute, output)).rejects.toThrow('evidence retained at')
  const failure = await Bun.file(join(output, 'failure.json')).json() as { temporaryState: string }
  fixtures.push(failure.temporaryState)
  expect(successfulPayloads).toBe(2)
  expect(failedRuntime).toBeDefined()
  expect(await Bun.file(join(failedRuntime!, 'authored-sentinel')).text()).toBe('independent case state\n')
  expect((await lstat(join(failedRuntime!, 'authored-sentinel'))).mode & 0o777).toBe(0o640)
})

test('passed state cleanup rejects external, aliased, active, and interrupted directories before Docker dispatch', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'tesseract-cleanup-containment-'))
  fixtures.push(fixture)
  const authored = join(fixture, 'authored'), outside = join(fixture, 'outside')
  await mkdir(authored)
  await mkdir(join(outside, 'nested'), { recursive: true })
  await Bun.write(join(outside, 'sentinel'), 'external state remains\n')
  await chmod(join(outside, 'sentinel'), 0o640)
  await symlink(outside, join(authored, 'escape'))
  const { execute, cleanups } = runner()
  const options = parseDockerOptions(['--image', image, '--pull', 'never', '--output', join(fixture, 'evidence')])
  const engine = new DockerEngine(options, execute)
  await engine.resolveImage()
  await expect(engine.removePassedAuthoredDirectory('/', '/')).rejects.toThrow('filesystem root')
  await expect(engine.removePassedAuthoredDirectory(outside, authored)).rejects.toThrow('escaped')
  await expect(engine.removePassedAuthoredDirectory(join(authored, 'escape'), authored)).rejects.toThrow('actual authored directories')
  await expect(engine.removePassedAuthoredDirectory(join(authored, 'escape/nested'), authored)).rejects.toThrow('resolves outside')
  engine.interrupted = true
  await expect(engine.removePassedAuthoredDirectory(authored, authored)).rejects.toThrow('must be retained')
  engine.interrupted = false
  engine.owned.add('still-running')
  await expect(engine.removePassedAuthoredDirectory(authored, authored)).rejects.toThrow('must be retained')
  engine.owned.clear()
  expect(cleanups).toHaveLength(0)
  expect(await Bun.file(join(outside, 'sentinel')).text()).toBe('external state remains\n')
  expect((await lstat(join(outside, 'sentinel'))).mode & 0o777).toBe(0o640)
})

test('failed passed-state disposal retains its authored tree and command evidence', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'tesseract-cleanup-failure-'))
  fixtures.push(fixture)
  const output = join(fixture, 'evidence'), base = runner({ failCleanup: true })
  let retained: string | undefined
  const execute: ProcessRunner = async (argv, timeout, prefix) => {
    if (isPassedCleanup(argv)) {
      retained = argv.find(value => value.startsWith('type=bind,'))!.match(/src=([^,]+)/)![1]!
      await Bun.write(join(retained, 'sentinel'), 'cleanup failure evidence\n')
      await chmod(join(retained, 'sentinel'), 0o640)
    }
    return base.execute(argv, timeout, prefix)
  }
  await expect(runDockerTesseractDataAcceptance(image, execute, output)).rejects.toThrow('evidence retained at')
  const failure = await Bun.file(join(output, 'failure.json')).json() as { temporaryState: string }
  fixtures.push(failure.temporaryState)
  expect(await Bun.file(join(retained!, 'sentinel')).text()).toBe('cleanup failure evidence\n')
  expect((await lstat(join(retained!, 'sentinel'))).mode & 0o777).toBe(0o640)
  expect(base.cleanups).toHaveLength(1)
  expect(base.removed).toHaveLength(base.runs.length + base.cleanups.length)
})

test('CI archives Tesseract failure diagnostics with the existing native evidence artifact', async () => {
  const workflow = Bun.YAML.parse(await Bun.file(resolve(import.meta.dir, '../../../../.github/workflows/dependency-graphs.yml')).text()) as {
    jobs: { images: { steps: Array<{ name?: string; run?: string; uses?: string; if?: string; with?: Record<string, string> }> } }
  }
  const steps = workflow.jobs.images.steps
  expect(steps.find(step => step.name === 'Verify Tesseract packaged and managed data offline')?.run).toContain('--output runtime/dependency-evidence/tesseract')
  const upload = steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))
  expect(upload?.if).toBe('always()')
  expect(upload?.with?.['path']).toBe('runtime/dependency-evidence')
})
