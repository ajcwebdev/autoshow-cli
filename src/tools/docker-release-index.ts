/** Assemble a candidate, or copy its accepted index to latest without rebuilding. */
import { appendFile } from 'node:fs/promises'

type Architecture = 'amd64' | 'arm64'
type Descriptor = {
  digest: string; size: number; mediaType: string
  platform: { os: string; architecture: string; variant?: string }
  annotations?: Record<string, string>
}
export type NativeDigests = Record<Architecture, string>
export type DockerIndexCommand = (args: string[]) => Promise<string>
const architectures = ['amd64', 'arm64'] as const
const digestPattern = /^sha256:[a-f0-9]{64}$/
const isDigest = (value: unknown): value is string => typeof value === 'string' && value.length === 71 && digestPattern.test(value)
const assertDigest = (value: string) => {
  if (!isDigest(value)) throw new Error(`Missing or invalid image digest: ${value}`)
  return value
}
const parseIndex = (raw: string): Descriptor[] => {
  const index = JSON.parse(raw) as { schemaVersion?: number; mediaType?: string; manifests?: Descriptor[] }
  if (index.schemaVersion !== 2 || !['application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'].includes(index.mediaType ?? '') || !Array.isArray(index.manifests) || !index.manifests.length) throw new Error('Expected a nonempty OCI index or Docker manifest list')
  const seen = new Set<string>()
  for (const item of index.manifests) {
    if (!item || !isDigest(item.digest) || !Number.isSafeInteger(item.size) || item.size <= 0 || !item.mediaType || !item.platform?.os || !item.platform.architecture || seen.has(item.digest)) throw new Error('Invalid or duplicate platform descriptor')
    seen.add(item.digest)
  }
  return index.manifests
}

export const validateNativeIndex = (raw: string, arch: Architecture): Descriptor[] => {
  const items = parseIndex(raw)
  const runtime = items.filter(item => item.platform.os === 'linux' && item.platform.architecture === arch)
  if (runtime.length !== 1) throw new Error(`Expected exactly one linux/${arch} runtime descriptor`)
  const attestations = items.filter(item => item.platform.os === 'unknown' && item.platform.architecture === 'unknown' && item.annotations?.['vnd.docker.reference.type'] === 'attestation-manifest' && item.annotations?.['vnd.docker.reference.digest'] === runtime[0]!.digest)
  if (!attestations.length || runtime.length + attestations.length !== items.length) throw new Error(`Missing attestations or wrong platform in ${arch} index`)
  return items
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  return JSON.stringify(value)
}
export const validateCandidateIndex = (raw: string, sources: Record<Architecture, string>): void => {
  const expected = architectures.flatMap(arch => validateNativeIndex(sources[arch], arch)).map(canonical).sort()
  const actual = parseIndex(raw).map(canonical).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Candidate must contain exactly both native platform maps and their original attestations')
}

const defaultDocker: DockerIndexCommand = async args => {
  const child = Bun.spawn(['docker', 'buildx', 'imagetools', ...args], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(300_000) })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  if (code !== 0) throw new Error(`Docker imagetools ${args[0]} failed: ${stderr.slice(-4000)}`)
  return stdout
}

export const releaseIndex = async (mode: 'candidate' | 'promote', image: string, identity: string, digests: NativeDigests, docker: DockerIndexCommand = defaultDocker): Promise<string> => {
  if (mode !== 'candidate' && mode !== 'promote') throw new Error('Expected candidate or promote mode')
  if (image !== image.trim() || !/^ghcr\.io\/[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)+$/.test(image)) throw new Error('Expected a lowercase GHCR repository without a tag')
  if (mode === 'candidate' ? identity.length !== 40 || !/^[a-f0-9]{40}$/.test(identity) : !isDigest(identity)) throw new Error('Expected a full commit SHA or accepted index digest')
  for (const arch of architectures) assertDigest(digests[arch])
  if (digests.amd64 === digests.arm64) throw new Error('Native build digests must be distinct')
  const sources = {} as Record<Architecture, string>
  for (const arch of architectures) {
    sources[arch] = await docker(['inspect', '--raw', `${image}@${digests[arch]}`])
    validateNativeIndex(sources[arch], arch)
  }
  if (mode === 'candidate') {
    const tag = `${image}:${identity}`
    await docker(['create', '--tag', tag, ...architectures.map(arch => `${image}@${digests[arch]}`)])
    const digest = assertDigest((await docker(['inspect', '--format', '{{.Manifest.Digest}}', tag])).trim())
    validateCandidateIndex(await docker(['inspect', '--raw', `${image}@${digest}`]), sources)
    return digest
  }
  validateCandidateIndex(await docker(['inspect', '--raw', `${image}@${identity}`]), sources)
  // A single existing index source is copied verbatim, preserving descriptors and attestations.
  await docker(['create', '--tag', `${image}:latest`, `${image}@${identity}`])
  const promoted = assertDigest((await docker(['inspect', '--format', '{{.Manifest.Digest}}', `${image}:latest`])).trim())
  if (promoted !== identity) throw new Error(`Latest digest ${promoted} differs from accepted candidate ${identity}`)
  return promoted
}

if (import.meta.main) {
  const [mode, image, identity, amd64, arm64, ...extra] = process.argv.slice(2)
  if (!['candidate', 'promote'].includes(mode ?? '') || !image || !identity || !amd64 || !arm64 || extra.length) throw new Error('Usage: bun src/tools/docker-release-index.ts candidate|promote <ghcr-repository> <commit-sha|accepted-digest> <amd64-digest> <arm64-digest>')
  const digest = await releaseIndex(mode as 'candidate' | 'promote', image, identity, { amd64, arm64 })
  if (process.env['GITHUB_OUTPUT']) await appendFile(process.env['GITHUB_OUTPUT'], `digest=${digest}\n`)
  console.log(JSON.stringify({ mode, image, digest }))
}
