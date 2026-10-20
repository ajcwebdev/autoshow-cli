import { describe, expect, test } from 'bun:test'
import { releaseIndex, validateCandidateIndex, type DockerIndexCommand, type NativeDigests } from '~/tools/docker-release-index'

const IMAGE = 'ghcr.io/ajcwebdev/autoshow-cli'
const COMMIT = 'a'.repeat(40)
const sha = (value: number): string => `sha256:${value.toString(16).padStart(64, '0')}`
const DIGESTS: NativeDigests = { amd64: sha(1), arm64: sha(2) }
const CANDIDATE = sha(3)
const PREVIOUS_LATEST = sha(4)
const INDEX_TYPE = 'application/vnd.oci.image.index.v1+json'
const MANIFEST_TYPE = 'application/vnd.oci.image.manifest.v1+json'

type Descriptor = {
  mediaType: string
  digest: string
  size: number
  platform: { architecture: string; os: string; variant?: string }
  annotations?: Record<string, string>
}

const nativeDescriptors = (arch: 'amd64' | 'arm64'): Descriptor[] => {
  const runtime = sha(arch === 'amd64' ? 11 : 21)
  return [
    { mediaType: MANIFEST_TYPE, digest: runtime, size: 1024, platform: { architecture: arch, os: 'linux', ...(arch === 'arm64' ? { variant: 'v8' } : {}) } },
    {
      mediaType: MANIFEST_TYPE, digest: sha(arch === 'amd64' ? 12 : 22), size: 512,
      platform: { architecture: 'unknown', os: 'unknown' },
      annotations: { 'vnd.docker.reference.digest': runtime, 'vnd.docker.reference.type': 'attestation-manifest', 'com.autoshow.evidence': `sbom-and-provenance-${arch}` },
    },
  ]
}
const index = (manifests: Descriptor[]): string => JSON.stringify({ schemaVersion: 2, mediaType: INDEX_TYPE, manifests })
const sourceIndexes = (): Record<'amd64' | 'arm64', string> => ({ amd64: index(nativeDescriptors('amd64')), arm64: index(nativeDescriptors('arm64')) })
const candidateDescriptors = (): Descriptor[] => [...nativeDescriptors('amd64'), ...nativeDescriptors('arm64')]

type StubOptions = {
  raw?: Record<string, string>
  formatted?: Record<string, string>
  fail?: (args: string[]) => boolean
}

const dockerStub = (options: StubOptions = {}) => {
  const sources = sourceIndexes()
  const raw: Record<string, string> = {
    [`${IMAGE}@${DIGESTS.amd64}`]: sources.amd64,
    [`${IMAGE}@${DIGESTS.arm64}`]: sources.arm64,
    [`${IMAGE}@${CANDIDATE}`]: index(candidateDescriptors()),
    ...options.raw,
  }
  const tags = new Map<string, string>([[`${IMAGE}:latest`, PREVIOUS_LATEST]])
  const calls: string[][] = []
  const command: DockerIndexCommand = async args => {
    calls.push([...args])
    if (options.fail?.(args)) throw new Error(`Injected Docker failure: ${args.join(' ')}`)
    if (args[0] === 'create' && args[1] === '--tag' && args[2]) {
      const source = args[3]
      tags.set(args[2], args.length === 4 && source ? source.slice(source.indexOf('@') + 1) : CANDIDATE)
      return ''
    }
    if (args[0] === 'inspect' && args[1] === '--raw' && args[2] && args.length === 3) {
      const value = raw[args[2]]
      if (value === undefined) throw new Error(`Unexpected raw index: ${args[2]}`)
      return value
    }
    if (args[0] === 'inspect' && args[1] === '--format' && args[2] === '{{.Manifest.Digest}}' && args[3] && args.length === 4) {
      const value = options.formatted?.[args[3]] ?? tags.get(args[3])
      if (value === undefined) throw new Error(`Unexpected tag: ${args[3]}`)
      return `${value}\n`
    }
    throw new Error(`Unexpected Docker invocation: ${args.join(' ')}`)
  }
  return { command, calls, tags }
}

const latestMutations = (calls: string[][]): string[][] => calls.filter(args => args[0] === 'create' && args[2] === `${IMAGE}:latest`)

describe('Docker release index assembly and accepted-digest promotion', () => {
  test('validates the complete native platform and attestation union independent of descriptor and object-key order', () => {
    const descriptors = candidateDescriptors().reverse().map(({ mediaType, digest, size, platform, annotations }) => ({ platform, size, digest, ...(annotations ? { annotations } : {}), mediaType }))
    expect(() => validateCandidateIndex(index(descriptors), sourceIndexes())).not.toThrow()
  })

  test('assembles the commit candidate from both exact native digests and verifies the resulting immutable index', async () => {
    const docker = dockerStub()
    expect(await releaseIndex('candidate', IMAGE, COMMIT, DIGESTS, docker.command)).toBe(CANDIDATE)
    expect(docker.calls).toEqual([
      ['inspect', '--raw', `${IMAGE}@${DIGESTS.amd64}`],
      ['inspect', '--raw', `${IMAGE}@${DIGESTS.arm64}`],
      ['create', '--tag', `${IMAGE}:${COMMIT}`, `${IMAGE}@${DIGESTS.amd64}`, `${IMAGE}@${DIGESTS.arm64}`],
      ['inspect', '--format', '{{.Manifest.Digest}}', `${IMAGE}:${COMMIT}`],
      ['inspect', '--raw', `${IMAGE}@${CANDIDATE}`],
    ])
    expect(docker.tags.get(`${IMAGE}:latest`)).toBe(PREVIOUS_LATEST)
  })

  test('promotes by copying only the accepted index digest and confirms the final latest digest', async () => {
    const docker = dockerStub()
    expect(await releaseIndex('promote', IMAGE, CANDIDATE, DIGESTS, docker.command)).toBe(CANDIDATE)
    expect(docker.calls).toEqual([
      ['inspect', '--raw', `${IMAGE}@${DIGESTS.amd64}`],
      ['inspect', '--raw', `${IMAGE}@${DIGESTS.arm64}`],
      ['inspect', '--raw', `${IMAGE}@${CANDIDATE}`],
      ['create', '--tag', `${IMAGE}:latest`, `${IMAGE}@${CANDIDATE}`],
      ['inspect', '--format', '{{.Manifest.Digest}}', `${IMAGE}:latest`],
    ])
    expect(docker.tags.get(`${IMAGE}:latest`)).toBe(CANDIDATE)
  })

  test('missing and duplicate native digest inputs fail before any Docker operation', async () => {
    for (const digests of [{ amd64: DIGESTS.amd64 } as NativeDigests, { amd64: DIGESTS.amd64, arm64: DIGESTS.amd64 }]) {
      const docker = dockerStub()
      await expect(releaseIndex('promote', IMAGE, CANDIDATE, digests, docker.command)).rejects.toThrow()
      expect(docker.calls).toEqual([])
      expect(docker.tags.get(`${IMAGE}:latest`)).toBe(PREVIOUS_LATEST)
    }
  })

  test('missing, duplicate, and wrong-platform native descriptors block publication', async () => {
    const wrongOs = nativeDescriptors('amd64')
    wrongOs[0]!.platform.os = 'windows'
    for (const descriptors of [
      nativeDescriptors('amd64').slice(1),
      [...nativeDescriptors('amd64'), { ...nativeDescriptors('amd64')[0]!, digest: sha(99) }],
      nativeDescriptors('arm64'),
      wrongOs,
      nativeDescriptors('amd64').slice(0, 1),
    ]) {
      const docker = dockerStub({ raw: { [`${IMAGE}@${DIGESTS.amd64}`]: index(descriptors) } })
      await expect(releaseIndex('promote', IMAGE, CANDIDATE, DIGESTS, docker.command)).rejects.toThrow()
      expect(latestMutations(docker.calls)).toEqual([])
      expect(docker.calls.some(args => args[0] === 'create')).toBe(false)
      expect(docker.tags.get(`${IMAGE}:latest`)).toBe(PREVIOUS_LATEST)
    }
  })

  test('lost, altered, extra, and duplicated attestations fail candidate validation before latest can change', async () => {
    const lost = candidateDescriptors().filter(descriptor => descriptor.digest !== sha(12))
    const altered = candidateDescriptors()
    altered[1]!.annotations!['com.autoshow.evidence'] = 'replacement-evidence'
    const relinked = candidateDescriptors()
    relinked[1]!.annotations!['vnd.docker.reference.digest'] = sha(21)
    const extra = [...candidateDescriptors(), { ...nativeDescriptors('amd64')[1]!, digest: sha(90) }]
    const duplicate = [...candidateDescriptors(), nativeDescriptors('amd64')[1]!]
    for (const descriptors of [lost, altered, relinked, extra, duplicate]) {
      const raw = index(descriptors)
      expect(() => validateCandidateIndex(raw, sourceIndexes())).toThrow()
      const docker = dockerStub({ raw: { [`${IMAGE}@${CANDIDATE}`]: raw } })
      await expect(releaseIndex('promote', IMAGE, CANDIDATE, DIGESTS, docker.command)).rejects.toThrow()
      expect(latestMutations(docker.calls)).toEqual([])
      expect(docker.tags.get(`${IMAGE}:latest`)).toBe(PREVIOUS_LATEST)
    }
  })

  test('candidate verification catches a dropped native platform after create and never touches latest', async () => {
    const docker = dockerStub({ raw: { [`${IMAGE}@${CANDIDATE}`]: index(nativeDescriptors('amd64')) } })
    await expect(releaseIndex('candidate', IMAGE, COMMIT, DIGESTS, docker.command)).rejects.toThrow('Candidate must contain exactly both native platform maps')
    expect(docker.calls.filter(args => args[0] === 'create')).toHaveLength(1)
    expect(latestMutations(docker.calls)).toEqual([])
    expect(docker.tags.get(`${IMAGE}:latest`)).toBe(PREVIOUS_LATEST)
  })

  test('malformed indexes, digests, and descriptor sizes fail before promotion', async () => {
    const badDigest = candidateDescriptors()
    badDigest[0]!.digest = 'sha256:invalid'
    const badSize = candidateDescriptors()
    badSize[0]!.size = 0
    for (const raw of ['{invalid', '{}', index([]), index(badDigest), index(badSize), JSON.stringify({ schemaVersion: 1, mediaType: INDEX_TYPE, manifests: candidateDescriptors() })]) {
      const docker = dockerStub({ raw: { [`${IMAGE}@${CANDIDATE}`]: raw } })
      await expect(releaseIndex('promote', IMAGE, CANDIDATE, DIGESTS, docker.command)).rejects.toThrow()
      expect(latestMutations(docker.calls)).toEqual([])
      expect(docker.tags.get(`${IMAGE}:latest`)).toBe(PREVIOUS_LATEST)
    }
  })

  test('invalid native and accepted digests and commit identities are rejected before dispatch', async () => {
    for (const invalid of ['', 'latest', 'sha256:abc', `sha256:${'g'.repeat(64)}`, `sha256:${'A'.repeat(64)}`, `${CANDIDATE}\n`]) {
      for (const [mode, identity, digests] of [
        ['candidate', COMMIT, { ...DIGESTS, amd64: invalid }],
        ['promote', invalid, DIGESTS],
        ['candidate', invalid, DIGESTS],
      ] as const) {
        const docker = dockerStub()
        await expect(releaseIndex(mode, IMAGE, identity, digests, docker.command)).rejects.toThrow()
        expect(docker.calls).toEqual([])
      }
    }
    for (const image of ['ghcr.io/Owner/image', `${IMAGE}:latest`, `${IMAGE}@${CANDIDATE}`, 'docker.io/owner/image']) {
      const docker = dockerStub()
      await expect(releaseIndex('promote', image, CANDIDATE, DIGESTS, docker.command)).rejects.toThrow()
      expect(docker.calls).toEqual([])
    }
  })

  test('a malformed resolved candidate digest fails without inspecting or mutating latest', async () => {
    const docker = dockerStub({ formatted: { [`${IMAGE}:${COMMIT}`]: 'sha256:invalid' } })
    await expect(releaseIndex('candidate', IMAGE, COMMIT, DIGESTS, docker.command)).rejects.toThrow('Missing or invalid image digest')
    expect(latestMutations(docker.calls)).toEqual([])
    expect(docker.tags.get(`${IMAGE}:latest`)).toBe(PREVIOUS_LATEST)
  })

  test('Docker inspect and candidate-create failures propagate without changing latest', async () => {
    const failures: Array<(args: string[]) => boolean> = [
      args => args[0] === 'inspect' && args[2] === `${IMAGE}@${DIGESTS.amd64}`,
      args => args[0] === 'inspect' && args[2] === `${IMAGE}@${DIGESTS.arm64}`,
      args => args[0] === 'create',
      args => args[0] === 'inspect' && args[1] === '--format',
      args => args[0] === 'inspect' && args[2] === `${IMAGE}@${CANDIDATE}`,
    ]
    for (const fail of failures) {
      const docker = dockerStub({ fail })
      await expect(releaseIndex('candidate', IMAGE, COMMIT, DIGESTS, docker.command)).rejects.toThrow('Injected Docker failure')
      expect(latestMutations(docker.calls)).toEqual([])
      expect(docker.tags.get(`${IMAGE}:latest`)).toBe(PREVIOUS_LATEST)
    }
    const docker = dockerStub({ fail: args => args[0] === 'inspect' && args[2] === `${IMAGE}@${CANDIDATE}` })
    await expect(releaseIndex('promote', IMAGE, CANDIDATE, DIGESTS, docker.command)).rejects.toThrow('Injected Docker failure')
    expect(latestMutations(docker.calls)).toEqual([])
  })

  test('a Docker create failure propagates without a successful promotion result', async () => {
    const docker = dockerStub({ fail: args => args[0] === 'create' && args[2] === `${IMAGE}:latest` })
    await expect(releaseIndex('promote', IMAGE, CANDIDATE, DIGESTS, docker.command)).rejects.toThrow('Injected Docker failure')
    expect(latestMutations(docker.calls)).toHaveLength(1)
    expect(docker.tags.get(`${IMAGE}:latest`)).toBe(PREVIOUS_LATEST)
  })

  test('failed or mismatched final verification reports promotion failure after the attempted mutation', async () => {
    const mismatched = dockerStub({ formatted: { [`${IMAGE}:latest`]: sha(100) } })
    await expect(releaseIndex('promote', IMAGE, CANDIDATE, DIGESTS, mismatched.command)).rejects.toThrow('differs from accepted candidate')
    expect(latestMutations(mismatched.calls)).toEqual([['create', '--tag', `${IMAGE}:latest`, `${IMAGE}@${CANDIDATE}`]])
    const inspectFailure = dockerStub({ fail: args => args[0] === 'inspect' && args[1] === '--format' })
    await expect(releaseIndex('promote', IMAGE, CANDIDATE, DIGESTS, inspectFailure.command)).rejects.toThrow('Injected Docker failure')
    expect(latestMutations(inspectFailure.calls)).toHaveLength(1)
  })
})
