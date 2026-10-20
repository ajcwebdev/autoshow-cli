import { afterAll, expect, test } from 'bun:test'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DockerEngine, containerArguments } from '../../../docker-acceptance/docker-engine'
import { canonicalImageRepository, parseDockerOptions, parseImageReference, REQUESTED_IMAGE } from '../../../docker-acceptance/docker-options'
import type { ProcessRunner } from '../../../../src/tools/docker-process'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
const digest = `sha256:${'a'.repeat(64)}`
const imageId = `sha256:${'b'.repeat(64)}`
const otherDigest = `sha256:${'d'.repeat(64)}`
const revision = 'c'.repeat(40)
const pinned = `ghcr.io/ajcwebdev/autoshow-cli@${digest}`

async function harness(args: string[], settings: {
  missing?: boolean; pullFails?: boolean; pullDigest?: string; repoDigests?: readonly string[]
  architecture?: string; revision?: string; imageId?: string; user?: string; entrypoint?: readonly string[]; env?: readonly string[]
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-image-selection-'))
  roots.push(root)
  const calls: string[][] = []
  let pulled = false
  const runner: ProcessRunner = async argv => {
    calls.push(argv)
    let stdout = '', stderr = '', exitCode = 0
    if (argv[0] === 'info') stdout = '"aarch64"'
    if (argv[0] === 'pull') {
      if (settings.pullFails) { exitCode = 1; stderr = 'registry unavailable, cached tag is still present' }
      else { pulled = true; stdout = `Digest: ${settings.pullDigest ?? digest}\n` }
    }
    if (argv[0] === 'image') {
      if (settings.missing && !pulled) { exitCode = 1; stderr = `No such image: ${argv.at(-1)}` }
      else stdout = JSON.stringify([{
        Id: settings.imageId ?? imageId, Os: 'linux', Architecture: settings.architecture ?? 'arm64', Size: 123,
        RepoDigests: settings.repoDigests ?? [pinned],
        Config: {
          User: settings.user ?? 'bun', Entrypoint: settings.entrypoint ?? ['bun', '--no-env-file', '/app/src/cli/create-cli.ts'],
          Env: settings.env ?? ['HOME=/home/bun'], Labels: { 'org.opencontainers.image.revision': settings.revision ?? revision }
        }
      }])
    }
    return { exitCode, stdout, stderr, timedOut: false, durationMs: 1 }
  }
  const options = parseDockerOptions(['--output', join(root, 'evidence'), '--cache', join(root, 'cache'), ...args])
  return { engine: new DockerEngine(options, runner), calls, root }
}

test('image selection accepts local tags, registry ports, tagged digests, and full local image IDs', () => {
  for (const reference of [
    'autoshow-cli:local', 'team/autoshow-cli', 'ghcr.io/ajcwebdev/autoshow-cli:commit-123',
    'localhost:5000/team/autoshow-cli:local', 'registry--east.example.com:5443/team/sub/app:v1',
    pinned, `ghcr.io/ajcwebdev/autoshow-cli:candidate@${digest}`, imageId
  ]) expect(parseDockerOptions(['--image', reference, '--pull', 'never']).image).toBe(reference)
  expect(parseImageReference(`ghcr.io/ajcwebdev/autoshow-cli:candidate@${digest}`)).toEqual({ reference: `ghcr.io/ajcwebdev/autoshow-cli:candidate@${digest}`, repository: 'ghcr.io/ajcwebdev/autoshow-cli', digest })
  expect(canonicalImageRepository('ubuntu')).toBe('docker.io/library/ubuntu')
  expect(canonicalImageRepository('index.docker.io/library/ubuntu')).toBe('docker.io/library/ubuntu')
  expect(parseDockerOptions([]).image).toBe(REQUESTED_IMAGE)
  expect(parseDockerOptions([]).pull).toBe('always')
})

test('invalid image references and policies fail during option parsing', () => {
  for (const reference of [
    '-unsafe', 'https://ghcr.io/team/app', 'app:tag with spaces', 'App:tag', 'repo/app:',
    `repo/app@sha256:${'a'.repeat(63)}`, `repo/app@${digest}@${digest}`, 'repo//app', '../app',
    'user:password@registry.example.com/app', 'registry.example.com:65536/team/app', 'repo/app\nother',
    'repo/app\n', 'repo/app:tag\n', `repo/app@${digest}\n`, 'repo/app\u0000'
  ]) expect(() => parseDockerOptions(['--image', reference, '--pull', 'never'])).toThrow('Invalid --image')
  expect(() => parseDockerOptions(['--pull', 'sometimes'])).toThrow('Invalid --pull')
  expect(() => parseDockerOptions(['--image', imageId])).toThrow('cannot use --pull always')
  expect(() => parseDockerOptions(['--image', 'app:local', '--image', 'app:next'])).toThrow('Repeated')
})

test('launcher rejects invalid image options with exit 2 before invoking Docker', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-invalid-image-cli-'))
  roots.push(root)
  await Bun.write(join(root, 'docker'), '#!/bin/sh\nprintf docker-was-invoked\nexit 99\n')
  await chmod(join(root, 'docker'), 0o755)
  for (const args of [['--image', '-unsafe'], ['--pull', 'sometimes'], ['--image', imageId]]) {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/tools/docker-launcher.ts', 'acceptance', ...args], {
      env: { PATH: `${root}:${process.env['PATH'] ?? ''}`, HOME: root }, stdout: 'pipe', stderr: 'pipe'
    })
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(exitCode).toBe(2)
    expect(stderr).toContain('Usage: bun t:docker')
    expect(`${stdout}\n${stderr}`).not.toContain('docker-was-invoked')
  }
})

test('local tag with pull never runs its inspected immutable image ID without a pull', async () => {
  const { engine, calls } = await harness(['--image', 'autoshow-cli:local', '--pull', 'never'], { repoDigests: [] })
  const identity = await engine.resolveImage()
  expect(identity.reference).toBe(imageId)
  expect(identity.digest).toBe(imageId)
  expect(identity.requestedTag).toBe('autoshow-cli:local')
  expect(identity.pullPolicy).toBe('never')
  await engine.container(['help'], 'none', 100)
  expect(calls.filter(argv => argv[0] === 'pull')).toEqual([])
  expect(calls.find(argv => argv[0] === 'image')).toEqual(['image', 'inspect', 'autoshow-cli:local'])
  const run = calls.find(argv => argv[0] === 'run')!
  expect(run).toContain(imageId)
  expect(run).not.toContain('autoshow-cli:local')
  expect(run).toContain('never')
})

test('a missing local image fails without pulling or executing', async () => {
  const { engine, calls } = await harness(['--image', 'autoshow-cli:absent', '--pull', 'never'], { missing: true })
  await expect(engine.resolveImage()).rejects.toThrow('Inspect selected local image')
  expect(engine.identity).toBeUndefined()
  expect(calls.map(argv => argv[0])).toEqual(['info', 'image'])
})

test('full image IDs use local inspection and cannot fall back to a registry when missing', async () => {
  for (const pull of ['never', 'missing']) {
    const found = await harness(['--image', imageId, '--pull', pull])
    expect((await found.engine.resolveImage()).reference).toBe(imageId)
    const absent = await harness(['--image', imageId, '--pull', pull], { missing: true })
    await expect(absent.engine.resolveImage()).rejects.toThrow('no registry fallback')
    expect(absent.calls.map(argv => argv[0])).toEqual(['info', 'image'])
  }
})

test('pull missing reuses the inspected local ID or pulls and verifies an absent registry image', async () => {
  const cached = await harness(['--image', 'autoshow-cli:cached', '--pull', 'missing'])
  expect((await cached.engine.resolveImage()).reference).toBe(imageId)
  expect(cached.calls.map(argv => argv[0])).toEqual(['info', 'image'])
  const absent = await harness(['--image', REQUESTED_IMAGE, '--pull', 'missing'], { missing: true })
  expect((await absent.engine.resolveImage()).reference).toBe(pinned)
  expect(absent.calls.map(argv => argv[0])).toEqual(['info', 'image', 'pull', 'image'])
  expect(absent.calls.at(-1)).toEqual(['image', 'inspect', pinned])
})

test('immutable registry candidates preserve manifest identity and validate the expected revision', async () => {
  for (const pull of ['always', 'never', 'missing']) {
    const { engine, calls } = await harness(['--image', pinned, '--pull', pull, '--expected-digest', digest, '--expected-revision', revision])
    const identity = await engine.resolveImage()
    expect(identity.reference).toBe(pinned)
    expect(identity.digest).toBe(digest)
    expect(identity.imageId).toBe(imageId)
    expect(identity.revision).toBe(revision)
    if (pull === 'always') expect(calls.find(argv => argv[0] === 'pull')).toEqual(['pull', '--platform', 'linux/arm64', pinned])
    else expect(calls.some(argv => argv[0] === 'pull')).toBe(false)
  }
})

test('registry aliases confirm the same Docker Hub repository digest', async () => {
  const reference = `docker.io/library/autoshow@${digest}`
  const { engine } = await harness(['--image', reference, '--pull', 'never'], { repoDigests: [`autoshow@${digest}`] })
  expect((await engine.resolveImage()).reference).toBe(reference)
})

test('a moving tag is inspected and executed only through the digest returned by its successful pull', async () => {
  const { engine, calls } = await harness(['--image', REQUESTED_IMAGE, '--pull', 'always'])
  await engine.resolveImage()
  await engine.container(['help'], 'none', 100)
  // The tag may now point elsewhere; no second tag lookup or mutable run is allowed.
  expect(calls.filter(argv => argv[0] === 'image')).toEqual([['image', 'inspect', pinned]])
  expect(calls.find(argv => argv[0] === 'run')).toContain(pinned)
  expect(calls.find(argv => argv[0] === 'run')).not.toContain(REQUESTED_IMAGE)
})

test('failed pulls never use a cached tag for always or missing policy', async () => {
  for (const pull of ['always', 'missing']) {
    const { engine, calls } = await harness(['--image', REQUESTED_IMAGE, '--pull', pull], { pullFails: true, missing: pull === 'missing' })
    await expect(engine.resolveImage()).rejects.toThrow('registry unavailable')
    expect(engine.identity).toBeUndefined()
    expect(calls.at(-1)?.[0]).toBe('pull')
    expect(calls.some(argv => argv[0] === 'run')).toBe(false)
  }
})

test('a pull cannot substitute a different digest for an immutable candidate', async () => {
  const { engine, calls } = await harness(['--image', pinned, '--pull', 'always'], { pullDigest: otherDigest })
  await expect(engine.resolveImage()).rejects.toThrow('differs from the selected immutable reference')
  expect(engine.identity).toBeUndefined()
  expect(calls.map(argv => argv[0])).toEqual(['info', 'pull'])
})

test('wrong architecture, revision, digest, root user, entrypoint, credentials, and malformed IDs fail closed', async () => {
  for (const [settings, message] of [
    [{ architecture: 'amd64' }, 'differs from native daemon'],
    [{ revision: 'e'.repeat(40) }, 'differs from expected commit'],
    [{ repoDigests: [`ghcr.io/other/app@${digest}`] }, 'did not confirm the selected manifest digest'],
    [{ repoDigests: [`ghcr.io/ajcwebdev/autoshow-cli@${otherDigest}`] }, 'did not confirm the selected manifest digest'],
    [{ user: 'root' }, 'non-root user'],
    [{ user: '0:1000' }, 'non-root user'],
    [{ user: '0000' }, 'non-root user'],
    [{ entrypoint: [] }, 'CLI entrypoint'],
    [{ env: ['OPENAI_API_KEY=embedded-credential'] }, 'credential setting'],
    [{ imageId: 'sha256:short' }, 'immutable image ID']
  ] as const) {
    const { engine, calls } = await harness(['--image', pinned, '--pull', 'always', '--expected-revision', revision], settings)
    await expect(engine.resolveImage()).rejects.toThrow(message)
    expect(engine.identity).toBeUndefined()
    expect(calls.some(argv => argv[0] === 'run')).toBe(false)
    expect(await Bun.file(join(engine.options.output, 'image.json')).exists()).toBe(false)
  }
})

test('container argument construction rejects a mutable or inconsistent execution reference', async () => {
  const { engine } = await harness(['--image', 'autoshow-cli:local', '--pull', 'never'])
  const identity = await engine.resolveImage()
  for (const reference of ['autoshow-cli:local', otherDigest]) {
    expect(() => containerArguments({ ...identity, reference }, 'owned', 'run', [], 'none', ['help'])).toThrow('verified immutable')
  }
})
