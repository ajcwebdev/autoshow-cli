import { expect } from 'bun:test'
import { requireCondition } from '../test-utils/require-condition'
import { chmod, mkdir } from 'node:fs/promises'
import { isAbsolute, join, posix, relative, resolve } from 'node:path'
import { IMAGE_REPOSITORY, nativePlatform, REQUESTED_IMAGE } from './docker-options'
import type { DockerOptions, Platform } from './docker-options'
import { runDockerProcess } from '../../src/tools/docker-process'
import type { ProcessOutcome, ProcessRunner } from '../../src/tools/docker-process'

export interface ImageIdentity {
  requestedTag: string
  digest: string
  reference: string
  platform: Platform
  imageId: string
  revision: string
  cliVersion?: string
  imageSizeBytes: number
  user: string
  entrypoint: string[]
}

export interface CommandEvidence extends ProcessOutcome { argv: string[]; logPrefix: string }
export interface MountMapping { host: string; container: string; readonly?: boolean }

export function mapArtifactPath(path: string, mounts: MountMapping[], relativeTo = '/results'): string {
  const absolute = posix.resolve(relativeTo, path)
  const mount = [...mounts].sort((a, b) => b.container.length - a.container.length)
    .find(item => absolute === item.container || absolute.startsWith(`${item.container}/`))
  requireCondition(mount, `Artifact path is outside the acceptance mounts: ${path}`)
  const mapped = resolve(mount.host, posix.relative(mount.container, absolute))
  const suffix = relative(mount.host, mapped)
  requireCondition(!suffix.startsWith('..') && !isAbsolute(suffix), `Artifact escaped mount: ${path}`)
  return mapped
}

export function containerArguments(identity: ImageIdentity, name: string, runId: string, mounts: MountMapping[], network: string, args: string[], entrypoint?: string): string[] {
  requireCondition(identity.reference.startsWith(`${IMAGE_REPOSITORY}@sha256:`), 'An immutable GHCR reference is required')
  const result = ['run', '--rm', '--pull', 'never', '--name', name, '--label', `autoshow.acceptance=${runId}`, '--platform', identity.platform,
    '--network', network, '--workdir', '/workspace', '--env', 'NO_COLOR=1', '--env', 'CI=true', '--env', 'AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1']
  for (const mount of mounts) {
    requireCondition(!/[,\r\n]/.test(mount.host), 'Unsafe mount path')
    requireCondition(!['/app', '/app/src', '/app/node_modules'].includes(mount.container), 'Cannot replace image source')
    result.push('--mount', `type=bind,src=${mount.host},dst=${mount.container}${mount.readonly ? ',readonly' : ''}`)
  }
  if (entrypoint) result.push('--entrypoint', entrypoint)
  return [...result, identity.reference, ...args]
}

export class DockerEngine {
  readonly runId = `autoshow-acceptance-${crypto.randomUUID()}`
  readonly commands: CommandEvidence[] = []
  readonly owned = new Set<string>()
  readonly mounts: MountMapping[] = []
  identity?: ImageIdentity
  fixtureNetwork: string | undefined
  interrupted = false
  private sequence = 0
  private readonly authorized = new Map<string, string>()

  constructor(readonly options: DockerOptions, readonly processRunner: ProcessRunner = runDockerProcess) {}

  async command(argv: string[], timeoutMs = 60_000, onTimeout?: () => Promise<void>): Promise<ProcessOutcome> {
    const logPrefix = join(this.options.output, 'logs', String(++this.sequence).padStart(4, '0'))
    await Bun.write(`${logPrefix}.command.json`, `${JSON.stringify({ argv: ['docker', ...argv], timeoutMs }, null, 2)}\n`)
    let result: ProcessOutcome
    try { result = await this.processRunner(argv, timeoutMs, logPrefix, onTimeout) }
    catch (error) { result = { exitCode: -1, stdout: '', stderr: String(error), durationMs: 0, timedOut: false } }
    this.commands.push({ argv: ['docker', ...argv], logPrefix, ...result })
    await Bun.write(`${logPrefix}.result.json`, `${JSON.stringify(result, null, 2)}\n`)
    return result
  }

  requireSuccess(result: ProcessOutcome, purpose: string): ProcessOutcome {
    requireCondition(!result.timedOut, `${purpose} timed out; see logs in ${this.options.output}`)
    expect(result.exitCode, `${purpose} failed:\n${result.stderr.slice(-6000)}`).toBe(0)
    return result
  }

  async resolveImage(): Promise<ImageIdentity> {
    const info = this.requireSuccess(await this.command(['info', '--format', '{{json .Architecture}}']), 'Docker daemon')
    const platform = nativePlatform(JSON.parse(info.stdout) as string)
    requireCondition(!this.options.platform || this.options.platform === platform, `--platform ${this.options.platform} is not native to this ${platform} Docker daemon`)
    // A pull failure is terminal, even if a stale local tag exists.
    const pull = this.requireSuccess(await this.command(['pull', '--platform', platform, REQUESTED_IMAGE], this.options.setupTimeoutMs), 'Pull latest')
    const digests = [...new Set([...`${pull.stdout}\n${pull.stderr}`.matchAll(/^Digest:\s+(sha256:[a-f0-9]{64})\s*$/gm)].map(match => match[1]!))]
    expect(digests.length, 'Pull did not report one immutable digest').toBe(1)
    const digest = digests[0]!
    const reference = `${IMAGE_REPOSITORY}@${digest}`
    // Inspect by the pull's digest as well: another client could now replace the local tag.
    // The pull and architecture check enforce native execution without requiring
    // image inspect --platform, which older Docker clients do not support.
    const inspection = this.requireSuccess(await this.command(['image', 'inspect', reference]), 'Inspect pulled digest')
    const [image] = JSON.parse(inspection.stdout) as Array<{ Id: string; Os: string; Architecture: string; Size: number; RepoDigests: string[]; Config: { Labels?: Record<string, string>; User: string; Entrypoint: string[]; Env: string[] } }>
    requireCondition(image, 'Missing pulled image inspection')
    requireCondition(image.RepoDigests.includes(reference), 'Image inspection did not confirm the pulled digest')
    expect(`${image.Os}/${image.Architecture}`, 'Pulled architecture differs from native daemon').toBe(platform)
    requireCondition(image.Config.User && !['0', 'root'].includes(image.Config.User.split(':')[0]!), 'Acceptance requires the image normal non-root user')
    requireCondition(image.Config.Entrypoint?.length, 'Image must provide a CLI entrypoint')
    for (const value of image.Config.Env ?? []) {
      const [key, ...rest] = value.split('=')
      requireCondition(!/(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key!) || !rest.join('='), `Image contains credential setting: ${key}`)
    }
    this.identity = { requestedTag: REQUESTED_IMAGE, digest, reference, platform, imageId: image.Id, revision: image.Config.Labels?.['org.opencontainers.image.revision'] ?? 'unknown', imageSizeBytes: image.Size, user: image.Config.User, entrypoint: image.Config.Entrypoint }
    await Bun.write(join(this.options.output, 'image.json'), `${JSON.stringify(this.identity, null, 2)}\n`)
    if (this.options.expectedDigest) expect(digest, 'latest changed since publication').toBe(this.options.expectedDigest)
    if (this.options.expectedRevision) expect(this.identity.revision, 'Image revision differs from published commit').toBe(this.options.expectedRevision)
    return this.identity
  }

  async prepareMounts(): Promise<void> {
    requireCondition(this.identity)
    const cache = join(this.options.cache, this.identity.platform.replace('/', '-'))
    for (const [host, container, readonly] of [
      [join(this.options.output, 'fixtures'), '/fixtures', true],
      [join(this.options.output, 'outputs'), '/results', false],
      [join(cache, 'runtime'), '/app/runtime', false],
      [join(cache, 'home'), '/home/bun', false]
    ] as const) {
      await mkdir(host, { recursive: true })
      // These directories belong to this suite, never user input/output directories.
      await chmod(host, 0o777)
      this.mounts.push({ host, container, readonly })
    }
  }

  async repairCacheOwnership(): Promise<void> {
    requireCondition(this.identity)
    // CI cache extraction changes ownership to the host runner UID. whisperfile setup
    // chmods existing bundles, so write permissions alone do not make a restored cache reusable.
    const mounts = this.mounts.filter(mount => ['/app/runtime', '/home/bun'].includes(mount.container))
    expect(mounts.length, 'Cache ownership repair requires only the two asset mounts').toBe(2)
    const name = `${this.runId}-${++this.sequence}`
    const argv = containerArguments(this.identity, name, this.runId, mounts, 'none', ['-R', this.identity.user, '/app/runtime', '/home/bun'], 'chown')
    argv.splice(1, 0, '--user', '0')
    this.requireSuccess(await this.ownedCommand(name, argv, 120_000), 'Restore cache ownership to image user')
  }

  authorize(args: string[], network: string): void { this.authorized.set(JSON.stringify(args), network) }

  async cli(args: string[], outputId: string, network: string, timeoutMs = this.options.caseTimeoutMs): Promise<ProcessOutcome> {
    expect(this.authorized.get(JSON.stringify(args)), `Command is outside the no-cost acceptance allowlist: ${JSON.stringify(args)}`).toBe(network)
    return this.container([...args, '--config-path', '/fixtures/empty-config.json', '--no-color', '--output-root', `/results/${outputId}`], network, timeoutMs)
  }

  async container(args: string[], network: string, timeoutMs: number, entrypoint?: string, writableFixtures = false): Promise<ProcessOutcome> {
    requireCondition(this.identity)
    requireCondition(!this.interrupted, 'Acceptance interrupted')
    const name = `${this.runId}-${++this.sequence}`
    const mounts = this.mounts.map(mount => mount.container === '/fixtures' && writableFixtures ? { ...mount, readonly: false } : mount)
    const argv = containerArguments(this.identity, name, this.runId, mounts, network, args, entrypoint)
    return this.ownedCommand(name, argv, timeoutMs)
  }

  private async ownedCommand(name: string, argv: string[], timeoutMs: number): Promise<ProcessOutcome> {
    requireCondition(!this.interrupted, 'Acceptance interrupted')
    this.owned.add(name)
    try { return await this.command(argv, timeoutMs, () => this.removeOwned(name)) }
    finally { await this.removeOwned(name) }
  }

  async removeOwned(name: string): Promise<void> {
    if (!this.owned.has(name)) return
    const result = await this.command(['rm', '--force', name], 20_000)
    if (result.exitCode === 0 || result.stderr.includes('No such container')) this.owned.delete(name)
  }

  async cleanup(): Promise<void> {
    for (const name of [...this.owned]) await this.removeOwned(name)
    if (this.fixtureNetwork) {
      const result = await this.command(['network', 'rm', this.fixtureNetwork], 20_000)
      if (result.exitCode === 0) this.fixtureNetwork = undefined
    }
    expect(this.owned.size, 'Could not remove suite-owned containers; inspect retained logs').toBe(0)
    requireCondition(!this.fixtureNetwork, 'Could not remove suite-owned fixture network; inspect retained logs')
  }
}
