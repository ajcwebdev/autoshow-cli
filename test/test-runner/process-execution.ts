import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { RunnerStreamLabel, TestRunArtifacts } from '~/types'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { l } from '~/utils/app-logger/app-logger'
import { consumeBoundedTextStream } from '~/utils/bounded-text-stream'
import { childEnv } from '~/utils/child-env'
import { buildBunTestFlags, isE2EOnlyTestSelection } from './args'
import { appendRunnerLog, TEST_OUTPUT_ROOT } from './artifacts'
import { BUN_FILE_TIMINGS_CACHE_PATH, prepareBunFileTimings } from './file-timings'
import { formatTimedOutputPrefix, lineHasTimedOutputPrefix, normalizeRepoPath } from './utils'

const TEST_CLI_BUNDLE_PATH = join(TEST_OUTPUT_ROOT, '.test-cache', 'cli.js')
const MAX_RUNNER_STREAM_BYTES = 64 * 1024 * 1024
const MAX_RUNNER_LINE_CHARACTERS = 64 * 1024

export const prebuildTestCliBundle = async (artifacts: TestRunArtifacts): Promise<void> => {
  await mkdir(join(TEST_OUTPUT_ROOT, '.test-cache'), { recursive: true })
  const commandText = `bun build src/cli/create-cli.ts --target=bun --outfile ${TEST_CLI_BUNDLE_PATH}`
  await appendRunnerLog(artifacts, `\n=== PREBUILD CLI ${commandText} ===\n`)
  const proc = Bun.spawn(['bun', '--no-env-file', 'build', 'src/cli/create-cli.ts', '--target=bun', '--outfile', TEST_CLI_BUNDLE_PATH], {
    env: childEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  await appendRunnerLog(artifacts, `exit: ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}\n`)
  if (exitCode !== 0) {
    throw new Error(`Failed to prebuild test CLI bundle (exit ${exitCode}): ${stderr || stdout}`)
  }
  process.env['AUTOSHOW_TEST_CLI_BUNDLE'] = TEST_CLI_BUNDLE_PATH
  process.env['AUTOSHOW_PROJECT_ROOT'] = process.cwd()
  l.write('info', `Prebuilt test CLI bundle: ${normalizeRepoPath(TEST_CLI_BUNDLE_PATH)}`, { category: 'command' })
}

export const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await fn(items[index] as T, index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

export const forwardSpawnOutput = async (
  stream: ReadableStream<Uint8Array>,
  label: RunnerStreamLabel,
  artifacts: TestRunArtifacts
): Promise<void> => {
  const writer = label === 'STDOUT' ? process.stdout : process.stderr

  const flushLine = (line: string): void => {
    if (line.length === 0) return
    const prefix = formatTimedOutputPrefix(Date.now())
    const output = lineHasTimedOutputPrefix(line) ? line : `${prefix} ${line}`
    writer.write(output)
    appendRunnerLog(artifacts, lineHasTimedOutputPrefix(line) ? `[${label}] ${line}` : `${prefix} [${label}] ${line}`)
  }

  await consumeBoundedTextStream(stream, {
    maxBytes: MAX_RUNNER_STREAM_BYTES,
    maxLineCharacters: MAX_RUNNER_LINE_CHARACTERS,
    lineOverflow: 'truncate',
    onLine: flushLine
  })
}

export const buildTestWorkerEnv = (
  files: string[],
  artifacts: TestRunArtifacts,
  preserveTestOutput: boolean,
  envOverrides: Record<string, string>
): Record<string, string> => {
  const runnerControlKeys = Object.keys(process.env).filter(key => key.startsWith('AUTOSHOW_TEST_'))
  const workerEnv = childEnv({
    allow: [
      ...HOSTED_PROVIDER_ENV_CHECKS.map(provider => provider.envVar),
      ...runnerControlKeys,
      'AUTOSHOW_PROJECT_ROOT'
    ]
  })
  workerEnv['FORCE_COLOR'] = '1'
  workerEnv['AUTOSHOW_TEST_ARTIFACTS_DIR'] = artifacts.runDir
  workerEnv['AUTOSHOW_TEST_COMMAND_LOG'] = artifacts.commandLogPath
  workerEnv['AUTOSHOW_TEST_METRICS_LOG'] = artifacts.metricsLogPath
  workerEnv['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] = preserveTestOutput ? '1' : '0'
  workerEnv['AUTOSHOW_TEST_ADAPTIVE_E2E_SELECTION'] = isE2EOnlyTestSelection(files) ? '1' : '0'
  if (isE2EOnlyTestSelection(files)) workerEnv['AUTOSHOW_TEST_CONCURRENT'] ??= '1'
  workerEnv['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY'] = envOverrides['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY']
    ?? workerEnv['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY']
    ?? '1'
  Object.assign(workerEnv, envOverrides)
  return workerEnv
}

export const buildBunTestArgs = (
  files: string[],
  artifacts: TestRunArtifacts,
  passthroughArgs: string[],
  extraArgs: string[] = []
): string[] => [
  'test',
  '--no-orphans',
  `--timings=${BUN_FILE_TIMINGS_CACHE_PATH}`,
  '--update-timings',
  ...buildBunTestFlags(files, passthroughArgs),
  '--reporter',
  'junit',
  '--reporter-outfile',
  artifacts.junitPath,
  ...extraArgs,
  ...files,
]

export const runBunTest = async (
  files: string[],
  artifacts: TestRunArtifacts,
  passthroughArgs: string[],
  preserveTestOutput: boolean,
  extraArgs: string[] = [],
  envOverrides: Record<string, string> = {}
): Promise<number> => {
  await prepareBunFileTimings()
  const args = buildBunTestArgs(files, artifacts, passthroughArgs, extraArgs)
  await appendRunnerLog(artifacts, `\n=== START bun ${args.join(' ')} ===\n`)
  const proc = Bun.spawn(['bun', '--no-env-file', ...args], {
    env: buildTestWorkerEnv(files, artifacts, preserveTestOutput, envOverrides),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode] = await Promise.all([
    proc.exited,
    forwardSpawnOutput(proc.stdout, 'STDOUT', artifacts),
    forwardSpawnOutput(proc.stderr, 'STDERR', artifacts),
  ])
  await appendRunnerLog(artifacts, `\n=== END bun ${args.join(' ')} (exit=${exitCode}) ===\n`)
  return exitCode
}
