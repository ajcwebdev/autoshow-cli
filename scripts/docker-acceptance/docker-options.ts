import assert from 'node:assert/strict'
import { resolve } from 'node:path'

export const REQUESTED_IMAGE = 'ghcr.io/ajcwebdev/autoshow-cli:latest'
export const IMAGE_REPOSITORY = REQUESTED_IMAGE.slice(0, -':latest'.length)
export type Suite = 'all' | 'core' | 'models' | 'network'
export type Platform = 'linux/amd64' | 'linux/arm64'
export interface DockerOptions {
  suite: Suite
  platform?: Platform
  model?: string
  expectedDigest?: string
  expectedRevision?: string
  output: string
  cache: string
  setupTimeoutMs: number
  caseTimeoutMs: number
  help: boolean
}

export const DOCKER_HELP = `Usage: bun t:docker [--suite all|core|models|network] [--platform linux/amd64|linux/arm64]
  --model ENGINE:MODEL       Select one models shard (requires --suite models)
  --output PATH              New evidence directory (default runtime/docker-acceptance/runs/<unique-id>)
  --cache PATH               Persistent assets (default runtime/docker-acceptance/cache)
  --setup-timeout SECONDS    Setup/download deadline, 1–7200 (default 1800)
  --case-timeout SECONDS     Per-case deadline, 1–7200 (default 1200)
  --expected-digest DIGEST   Fail if latest differs from the published manifest (CI)
  --expected-revision SHA    Fail if the image revision differs (CI)
  --help                    Print help without starting Docker

Every run pulls GHCR latest and uses its immutable digest. Platforms must match the Docker daemon's native architecture.
No hosted inference or credentials. Model/public downloads need internet. Failures retain evidence and caches.
Exit: 0 all selected cases passed; 1 acceptance/infrastructure failure; 2 invalid arguments.
`

export function parseDockerOptions(args: string[]): DockerOptions {
  const options: DockerOptions = {
    suite: 'all', output: resolve('runtime/docker-acceptance/runs', `${new Date().toISOString().replaceAll(':', '-')}-${crypto.randomUUID().slice(0, 8)}`),
    cache: resolve('runtime/docker-acceptance/cache'), setupTimeoutMs: 1800_000, caseTimeoutMs: 1200_000, help: false
  }
  const seen = new Set<string>()
  for (let index = 0; index < args.length; index++) {
    const key = args[index]!
    if (key === '--help' || key === '-h') { options.help = true; continue }
    assert(!seen.has(key), `Repeated option: ${key}`)
    seen.add(key)
    const value = args[++index]
    assert(value && !value.startsWith('--'), `Missing value for ${key}`)
    switch (key) {
      case '--suite': assert(['all', 'core', 'models', 'network'].includes(value), 'Invalid --suite'); options.suite = value as Suite; break
      case '--platform': assert(['linux/amd64', 'linux/arm64'].includes(value), 'Invalid --platform'); options.platform = value as Platform; break
      case '--model': options.model = value; break
      case '--output': options.output = resolve(value); break
      case '--cache': options.cache = resolve(value); break
      case '--expected-digest': assert(/^sha256:[a-f0-9]{64}$/.test(value), 'Invalid --expected-digest'); options.expectedDigest = value; break
      case '--expected-revision': assert(/^[a-f0-9]{40}$/.test(value), 'Invalid --expected-revision'); options.expectedRevision = value; break
      case '--setup-timeout': case '--case-timeout': {
        assert(/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 7200, `${key} must be 1–7200 seconds`)
        options[key === '--setup-timeout' ? 'setupTimeoutMs' : 'caseTimeoutMs'] = Number(value) * 1000
        break
      }
      default: throw new Error(`Unknown option: ${key}`)
    }
  }
  assert(!options.model || options.suite === 'models', '--model requires --suite models')
  // Docker --mount uses CSV; spaces are safe, commas and newlines are not supported here.
  for (const path of [options.output, options.cache]) assert(!/[,\r\n]/.test(path), 'Mount paths cannot contain commas or newlines')
  assert(options.output !== options.cache && !options.output.startsWith(`${options.cache}/`) && !options.cache.startsWith(`${options.output}/`), 'Evidence and cache paths must be separate')
  return options
}

export function nativePlatform(architecture: string): Platform {
  if (['amd64', 'x86_64'].includes(architecture)) return 'linux/amd64'
  if (['arm64', 'aarch64'].includes(architecture)) return 'linux/arm64'
  throw new Error(`Unsupported Docker daemon architecture: ${architecture}`)
}
