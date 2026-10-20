import { requireCondition } from '../test-utils/require-condition'
import { resolve } from 'node:path'

export const REQUESTED_IMAGE = 'ghcr.io/ajcwebdev/autoshow-cli:latest'
export type Suite = 'all' | 'core' | 'models' | 'network'
export type Platform = 'linux/amd64' | 'linux/arm64'
export type PullPolicy = 'always' | 'missing' | 'never'
export interface ImageSelection { reference: string; repository?: string; digest?: string; imageId?: string }

export function parseImageReference(reference: string): ImageSelection {
  requireCondition(reference && !/[\s\u0000-\u001f\u007f]/.test(reference), 'Invalid --image reference')
  if (/^sha256:[a-f0-9]{64}$/.test(reference)) return { reference, imageId: reference }
  const parts = reference.split('@')
  requireCondition(parts.length <= 2 && parts[0], 'Invalid --image reference')
  const digest = parts[1]
  requireCondition(parts.length === 1 || (digest && /^sha256:[a-f0-9]{64}$/.test(digest)), 'Invalid --image digest')
  const name = parts[0]
  const tagIndex = name.lastIndexOf(':') > name.lastIndexOf('/') ? name.lastIndexOf(':') : -1
  const repository = tagIndex === -1 ? name : name.slice(0, tagIndex)
  const tag = tagIndex === -1 ? undefined : name.slice(tagIndex + 1)
  requireCondition(!tag || /^[\w][\w.-]{0,127}$/.test(tag), 'Invalid --image tag')
  requireCondition(tagIndex === -1 || tag, 'Invalid --image tag')
  const components = repository.split('/')
  if (components.length > 1 && (/[.:]/.test(components[0]!) || components[0] === 'localhost')) {
    const registry = components.shift()!
    requireCondition(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::[0-9]{1,5})?$/.test(registry), 'Invalid --image registry')
    const port = registry.split(':')[1]
    requireCondition(!port || (Number(port) > 0 && Number(port) <= 65535), 'Invalid --image registry port')
  }
  requireCondition(repository.length <= 255 && components.length > 0 && components.every(component => /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/.test(component)), 'Invalid --image repository')
  return { reference, repository, ...(digest ? { digest } : {}) }
}

// Docker Hub may spell the same repository with or without its default registry/namespace.
export function canonicalImageRepository(repository: string): string {
  const components = repository.split('/')
  if (components.length === 1 || (!/[.:]/.test(components[0]!) && components[0] !== 'localhost')) components.unshift('docker.io')
  if (components[0] === 'index.docker.io') components[0] = 'docker.io'
  if (components[0] === 'docker.io' && components.length === 2) components.splice(1, 0, 'library')
  return components.join('/')
}

export interface DockerOptions {
  suite: Suite
  image: string
  pull: PullPolicy
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
  --image REFERENCE          Local image/tag or registry reference (default GHCR latest)
  --pull always|missing|never  Pull policy (default always; local builds use never)
  --model ENGINE:MODEL       Select one models shard (requires --suite models)
  --output PATH              New evidence directory (default runtime/docker-acceptance/runs/<unique-id>)
  --cache PATH               Persistent assets (default runtime/docker-acceptance/cache)
  --setup-timeout SECONDS    Setup/download deadline, 1–7200 (default 1800)
  --case-timeout SECONDS     Per-case deadline, 1–7200 (default 1200)
  --expected-digest DIGEST   Require the resolved manifest digest or local image ID
  --expected-revision SHA    Fail if the image revision differs (CI)
  --help                    Print help without starting Docker

Every container uses a verified immutable digest or local image ID. A failed pull never falls back to a cached tag.
Platforms must match the Docker daemon's native architecture. Image IDs require --pull never or missing.
No hosted inference or provider credentials. Model/public downloads need internet. Failures retain evidence and caches.
Exit: 0 all selected cases passed; 1 acceptance/infrastructure failure; 2 invalid arguments.
`

export function parseDockerOptions(args: string[]): DockerOptions {
  const options: DockerOptions = {
    suite: 'all', image: REQUESTED_IMAGE, pull: 'always', output: resolve('runtime/docker-acceptance/runs', `${new Date().toISOString().replaceAll(':', '-')}-${crypto.randomUUID().slice(0, 8)}`),
    cache: resolve('runtime/docker-acceptance/cache'), setupTimeoutMs: 1800_000, caseTimeoutMs: 1200_000, help: false
  }
  const seen = new Set<string>()
  for (let index = 0; index < args.length; index++) {
    const key = args[index]!
    if (key === '--help' || key === '-h') { options.help = true; continue }
    requireCondition(!seen.has(key), `Repeated option: ${key}`)
    seen.add(key)
    const value = args[++index]
    requireCondition(value && !value.startsWith('--'), `Missing value for ${key}`)
    switch (key) {
      case '--suite': requireCondition(['all', 'core', 'models', 'network'].includes(value), 'Invalid --suite'); options.suite = value as Suite; break
      case '--image': parseImageReference(value); options.image = value; break
      case '--pull': requireCondition(['always', 'missing', 'never'].includes(value), 'Invalid --pull'); options.pull = value as PullPolicy; break
      case '--platform': requireCondition(['linux/amd64', 'linux/arm64'].includes(value), 'Invalid --platform'); options.platform = value as Platform; break
      case '--model': options.model = value; break
      case '--output': options.output = resolve(value); break
      case '--cache': options.cache = resolve(value); break
      case '--expected-digest': requireCondition(/^sha256:[a-f0-9]{64}$/.test(value), 'Invalid --expected-digest'); options.expectedDigest = value; break
      case '--expected-revision': requireCondition(/^[a-f0-9]{40}$/.test(value), 'Invalid --expected-revision'); options.expectedRevision = value; break
      case '--setup-timeout': case '--case-timeout': {
        requireCondition(/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 7200, `${key} must be 1–7200 seconds`)
        options[key === '--setup-timeout' ? 'setupTimeoutMs' : 'caseTimeoutMs'] = Number(value) * 1000
        break
      }
      default: throw new Error(`Unknown option: ${key}`)
    }
  }
  requireCondition(!(parseImageReference(options.image).imageId && options.pull === 'always'), 'An image ID cannot use --pull always')
  requireCondition(!options.model || options.suite === 'models', '--model requires --suite models')
  for (const path of [options.output, options.cache]) requireCondition(!/[,\r\n]/.test(path), 'Mount paths cannot contain commas or newlines')
  requireCondition(options.output !== options.cache && !options.output.startsWith(`${options.cache}/`) && !options.cache.startsWith(`${options.output}/`), 'Evidence and cache paths must be separate')
  return options
}

export function nativePlatform(architecture: string): Platform {
  if (['amd64', 'x86_64'].includes(architecture)) return 'linux/amd64'
  if (['arm64', 'aarch64'].includes(architecture)) return 'linux/arm64'
  throw new Error(`Unsupported Docker daemon architecture: ${architecture}`)
}
