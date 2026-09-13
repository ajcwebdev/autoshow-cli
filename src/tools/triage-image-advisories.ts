import { UsageError } from '~/utils/error-handler'
import { mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

type GrypeMatch = {
  vulnerability: { id: string; severity: string; dataSource: string; fix?: { versions?: string[] } }
  artifact: { name: string; version: string; purl?: string }
  matchDetails: Array<{ searchedBy?: { package?: { name?: string } } }>
}
type ImageIdentity = { Id: string; RepoDigests?: string[]; Architecture: string }
type AdvisoryGroup = {
  advisory: string; sourcePackage: string; severity: string; sourceUrl: string
  fix: GrypeMatch['vulnerability']['fix'] | null; disposition: string; owner: string
  reachability: string; action: string; binaries: Array<{ name: string; version: string; purl: string | null }>; matches: number
}
const media = new Set(['ffmpeg', 'imagemagick', 'pillow', 'mupdf', 'calibre', 'libraw', 'libpodofo', 'libxml2', 'lxml', 'lxml-html-clean', 'libarchive', 'py7zr', 'zlib', 'gzip', 'tiff', 'jpeg-xl', 'libsndfile', 'expat', 'python-msgpack', 'soupsieve'])
const network = new Set(['curl', 'libssh2', 'mbedtls', 'libevent', 'gnupg2'])

export const triageImageAdvisories = (scanBytes: Uint8Array, identity: ImageIdentity) => {
  const scan = JSON.parse(new TextDecoder().decode(scanBytes)) as { matches: GrypeMatch[] }
  const groups = new Map<string, AdvisoryGroup>()
  for (const { vulnerability, artifact, matchDetails } of scan.matches) {
    if (!['High', 'Critical'].includes(vulnerability.severity)) continue
    const source = matchDetails.find(detail => detail.searchedBy?.package?.name)?.searchedBy?.package?.name ?? artifact.name
    const key = JSON.stringify([vulnerability.id, source])
    let group = groups.get(key)
    if (!group) {
      const reachability = media.has(source)
        ? 'Potentially reachable through user-supplied media, ebook, document, or archive decoding; a specific exploit path is not established.'
        : network.has(source)
          ? 'Shipped transport or trust dependency used by setup/download tools or a native dependency; protocol-specific reachability is unresolved.'
          : 'Shipped runtime or transitive system dependency; package presence alone does not prove the affected feature is invoked.'
      const action = media.has(source)
        ? 'Retain for supported formats; track the source advisory and rebuild against a patched signed Debian snapshot when available. Isolate untrusted conversion with restricted mounts and network access.'
        : network.has(source)
          ? 'Retain required transport/trust functions; identify affected protocol options before accepting risk and apply the next patched snapshot.'
          : 'Resolve the native parent dependency and affected feature before removal; track the advisory for a patched snapshot. No reachability exemption is granted.'
      group = { advisory: vulnerability.id, sourcePackage: source, severity: vulnerability.severity, sourceUrl: vulnerability.dataSource, fix: vulnerability.fix ?? null, disposition: vulnerability.fix?.versions?.length ? 'remediate-before-release' : 'open-no-fix', owner: 'release/dependency maintainer', reachability, action, binaries: [], matches: 0 }
      groups.set(key, group)
    }
    const entry = { name: artifact.name, version: artifact.version, purl: artifact.purl ?? null }
    if (!group.binaries.some(binary => binary.name === entry.name && binary.version === entry.version && binary.purl === entry.purl)) group.binaries.push(entry)
    group.matches++
  }
  const ordered = [...groups.values()].sort((a, b) => a.advisory < b.advisory ? -1 : a.advisory > b.advisory ? 1 : a.sourcePackage < b.sourcePackage ? -1 : a.sourcePackage > b.sourcePackage ? 1 : 0)
  return { schemaVersion: 1, imageConfigDigest: identity.Id, repoDigests: identity.RepoDigests ?? [], architecture: identity.Architecture, scanSha256: new Bun.CryptoHasher('sha256').update(scanBytes).digest('hex'), assessment: 'Conservative source-package triage, not a clean scan, exploit proof, accepted-risk waiver, or refreshed advisory scan.', releaseDisposition: 'pending native candidate acceptance and maintainer review of open findings', matchCount: ordered.reduce((sum, group) => sum + group.matches, 0), advisorySourceGroupCount: ordered.length, groups: ordered }
}

if (import.meta.main) {
  const { positionals, values } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true, options: { 'scan-name': { type: 'string', default: 'advisories.json' }, help: { type: 'boolean', short: 'h' } } })
  if (values.help) {
    console.log('Usage: bun src/tools/triage-image-advisories.ts <evidence-directory> [output-under-docs/reports] [--scan-name advisories.json]\nGroups a retained Grype scan. Defaults to JSON on stdout.')
  } else {
    const [evidence, output] = positionals
    if (!evidence || positionals.length > 2) throw UsageError('Expected an evidence directory and optional output path; use --help.')
    if (output) {
      const path = relative(resolve('docs/reports'), resolve(output))
      if (!path || path === '..' || path.startsWith('../') || isAbsolute(path)) throw UsageError('Report artifacts must be stored under docs/reports/')
    }
    const identities = await Bun.file(resolve(evidence, 'image-identity.json')).json() as ImageIdentity[]
    if (!identities[0]?.Id || !identities[0].Architecture) throw UsageError('Expected docker image inspect evidence with an image ID and architecture.')
    const result = triageImageAdvisories(await Bun.file(resolve(evidence, values['scan-name'])).bytes(), identities[0])
    if (output) {
      await mkdir(dirname(resolve(output)), { recursive: true })
      await Bun.write(output, `${JSON.stringify(result, null, 2)}\n`)
      console.log(JSON.stringify({ architecture: result.architecture, matchCount: result.matchCount, advisorySourceGroupCount: result.advisorySourceGroupCount }))
    } else console.log(JSON.stringify(result, null, 2))
  }
}
