import { join } from 'node:path'
import { ValidationError } from '../utils/error-handler'
import { validateManagedLinuxToolchain } from '../cli/commands/setup-and-utilities/setup/setup-download/managed-linux-tools'

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined

const normalizeDebianName = (name: string): string => name.replace(/:[a-z0-9][a-z0-9-]*$/, '')
const packageIdentity = (name: string, version: string): string => `${normalizeDebianName(name)}@${version}`

const readExpectedPackages = (input: unknown): Map<string, { name: string; version: string }> => {
  const receipt = asRecord(input)
  if (receipt?.['schemaVersion'] !== 2 || receipt['distribution'] !== 'debian-packages' || !Array.isArray(receipt['packages']) || receipt['packages'].length === 0 || receipt['packages'].length > 10_000) throw ValidationError('Managed SBOM coverage requires a complete verified Linux toolchain receipt')
  const packages = new Map<string, { name: string; version: string }>()
  for (const value of receipt['packages']) {
    const entry = asRecord(value)
    const name = entry?.['name']
    const version = entry?.['version']
    if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9+.-]*(?::[a-z0-9][a-z0-9-]*)?$/.test(name) || typeof version !== 'string' || !/^[0-9A-Za-z.+:~_-]+$/.test(version)) throw ValidationError('Managed Linux receipt contains an invalid package identity')
    const id = packageIdentity(name, version)
    if (packages.has(id)) throw ValidationError(`Managed Linux receipt repeats a package identity: ${id}`)
    packages.set(id, { name, version })
  }
  return packages
}

const debianSpdxIdentity = (value: unknown): string | undefined => {
  const entry = asRecord(value)
  const name = entry?.['name']
  const version = entry?.['versionInfo']
  const references = entry?.['externalRefs']
  if (typeof name !== 'string' || typeof version !== 'string' || !Array.isArray(references)) return undefined
  const matchingPurl = references.some(value => {
    const reference = asRecord(value)
    if (reference?.['referenceType'] !== 'purl' || typeof reference['referenceLocator'] !== 'string') return false
    const match = reference['referenceLocator'].match(/^pkg:deb\/(?:debian|ubuntu)\/([^@/?#]+)@([^?#]+)(?:[?#]|$)/)
    if (!match) return false
    try {
      return normalizeDebianName(decodeURIComponent(match[1]!)) === normalizeDebianName(name) && decodeURIComponent(match[2]!) === version
    } catch { return false }
  })
  return matchingPurl ? packageIdentity(name, version) : undefined
}

const verifyManagedLanguageOwnership = (expected: ReadonlyMap<string, unknown>, packages: unknown[], relationships: unknown): void => {
  const records = packages.map(asRecord).filter((value): value is Record<string, unknown> => value !== undefined)
  const nativeIds = new Set(records.filter(value => {
    const identity = debianSpdxIdentity(value)
    return identity !== undefined && expected.has(identity)
  }).map(value => value['SPDXID']).filter((value): value is string => typeof value === 'string'))
  const managedLanguages = records.filter(value => {
    if (typeof value['sourceInfo'] !== 'string' || !value['sourceInfo'].includes('/tools/linux-root/')) return false
    const references = value['externalRefs']
    return Array.isArray(references) && references.some(reference => {
      const entry = asRecord(reference)
      return entry?.['referenceType'] === 'purl' && typeof entry['referenceLocator'] === 'string' && /^pkg:(?:pypi|npm|gem|golang|cargo|nuget|maven)\//.test(entry['referenceLocator'])
    })
  })
  const ownedIds = new Set((Array.isArray(relationships) ? relationships : []).flatMap(value => {
    const relation = asRecord(value)
    return typeof relation?.['spdxElementId'] === 'string' && nativeIds.has(relation['spdxElementId']) &&
      typeof relation['relatedSpdxElement'] === 'string' && relation['relationshipType'] === 'OTHER' &&
      typeof relation['comment'] === 'string' && relation['comment'].startsWith('ownership-by-file-overlap:')
      ? [relation['relatedSpdxElement']] : []
  }))
  const unowned = managedLanguages.filter(value => typeof value['SPDXID'] !== 'string' || !ownedIds.has(value['SPDXID']))
  if (unowned.length > 0) throw ValidationError(`Managed language packages lack verified native Debian ownership in the SBOM (${unowned.length}): ${unowned.slice(0, 20).map(value => `${value['name']}@${value['versionInfo']}`).join(', ')}${unowned.length > 20 ? ', ...' : ''}`)
}

/** A relocated native payload must remain visible to the same SBOM that Grype audits. */
export const verifyManagedSbomCoverage = (receipt: unknown, input: unknown): { status: 'passed'; expectedPackages: number; matchedPackages: number } => {
  const expected = readExpectedPackages(receipt)
  const sbom = asRecord(input)
  if (typeof sbom?.['spdxVersion'] !== 'string' || !sbom['spdxVersion'].startsWith('SPDX-') || !Array.isArray(sbom['packages'])) throw ValidationError('Managed SBOM coverage requires SPDX JSON packages')
  const cataloged = new Set(sbom['packages'].map(debianSpdxIdentity).filter((value): value is string => value !== undefined))
  const missing = [...expected.keys()].filter(id => !cataloged.has(id))
  if (missing.length > 0) throw ValidationError(`Managed native packages are absent or have different versions in the SBOM (${missing.length}): ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ', ...' : ''}`)
  verifyManagedLanguageOwnership(expected, sbom['packages'], sbom['relationships'])
  return { status: 'passed', expectedPackages: expected.size, matchedPackages: expected.size }
}

if (import.meta.main) {
  const [mode, first, second, ...extra] = Bun.argv.slice(2)
  if (mode === 'receipt' && first && !second && extra.length === 0) {
    await validateManagedLinuxToolchain(first)
    const bytes = await Bun.file(join(first, 'tools/linux-root/.autoshow-linux-toolchain.json')).text()
    readExpectedPackages(JSON.parse(bytes) as unknown)
    // Preserve the image evidence bytes so an earlier checksum manifest remains valid.
    process.stdout.write(bytes)
  } else if (mode === 'verify' && first && second && extra.length === 0) {
    const receipt = await Bun.file(first).json() as unknown
    const sbom = await Bun.file(second).json() as unknown
    process.stdout.write(`${JSON.stringify(verifyManagedSbomCoverage(receipt, sbom))}\n`)
  } else throw ValidationError('Expected docker-verify-managed-sbom.ts receipt RUNTIME_ROOT or verify RECEIPT_JSON SPDX_JSON')
}
