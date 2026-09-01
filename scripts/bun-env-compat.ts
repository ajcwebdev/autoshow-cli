import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'

type Options = {
  envFile: string
  outputPath: string
  platform?: 'linux/amd64' | 'linux/arm64'
}

type ProbeResult = Record<string, string | null>

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const BUN_1_3_IMAGE = 'oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04'
const DEFAULT_OUTPUT_ROOT = resolve(PROJECT_ROOT, 'runtime/profiling/bun-env-compat')
const KEY_PATTERN = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm
const PROBE_SOURCE = `
const keys = await Bun.file('/autoshow-env-probe/keys.json').json()
const salt = await Bun.file('/autoshow-env-probe/salt').text()
const result = {}
for (const key of keys) {
  const value = process.env[key]
  result[key] = value === undefined
    ? null
    : new Bun.CryptoHasher('sha256').update(salt).update('\\0').update(value).digest('hex')
}
process.stdout.write(JSON.stringify(result))
`

const timestampSegment = (): string => new Date().toISOString().replace(/[:.]/g, '-')

const usage = (): never => {
  process.stderr.write(`Usage: bun compare:env [options]

Options:
  --env-file <path>                       Env file to compare; defaults to .env
  --output <path>                         Redacted JSON report path
  --platform <linux/amd64|linux/arm64>    Docker platform; defaults to the native platform
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

const parseOptions = (args: string[]): Options => {
  let envFile = resolve(PROJECT_ROOT, '.env')
  let outputPath = resolve(DEFAULT_OUTPUT_ROOT, `${timestampSegment()}.json`)
  let platform: Options['platform']

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    switch (arg) {
      case '--env-file':
        envFile = resolve(PROJECT_ROOT, readValue(args, index, arg))
        index += 1
        break
      case '--output':
        outputPath = resolve(PROJECT_ROOT, readValue(args, index, arg))
        index += 1
        break
      case '--platform': {
        const value = readValue(args, index, arg)
        index += 1
        if (value !== 'linux/amd64' && value !== 'linux/arm64') {
          process.stderr.write(`Unsupported Docker platform: ${value}\n`)
          usage()
        }
        platform = value as NonNullable<Options['platform']>
        break
      }
      case '--help':
      case '-h':
        return usage()
      default:
        process.stderr.write(`Unknown option: ${arg}\n`)
        usage()
    }
  }

  return { envFile, outputPath, ...(platform ? { platform } : {}) }
}

const extractKeys = (source: string): string[] =>
  [...new Set([...source.matchAll(KEY_PATTERN)].map(match => match[1]).filter((key): key is string => key !== undefined))].sort()

const currentBunImage = async (): Promise<string> => {
  const dockerfile = await readFile(resolve(PROJECT_ROOT, 'Dockerfile'), 'utf8')
  const image = dockerfile.match(/^ARG BUN_BASE_IMAGE=(\S+)$/m)?.[1]
  if (!image) throw new Error('Could not resolve BUN_BASE_IMAGE from Dockerfile')
  return image
}

const probeImage = async (input: {
  image: string
  envFile: string
  probeDir: string
  platform?: Options['platform']
}): Promise<ProbeResult> => {
  const args = [
    'run', '--rm',
    ...(input.platform ? ['--platform', input.platform] : []),
    '--workdir', '/autoshow-env-source',
    '--mount', `type=bind,src=${input.envFile},dst=/autoshow-env-source/.env,readonly`,
    '--mount', `type=bind,src=${input.probeDir},dst=/autoshow-env-probe,readonly`,
    '--entrypoint', 'bun',
    input.image,
    '-e', PROBE_SOURCE
  ]
  const proc = Bun.spawn(['docker', ...args], {
    cwd: PROJECT_ROOT,
    env: { PATH: process.env['PATH'] ?? '' },
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  if (exitCode !== 0) throw new Error(`Docker env probe failed for ${input.image}: ${stderr || stdout}`)
  try {
    return JSON.parse(stdout) as ProbeResult
  } catch (error) {
    throw new Error(`Could not parse redacted env probe output for ${input.image}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const main = async (): Promise<void> => {
  const options = parseOptions(Bun.argv.slice(2))
  const envSource = await readFile(options.envFile, 'utf8')
  const keys = extractKeys(envSource)
  if (keys.length === 0) throw new Error(`No dotenv keys were found in ${options.envFile}`)

  const probeDir = await mkdtemp(resolve(tmpdir(), 'autoshow-bun-env-'))
  try {
    await writeFile(resolve(probeDir, 'keys.json'), `${JSON.stringify(keys)}\n`, { mode: 0o600 })
    await writeFile(resolve(probeDir, 'salt'), crypto.getRandomValues(new Uint8Array(32)), { mode: 0o600 })

    const bun14Image = await currentBunImage()
    const [bun13, bun14] = await Promise.all([
      probeImage({ image: BUN_1_3_IMAGE, envFile: options.envFile, probeDir, ...(options.platform ? { platform: options.platform } : {}) }),
      probeImage({ image: bun14Image, envFile: options.envFile, probeDir, ...(options.platform ? { platform: options.platform } : {}) })
    ])
    const changedKeys = keys.filter(key => bun13[key] !== bun14[key])
    const report = {
      schemaVersion: 1,
      recordedAt: new Date().toISOString(),
      source: {
        filename: basename(options.envFile),
        keyCount: keys.length,
        valuesRecorded: false,
        hashSaltRecorded: false
      },
      platform: options.platform ?? 'native',
      images: { bun13: BUN_1_3_IMAGE, bun14: bun14Image },
      matches: changedKeys.length === 0,
      changedKeys,
      parsed: { bun13, bun14 }
    }

    await mkdir(dirname(options.outputPath), { recursive: true })
    await Bun.write(options.outputPath, `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`Compared ${keys.length} dotenv keys without printing credential values.\n`)
    process.stdout.write(`Redacted report: ${options.outputPath}\n`)
    if (changedKeys.length > 0) {
      process.stderr.write(`Bun dotenv parsing changed for: ${changedKeys.join(', ')}\n`)
      process.exitCode = 1
    } else {
      process.stdout.write('Bun 1.3 and Bun 1.4 parsed values match.\n')
    }
  } finally {
    await rm(probeDir, { recursive: true, force: true })
  }
}

await main()
