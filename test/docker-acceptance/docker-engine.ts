import { expect } from 'bun:test'
import { requireCondition } from '../test-utils/require-condition'
import { chmod, mkdir } from 'node:fs/promises'
import { isAbsolute, join, posix, relative, resolve } from 'node:path'
import { canonicalImageRepository, nativePlatform, parseImageReference, validateContainerUser } from './docker-options'
import type { DockerOptions, Platform, PullPolicy } from './docker-options'
import { runDockerProcess } from '../../src/tools/docker-process'
import type { ProcessOutcome, ProcessRunner } from '../../src/tools/docker-process'

export interface ImageIdentity {
  requestedTag: string
  pullPolicy: PullPolicy
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
interface ImageInspection {
  Id: string; Os: string; Architecture: string; Size: number; RepoDigests?: string[]
  Config: { Labels?: Record<string, string>; User: string; Entrypoint: string[]; Env?: string[] }
}

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

export interface ContainerRuntimePolicy { user?: string; restricted?: boolean }

/** Existing mount permissions are part of the state contract, not something acceptance repairs. */
export async function prepareAcceptanceDirectory(path: string): Promise<void> {
  const created = await mkdir(path, { recursive: true })
  if (created !== undefined) await chmod(path, 0o777)
}

export function containerArguments(identity: ImageIdentity, name: string, runId: string, mounts: MountMapping[], network: string, args: string[], entrypoint?: string, policy: ContainerRuntimePolicy = {}): string[] {
  const reference = parseImageReference(identity.reference)
  requireCondition(reference.digest === identity.digest || (reference.imageId === identity.imageId && reference.imageId === identity.digest), 'A verified immutable image reference is required')
  const result = ['run', '--rm', '--pull', 'never', '--name', name, '--label', `autoshow.acceptance=${runId}`, '--platform', identity.platform,
    '--network', network, '--workdir', '/workspace', '--env', 'NO_COLOR=1', '--env', 'CI=true', '--env', 'AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1']
  if (policy.user) result.push('--user', validateContainerUser(policy.user))
  if (policy.restricted) result.push('--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true')
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
  identity: ImageIdentity | undefined
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
    this.identity = undefined
    const selected = parseImageReference(this.options.image)
    requireCondition(!(selected.imageId && this.options.pull === 'always'), 'An image ID cannot use --pull always')
    const info = this.requireSuccess(await this.command(['info', '--format', '{{json .Architecture}}']), 'Docker daemon')
    const platform = nativePlatform(JSON.parse(info.stdout) as string)
    requireCondition(!this.options.platform || this.options.platform === platform, `--platform ${this.options.platform} is not native to this ${platform} Docker daemon`)
    let inspection: ProcessOutcome | undefined
    let manifestDigest = selected.digest
    let reference = selected.digest ? `${selected.repository}@${selected.digest}` : selected.reference
    if (this.options.pull !== 'always') {
      inspection = await this.command(['image', 'inspect', selected.reference])
      if (this.options.pull === 'never' || selected.imageId) this.requireSuccess(inspection, 'Inspect selected local image (no registry fallback)')
    }
    if (!inspection || inspection.exitCode !== 0 || inspection.timedOut) {
      const pull = this.requireSuccess(await this.command(['pull', '--platform', platform, selected.reference], this.options.setupTimeoutMs), `Pull ${selected.reference}`)
      const digests = [...new Set([...`${pull.stdout}\n${pull.stderr}`.matchAll(/^Digest:\s+(sha256:[a-f0-9]{64})\s*$/gm)].map(match => match[1]!))]
      expect(digests.length, 'Pull did not report one immutable digest').toBe(1)
      manifestDigest = digests[0]!
      if (selected.digest) expect(manifestDigest, 'Pulled digest differs from the selected immutable reference').toBe(selected.digest)
      reference = `${selected.repository}@${manifestDigest}`
      inspection = this.requireSuccess(await this.command(['image', 'inspect', reference]), 'Inspect pulled digest')
    }
    const images = JSON.parse(inspection.stdout) as ImageInspection[]
    requireCondition(Array.isArray(images) && images.length === 1 && images[0], 'Expected one selected image inspection')
    const image = images[0]
    requireCondition(/^sha256:[a-f0-9]{64}$/.test(image.Id), 'Image inspection did not provide an immutable image ID')
    if (selected.imageId) expect(image.Id, 'Image inspection differs from the selected image ID').toBe(selected.imageId)
    if (manifestDigest) {
      requireCondition(image.RepoDigests?.some(value => {
        const inspected = parseImageReference(value)
        return inspected.digest === manifestDigest && inspected.repository && canonicalImageRepository(inspected.repository) === canonicalImageRepository(selected.repository!)
      }), 'Image inspection did not confirm the selected manifest digest')
    } else reference = image.Id
    const digest = manifestDigest ?? image.Id
    expect(`${image.Os}/${image.Architecture}`, 'Selected architecture differs from native daemon').toBe(platform)
    const username = image.Config.User?.split(':')[0]
    requireCondition(username && username !== 'root' && !/^[+-]?0+$/.test(username), 'Acceptance requires the image normal non-root user')
    requireCondition(image.Config.Entrypoint?.length, 'Image must provide a CLI entrypoint')
    for (const value of image.Config.Env ?? []) {
      const [key, ...rest] = value.split('=')
      requireCondition(!/(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key!) || !rest.join('='), `Image contains credential setting: ${key}`)
    }
    const identity: ImageIdentity = { requestedTag: selected.reference, pullPolicy: this.options.pull, digest, reference, platform, imageId: image.Id, revision: image.Config.Labels?.['org.opencontainers.image.revision'] ?? 'unknown', imageSizeBytes: image.Size, user: image.Config.User, entrypoint: image.Config.Entrypoint }
    if (this.options.expectedDigest) expect(digest, 'Selected image digest differs from the expected digest').toBe(this.options.expectedDigest)
    if (this.options.expectedRevision) expect(identity.revision, 'Image revision differs from expected commit').toBe(this.options.expectedRevision)
    await Bun.write(join(this.options.output, 'image.json'), `${JSON.stringify(identity, null, 2)}\n`)
    this.identity = identity
    return identity
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
      await prepareAcceptanceDirectory(host)
      this.mounts.push({ host, container, readonly })
    }
  }

  async verifyStateAccess(): Promise<void> {
    const script = `import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
const nonce=${JSON.stringify(`.${this.runId}-state-check`)};
for(const root of ['/results','/app/runtime','/home/bun']) {
 const directory=root+'/'+nonce; await mkdir(directory);
 try {const file=directory+'/probe';await writeFile(file,'state-check');if(await readFile(file,'utf8')!=='state-check')throw new Error('State readback failed');}
 finally {await rm(directory,{recursive:true});}
}
console.log(JSON.stringify({stateAccess:'passed',uid:process.getuid(),gid:process.getgid()}));`
    this.requireSuccess(await this.container(['--no-env-file', '-e', script], 'none', 30_000, 'bun'),
      'State mounts must be writable by the selected non-root user. Use --user UID:GID for host-owned caches; acceptance never repairs existing ownership or modes')
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
    const argv = containerArguments(this.identity, name, this.runId, mounts, network, args, entrypoint, this.options)
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
