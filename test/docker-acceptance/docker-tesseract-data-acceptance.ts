import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { DockerEngine } from './docker-engine'
import { parseDockerOptions } from './docker-options'
import type { ProcessRunner } from '../../src/tools/docker-process'
import { toProjectRelativePath } from '../../src/utils/project-root'
import { requireCondition } from '../test-utils/require-condition'

export const TESSERACT_DATA_CASES = [
  'no-runtime-mount', 'empty-runtime', 'empty-tessdata', 'managed-valid',
  'managed-corrupt', 'managed-unreadable', 'managed-directory', 'managed-empty', 'reset-managed',
] as const

export async function runDockerTesseractDataAcceptance(image: string, processRunner?: ProcessRunner, outputDirectory?: string) {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-tesseract-data-acceptance-'))
  const evidenceDirectory = outputDirectory ? resolve(outputDirectory) : join(directory, 'evidence')
  await mkdir(dirname(evidenceDirectory), { recursive: true })
  await mkdir(evidenceDirectory)
  let engine: DockerEngine | undefined
  const runCases = async () => {
    const options = parseDockerOptions(['--image', image, '--pull', 'never', '--output', evidenceDirectory, '--cache', join(directory, 'unused-cache')])
    engine = new DockerEngine(options, processRunner)
    const identity = await engine.resolveImage()
    const output = join(directory, 'outputs')
    await mkdir(output)
    await chmod(output, 0o777)
    const cases: Array<{ status: string; case: string; architecture: string; phases: Array<Record<string, unknown>> }> = []
    for (const mode of TESSERACT_DATA_CASES) {
      engine.mounts.length = 0
      engine.mounts.push(
        { host: resolve(import.meta.dir, '../fixtures/setup/managed-toolchain-smoke.pdf'), container: '/fixture.pdf', readonly: true },
        { host: join(import.meta.dir, 'docker-tesseract-data-probe.ts'), container: '/app/test/docker-acceptance/docker-tesseract-data-probe.ts', readonly: true },
        { host: output, container: '/results' },
      )
      if (mode !== 'no-runtime-mount') {
        const runtime = join(directory, 'states', mode)
        await mkdir(runtime, { recursive: true })
        await chmod(runtime, 0o777)
        engine.mounts.push({ host: runtime, container: '/app/runtime' })
      }
      const result = engine.requireSuccess(await engine.container([
        '--no-env-file', '/app/test/docker-acceptance/docker-tesseract-data-probe.ts', mode,
      ], 'none', 300_000, 'bun'), `Tesseract data state ${mode}`)
      const line = result.stdout.split('\n').find(line => line.startsWith('TESSERACT_DATA_ACCEPTANCE='))
      requireCondition(line, `Tesseract data case ${mode} omitted its result`)
      const evidence = JSON.parse(line.slice('TESSERACT_DATA_ACCEPTANCE='.length)) as typeof cases[number]
      requireCondition(evidence.status === 'passed' && evidence.case === mode && evidence.phases.length === (mode === 'reset-managed' ? 4 : 1), `Tesseract data case ${mode} did not pass`)
      requireCondition(evidence.architecture === (identity.platform === 'linux/arm64' ? 'arm64' : 'x64'), `Tesseract data case ${mode} was not native`)
      cases.push(evidence)
    }
    return { status: 'passed', image: identity.reference, platform: identity.platform, caseCount: cases.length, phaseCount: cases.reduce((count, item) => count + item.phases.length, 0), cases }
  }
  try {
    let result: Awaited<ReturnType<typeof runCases>>
    try { result = await runCases() } finally { await engine?.cleanup() }
    await rm(directory, { recursive: true, force: true })
    return result
  } catch (error) {
    // Keep failed authored state outside the uploaded diagnostics directory: a
    // deliberately unreadable model must not prevent uploading command logs.
    await Bun.write(join(evidenceDirectory, 'failure.json'), `${JSON.stringify({
      status: 'failed', image, error: String(error), temporaryState: directory,
      evidenceDirectory: toProjectRelativePath(evidenceDirectory),
    }, null, 2)}\n`)
    throw new Error(`${String(error)}\nTesseract data acceptance evidence retained at ${toProjectRelativePath(evidenceDirectory)}; authored state retained at ${directory}`, { cause: error })
  }
}

if (import.meta.main) {
  requireCondition((Bun.argv.length === 4 || Bun.argv.length === 6 && Bun.argv[4] === '--output' && Bun.argv[5]) && Bun.argv[2] === '--image' && Bun.argv[3], 'Usage: bun --no-env-file test/docker-acceptance/docker-tesseract-data-acceptance.ts --image IMAGE [--output NEW_EVIDENCE_DIRECTORY]')
  console.log(JSON.stringify(await runDockerTesseractDataAcceptance(Bun.argv[3], undefined, Bun.argv[5])))
}
