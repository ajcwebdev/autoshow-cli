import { afterAll, expect, test } from 'bun:test'
import { lstat, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ProcessRunner } from '../../../../src/tools/docker-process'
import { runDockerTesseractDataAcceptance, TESSERACT_DATA_CASES } from '../../../docker-acceptance/docker-tesseract-data-acceptance'

const image = `sha256:${'a'.repeat(64)}`
const fixtures: string[] = []
afterAll(async () => { for (const fixture of fixtures) await rm(fixture, { recursive: true, force: true }) })

function runner(options: { failCase?: string; wrongArchitecture?: boolean; omitResetPhase?: boolean } = {}) {
  const runs: string[][] = []
  const removed: string[] = []
  const execute: ProcessRunner = async (argv, _timeoutMs, logPrefix) => {
    let stdout = ''
    let exitCode = 0
    if (argv[0] === 'info') stdout = '"aarch64"'
    if (argv[0] === 'image') stdout = JSON.stringify([{
      Id: image, Os: 'linux', Architecture: 'arm64', Size: 1,
      Config: { User: 'bun', Entrypoint: ['bun', '--no-env-file', '/app/src/cli/create-cli.ts'], Env: [] },
    }])
    if (argv[0] === 'run') {
      runs.push(argv)
      const mode = argv.at(-1)!
      if (mode === options.failCase) exitCode = 1
      stdout = `TESSERACT_DATA_ACCEPTANCE=${JSON.stringify({
        status: 'passed', case: mode, architecture: options.wrongArchitecture ? 'x64' : 'arm64',
        phases: Array.from({ length: mode === 'reset-managed' && !options.omitResetPhase ? 4 : 1 }, () => ({})),
      })}\n`
    }
    if (argv[0] === 'rm') removed.push(argv.at(-1)!)
    const stderr = exitCode ? 'authored container failure' : ''
    await Bun.write(`${logPrefix}.stdout.log`, stdout)
    await Bun.write(`${logPrefix}.stderr.log`, stderr)
    return { exitCode, stdout, stderr, timedOut: false, durationMs: 1 }
  }
  return { execute, runs, removed }
}

test('Tesseract data gate uses the exact local image offline with fresh owned state and original HOME', async () => {
  const { execute, runs, removed } = runner()
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
      expect(host).not.toStartWith(process.cwd())
      await expect(lstat(host)).rejects.toThrow()
    }
  }
  expect(removed).toHaveLength(TESSERACT_DATA_CASES.length)
  expect(new Set(removed).size).toBe(removed.length)
})

test('Tesseract data gate rejects failed probes, architecture mismatches, and incomplete reset coverage', async () => {
  for (const options of [{ failCase: 'managed-valid' }, { wrongArchitecture: true }, { omitResetPhase: true }]) {
    const fixture = await mkdtemp(join(tmpdir(), 'tesseract-gate-evidence-test-'))
    fixtures.push(fixture)
    const output = join(fixture, 'evidence')
    const { execute, runs, removed } = runner(options)
    await expect(runDockerTesseractDataAcceptance(image, execute, output)).rejects.toThrow('evidence retained at')
    expect(removed).toHaveLength(runs.length)
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
