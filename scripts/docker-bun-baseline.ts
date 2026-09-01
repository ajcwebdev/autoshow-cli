import { chmod, mkdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

type DockerPlatform = 'linux/amd64' | 'linux/arm64'

type Options = {
  platforms: DockerPlatform[]
  fixturePath: string
  outputDir: string
  repeats: number
  fixtureRepeats: number
  skipBuild: boolean
  imagePrefix: string
}

type CommandCapture = {
  command: string[]
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

type PlatformMeasurement = {
  platform: DockerPlatform
  executionMode: 'native' | 'emulated'
  image: {
    tag: string
    id: string
    architecture: string
    os: string
    sizeBytes: number
  }
  runtime: {
    bunVersion: string
    machine: string
    transparentHugePages: string
  }
  measurements: {
    buildDurationMs: number | null
    coldHelpWallMs: { samples: number[], median: number }
    cliPrebuildMs: { samples: number[], median: number }
    fixturePeakRssBytes: { samples: number[], median: number }
  }
  commands: string[][]
}

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const DEFAULT_FIXTURE = resolve(PROJECT_ROOT, 'input/examples/document/30-document.pdf')
const DEFAULT_FIXTURE_SHA256 = 'e395620917bd93dc0ca37e23c50f695aac6344542ecad49a6e315778f54b053d'
const DEFAULT_OUTPUT_ROOT = resolve(PROJECT_ROOT, 'runtime/profiling/bun-docker-baseline')
const PLATFORM_VALUES = new Set<DockerPlatform>(['linux/amd64', 'linux/arm64'])
const PREBUILD_PROBE = `
const started = performance.now()
const proc = Bun.spawn([
  "bun", "--no-env-file", "build", "/app/src/cli/create-cli.ts",
  "--target=bun", "--outfile", "/tmp/autoshow-cli-baseline.js"
], { stdout: "pipe", stderr: "pipe" })
const [stdout, stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited
])
if (exitCode !== 0) {
  process.stderr.write(stderr || stdout)
  process.exit(exitCode)
}
process.stdout.write(JSON.stringify({ durationMs: performance.now() - started }))
`
const MEMORY_PROBE = `
set -eu
bun --no-env-file /app/src/cli/create-cli.ts extract /benchmark/fixture.pdf --provider tesseract --ocr-concurrency 1 --output-root /benchmark/output
peak_file=/sys/fs/cgroup/memory.peak
if [ ! -r "$peak_file" ]; then
  printf '%s\n' 'AUTOSHOW_PEAK_RSS_UNAVAILABLE' >&2
  exit 1
fi
printf 'AUTOSHOW_PEAK_RSS_BYTES=%s\n' "$(cat "$peak_file")"
`

const usage = (): never => {
  process.stderr.write(`Usage: bun baseline:docker [options]

Options:
  --platform <linux/amd64|linux/arm64|all>  Platform selection; defaults to all
  --output-dir <path>                      Raw artifact directory
  --repeats <count>                        Help and prebuild samples; defaults to 3
  --fixture-repeats <count>                Peak-RSS samples; defaults to 1
  --image-prefix <name>                    Local image prefix; defaults to autoshow-bun-baseline
  --skip-build                             Reuse existing platform image tags
`)
  process.exit(2)
}

const readValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    process.stderr.write(`Missing value for ${flag}\n`)
    return usage()
  }
  return value
}

const positiveInteger = (raw: string, flag: string): number => {
  if (!/^\d+$/.test(raw)) {
    process.stderr.write(`${flag} must be a positive integer\n`)
    usage()
  }
  const value = Number.parseInt(raw, 10)
  if (value < 1 || value > 20) {
    process.stderr.write(`${flag} must be between 1 and 20\n`)
    usage()
  }
  return value
}

const timestampSegment = (): string => new Date().toISOString().replace(/[:.]/g, '-')

const parseOptions = (args: string[]): Options => {
  const selectedPlatforms: DockerPlatform[] = []
  let fixturePath = DEFAULT_FIXTURE
  let outputDir = resolve(DEFAULT_OUTPUT_ROOT, timestampSegment())
  let repeats = 3
  let fixtureRepeats = 1
  let skipBuild = false
  let imagePrefix = 'autoshow-bun-baseline'

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    switch (arg) {
      case '--platform': {
        const value = readValue(args, index, arg)
        index += 1
        if (value === 'all') {
          selectedPlatforms.splice(0, selectedPlatforms.length, 'linux/amd64', 'linux/arm64')
          break
        }
        if (!PLATFORM_VALUES.has(value as DockerPlatform)) {
          process.stderr.write(`Unsupported Docker platform: ${value}\n`)
          usage()
        }
        selectedPlatforms.push(value as DockerPlatform)
        break
      }
      case '--output-dir':
        outputDir = resolve(PROJECT_ROOT, readValue(args, index, arg))
        index += 1
        break
      case '--repeats':
        repeats = positiveInteger(readValue(args, index, arg), arg)
        index += 1
        break
      case '--fixture-repeats':
        fixtureRepeats = positiveInteger(readValue(args, index, arg), arg)
        index += 1
        break
      case '--image-prefix':
        imagePrefix = readValue(args, index, arg)
        index += 1
        break
      case '--skip-build':
        skipBuild = true
        break
      case '--help':
      case '-h':
        return usage()
      default:
        process.stderr.write(`Unknown option: ${arg}\n`)
        usage()
    }
  }

  const platforms = selectedPlatforms.length === 0
    ? ['linux/amd64', 'linux/arm64'] as DockerPlatform[]
    : [...new Set(selectedPlatforms)]
  return { platforms, fixturePath, outputDir, repeats, fixtureRepeats, skipBuild, imagePrefix }
}

const run = async (
  command: string,
  args: string[],
  options: { echo?: boolean, allowFailure?: boolean } = {}
): Promise<CommandCapture> => {
  const fullCommand = [command, ...args]
  if (options.echo) process.stdout.write(`$ ${fullCommand.join(' ')}\n`)
  const started = performance.now()
  const proc = Bun.spawn(fullCommand, {
    cwd: PROJECT_ROOT,
    env: { PATH: process.env['PATH'] ?? '' },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  const capture = { command: fullCommand, exitCode, stdout, stderr, durationMs: performance.now() - started }
  if (options.echo && stdout.length > 0) process.stdout.write(stdout)
  if (options.echo && stderr.length > 0) process.stderr.write(stderr)
  if (exitCode !== 0 && options.allowFailure !== true) {
    throw new Error(`Command failed with exit code ${exitCode}: ${fullCommand.join(' ')}\n${stderr || stdout}`)
  }
  return capture
}

const sha256 = async (path: string): Promise<string> => {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(await readFile(path))
  return hasher.digest('hex')
}

const sha256Tree = async (root: string): Promise<string> => {
  const files = (await Array.fromAsync(new Bun.Glob('**/*').scan({ cwd: root, onlyFiles: true }))).sort()
  const hasher = new Bun.CryptoHasher('sha256')
  for (const file of files) {
    hasher.update(`${file}\0`)
    hasher.update(await readFile(resolve(root, file)))
    hasher.update('\0')
  }
  return hasher.digest('hex')
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right)
  const midpoint = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 === 0
    ? ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2
    : sorted[midpoint]
  if (value === undefined) throw new Error('Cannot calculate a median without samples')
  return value
}

const rounded = (value: number): number => Math.round(value * 100) / 100

const imageArchitecture = (platform: DockerPlatform): string => platform.slice(platform.indexOf('/') + 1)

const normalizeArchitecture = (architecture: string): string => {
  if (architecture === 'aarch64') return 'arm64'
  if (architecture === 'x86_64') return 'amd64'
  return architecture
}

const parseJsonOutput = <T>(capture: CommandCapture, label: string): T => {
  try {
    return JSON.parse(capture.stdout.trim()) as T
  } catch (error) {
    throw new Error(`Could not parse ${label} JSON: ${error instanceof Error ? error.message : String(error)}\n${capture.stdout}`)
  }
}

const measurePlatform = async (input: {
  platform: DockerPlatform
  options: Options
  bunPin: string
  packageVersion: string
  vcsRef: string
  buildDate: string
  dockerServerArchitecture: string
}): Promise<PlatformMeasurement> => {
  const { platform, options } = input
  const architecture = imageArchitecture(platform)
  const imageTag = `${options.imagePrefix}:bun-${input.bunPin}-${architecture}`
  const platformDir = resolve(options.outputDir, architecture)
  await mkdir(platformDir, { recursive: true })
  const commands: string[][] = []
  let buildDurationMs: number | null = null

  if (!options.skipBuild) {
    const metadataPath = resolve(platformDir, 'build-metadata.json')
    const buildArgs = [
      'buildx', 'build',
      '--platform', platform,
      '--file', 'Dockerfile',
      '--tag', imageTag,
      '--load',
      '--metadata-file', metadataPath,
      '--build-arg', `AUTOSHOW_VERSION=${input.packageVersion}`,
      '--build-arg', `BUILD_DATE=${input.buildDate}`,
      '--build-arg', `VCS_REF=${input.vcsRef}`,
      '.',
    ]
    process.stdout.write(`$ docker ${buildArgs.join(' ')}\n`)
    const build = await run('docker', buildArgs)
    commands.push(build.command)
    buildDurationMs = rounded(build.durationMs)
    await Bun.write(resolve(platformDir, 'build.log'), `${build.stdout}${build.stderr}`)
  }

  const inspect = await run('docker', ['image', 'inspect', imageTag, '--format', '{{json .}}'])
  commands.push(inspect.command)
  const image = parseJsonOutput<{
    Id: string
    Architecture: string
    Os: string
    Size: number
  }>(inspect, 'docker image inspect')
  if (image.Architecture !== architecture) {
    throw new Error(`Expected ${architecture} image, received ${image.Architecture}`)
  }

  const helpSamples: number[] = []
  for (let index = 0; index < options.repeats; index += 1) {
    const help = await run('docker', ['run', '--rm', '--platform', platform, imageTag, '--help'])
    commands.push(help.command)
    helpSamples.push(rounded(help.durationMs))
  }

  const prebuildSamples: number[] = []
  for (let index = 0; index < options.repeats; index += 1) {
    const prebuild = await run('docker', [
      'run', '--rm', '--platform', platform,
      '--entrypoint', 'bun',
      imageTag,
      '--no-env-file', '-e', PREBUILD_PROBE,
    ])
    commands.push(prebuild.command)
    const parsed = parseJsonOutput<{ durationMs: number }>(prebuild, 'CLI prebuild')
    prebuildSamples.push(rounded(parsed.durationMs))
  }

  const fixturePeakSamples: number[] = []
  for (let index = 0; index < options.fixtureRepeats; index += 1) {
    const fixtureOutput = resolve(platformDir, `fixture-output-${String(index + 1).padStart(2, '0')}`)
    await mkdir(fixtureOutput, { recursive: true })
    await chmod(fixtureOutput, 0o777)
    const memory = await run('docker', [
      'run', '--rm', '--platform', platform,
      '--env', 'NO_COLOR=1',
      '--entrypoint', '/bin/sh',
      '--mount', `type=bind,src=${options.fixturePath},dst=/benchmark/fixture.pdf,readonly`,
      '--mount', `type=bind,src=${fixtureOutput},dst=/benchmark/output`,
      imageTag,
      '-c', MEMORY_PROBE,
    ], { echo: true })
    commands.push(memory.command)
    await Bun.write(resolve(platformDir, `fixture-${String(index + 1).padStart(2, '0')}.log`), `${memory.stdout}${memory.stderr}`)
    const peak = memory.stdout.match(/AUTOSHOW_PEAK_RSS_BYTES=(\d+)/)?.[1]
    if (!peak) throw new Error(`Peak RSS marker missing for ${platform}`)
    fixturePeakSamples.push(Number.parseInt(peak, 10))
  }

  const bunVersion = await run('docker', ['run', '--rm', '--platform', platform, '--entrypoint', 'bun', imageTag, '--version'])
  const machine = await run('docker', ['run', '--rm', '--platform', platform, '--entrypoint', 'uname', imageTag, '-m'])
  const thp = await run('docker', [
    'run', '--rm', '--platform', platform,
    '--entrypoint', '/bin/sh', imageTag,
    '-c', 'if [ -r /sys/kernel/mm/transparent_hugepage/enabled ]; then cat /sys/kernel/mm/transparent_hugepage/enabled; else printf unavailable; fi',
  ])
  commands.push(bunVersion.command, machine.command, thp.command)

  return {
    platform,
    executionMode: normalizeArchitecture(input.dockerServerArchitecture) === architecture ? 'native' : 'emulated',
    image: {
      tag: imageTag,
      id: image.Id,
      architecture: image.Architecture,
      os: image.Os,
      sizeBytes: image.Size,
    },
    runtime: {
      bunVersion: bunVersion.stdout.trim(),
      machine: machine.stdout.trim(),
      transparentHugePages: thp.stdout.trim(),
    },
    measurements: {
      buildDurationMs,
      coldHelpWallMs: { samples: helpSamples, median: rounded(median(helpSamples)) },
      cliPrebuildMs: { samples: prebuildSamples, median: rounded(median(prebuildSamples)) },
      fixturePeakRssBytes: { samples: fixturePeakSamples, median: rounded(median(fixturePeakSamples)) },
    },
    commands,
  }
}

const formatMebibytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(2)} MiB`

const buildSummary = (report: {
  recordedAt: string
  source: { vcsRef: string, dirty: boolean, bunBaseImage: string }
  fixture: { repositoryPath: string, bytes: number, sha256: string }
  platforms: PlatformMeasurement[]
}): string => {
  const rows = report.platforms.map(result => [
    result.platform,
    result.executionMode,
    result.runtime.bunVersion,
    formatMebibytes(result.image.sizeBytes),
    `${result.measurements.coldHelpWallMs.median.toFixed(2)} ms`,
    `${result.measurements.cliPrebuildMs.median.toFixed(2)} ms`,
    formatMebibytes(result.measurements.fixturePeakRssBytes.median),
  ])
  return `# Bun Docker baseline raw summary

Recorded: ${report.recordedAt}

Source: \`${report.source.vcsRef}\`${report.source.dirty ? ' with uncommitted changes' : ''}; base image \`${report.source.bunBaseImage}\`.

Fixture: \`${report.fixture.repositoryPath}\`, ${report.fixture.bytes} bytes, SHA-256 \`${report.fixture.sha256}\`.

| Platform | Execution | Bun | Image size | Cold help median | CLI prebuild median | Peak RSS |
| --- | --- | --- | ---: | ---: | ---: | ---: |
${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}

The JSON artifact beside this file contains every sample, exact command array, Docker runtime identity, image identity, measurement method, and transparent-huge-page state. Re-run the same tool and fixture after changing the Bun pin; do not compare native and emulated rows as if they were equivalent.
`
}

const main = async (): Promise<void> => {
  const options = parseOptions(Bun.argv.slice(2))
  const fixture = Bun.file(options.fixturePath)
  if (!await fixture.exists()) throw new Error(`Fixture does not exist: ${options.fixturePath}`)
  const fixtureSha256 = await sha256(options.fixturePath)
  if (fixtureSha256 !== DEFAULT_FIXTURE_SHA256) throw new Error(`Baseline fixture SHA-256 mismatch: expected ${DEFAULT_FIXTURE_SHA256}, received ${fixtureSha256}`)

  await mkdir(options.outputDir, { recursive: true })
  const dockerfileText = await Bun.file(resolve(PROJECT_ROOT, 'Dockerfile')).text()
  const baseImage = dockerfileText.match(/^ARG BUN_BASE_IMAGE=(\S+)$/m)?.[1]
  const bunPin = baseImage?.match(/^oven\/bun:([0-9]+\.[0-9]+\.[0-9]+)-slim@sha256:/)?.[1]
  if (!baseImage || !bunPin) throw new Error('Could not resolve the exact Bun slim image and digest from Dockerfile')

  const packageJson = await Bun.file(resolve(PROJECT_ROOT, 'package.json')).json() as { version?: string }
  if (!packageJson.version) throw new Error('package.json version is missing')
  const vcsRef = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim()
  const buildDate = (await run('git', ['show', '-s', '--format=%cI', 'HEAD'])).stdout.trim()
  const dirty = (await run('git', ['status', '--short'])).stdout.trim().length > 0
  const dockerVersion = await run('docker', ['version', '--format', '{{json .}}'])
  const dockerInfo = await run('docker', ['info', '--format', '{{json .}}'])
  const dockerServerArchitecture = parseJsonOutput<{ Architecture: string }>(dockerInfo, 'docker info').Architecture
  const fixtureStats = await fixture.stat()

  const platforms: PlatformMeasurement[] = []
  for (const platform of options.platforms) {
    process.stdout.write(`\nMeasuring ${platform} with Bun ${bunPin}\n`)
    platforms.push(await measurePlatform({
      platform,
      options,
      bunPin,
      packageVersion: packageJson.version,
      vcsRef,
      buildDate,
      dockerServerArchitecture,
    }))
  }

  const report = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    source: {
      vcsRef,
      dirty,
      bunBaseImage: baseImage,
      dockerfileSha256: await sha256(resolve(PROJECT_ROOT, 'Dockerfile')),
      packageJsonSha256: await sha256(resolve(PROJECT_ROOT, 'package.json')),
      lockfileSha256: await sha256(resolve(PROJECT_ROOT, 'bun.lock')),
      tsconfigSha256: await sha256(resolve(PROJECT_ROOT, 'tsconfig.json')),
      srcTreeSha256: await sha256Tree(resolve(PROJECT_ROOT, 'src')),
    },
    fixture: {
      repositoryPath: options.fixturePath.startsWith(`${PROJECT_ROOT}/`)
        ? options.fixturePath.slice(PROJECT_ROOT.length + 1)
        : basename(options.fixturePath),
      bytes: fixtureStats.size,
      sha256: fixtureSha256,
      workload: 'Local Tesseract OCR with --ocr-concurrency 1; no hosted provider credentials or calls',
    },
    method: {
      help: `${options.repeats} fresh docker run processes; host wall time; median reported`,
      prebuild: `${options.repeats} fresh containers; in-container performance.now around the test CLI bun build command; median reported`,
      peakRss: `${options.fixtureRepeats} fresh containers; cgroup v2 memory.peak after local fixture completion; median reported`,
      imageSize: 'docker image inspect .Size for the platform-specific loaded image',
    },
    host: {
      dockerServerArchitecture,
      dockerVersion: parseJsonOutput<unknown>(dockerVersion, 'docker version'),
      dockerInfo: parseJsonOutput<unknown>(dockerInfo, 'docker info'),
    },
    platforms,
  }

  const jsonPath = resolve(options.outputDir, 'baseline.json')
  const summaryPath = resolve(options.outputDir, 'summary.md')
  await Bun.write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  await Bun.write(summaryPath, buildSummary(report))
  process.stdout.write(`\nBaseline JSON: ${jsonPath}\nBaseline summary: ${summaryPath}\n`)
}

await main()
