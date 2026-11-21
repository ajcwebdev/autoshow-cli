import { expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { verifyManagedSbomCoverage } from '~/tools/docker-verify-managed-sbom'
import { createRuntimeTempDirectory } from '~/utils/runtime-state'

const receipt = {
  schemaVersion: 2,
  distribution: 'debian-packages',
  packages: [{ name: 'ffmpeg', version: '7:8.0-1' }, { name: 'calibre', version: '8.5.0+ds-1' }, { name: 'tesseract-ocr', version: '5.5.0-1' }]
}
const spdxPackage = (name: string, versionInfo: string, ecosystem = 'deb/debian') => ({
  name, versionInfo,
  externalRefs: [{ referenceType: 'purl', referenceLocator: `pkg:${ecosystem}/${name}@${encodeURIComponent(versionInfo)}?arch=arm64&distro=debian-13` }]
})
const sbom = () => ({ spdxVersion: 'SPDX-2.3', packages: receipt.packages.map(({ name, version }) => spdxPackage(name, version)) })

test('relocated native app packages retain exact Debian name, epoch/version and ecosystem coverage', () => {
  const input = sbom()
  input.packages.push(spdxPackage('libc6', '2.41-12'))
  expect(verifyManagedSbomCoverage(receipt, input)).toEqual({ status: 'passed', expectedPackages: 3, matchedPackages: 3 })
})

test('missing native catalog entries and mismatched versions fail even when the final OS graph exists', () => {
  const missing = sbom()
  missing.packages = [spdxPackage('libc6', '2.41-12')]
  expect(() => verifyManagedSbomCoverage(receipt, missing)).toThrow('ffmpeg@7:8.0-1')
  const wrongVersion = sbom()
  wrongVersion.packages[0] = spdxPackage('ffmpeg', '7:7.0-1')
  expect(() => verifyManagedSbomCoverage(receipt, wrongVersion)).toThrow('different versions')
})

test('a language package with the same name and version cannot substitute for the native Debian entry', () => {
  const input = sbom()
  input.packages[0] = spdxPackage('ffmpeg', '7:8.0-1', 'npm')
  expect(() => verifyManagedSbomCoverage(receipt, input)).toThrow('ffmpeg@7:8.0-1')
  input.packages[0] = { name: 'ffmpeg', versionInfo: '7:8.0-1', externalRefs: [] }
  expect(() => verifyManagedSbomCoverage(receipt, input)).toThrow('ffmpeg@7:8.0-1')
})

test('native PURL identity must agree with the SPDX package fields', () => {
  const input = sbom()
  input.packages[0]!.externalRefs[0]!.referenceLocator = 'pkg:deb/debian/ffmpeg@7%3A7.0-1'
  expect(() => verifyManagedSbomCoverage(receipt, input)).toThrow('ffmpeg@7:8.0-1')
})

test('both managed seed and active language copies retain genuine native ownership relationships', () => {
  const input = {
    ...sbom(),
    packages: [
      ...receipt.packages.map(({ name, version }) => ({ ...spdxPackage(name, version), SPDXID: `native-${name}` })),
      ...['/opt/autoshow-runtime', '/app/runtime/tools/docker-image/revision'].map((prefix, index) => ({
        ...spdxPackage('pillow', '11.1.0', 'pypi'), SPDXID: `python-${index}`,
        sourceInfo: `acquired package info from installed python package manifest file: ${prefix}/tools/linux-root/usr/lib/python3/dist-packages/pillow.egg-info/PKG-INFO`
      }))
    ],
    relationships: [0, 1].map(index => ({
      spdxElementId: 'native-calibre', relatedSpdxElement: `python-${index}`, relationshipType: 'OTHER',
      comment: 'ownership-by-file-overlap: parent metadata claims the child package evidence file'
    }))
  }
  expect(verifyManagedSbomCoverage(receipt, input).status).toBe('passed')
  const missingSeedOwnership = { ...input, relationships: input.relationships.slice(1) }
  expect(() => verifyManagedSbomCoverage(receipt, missingSeedOwnership)).toThrow('pillow@11.1.0')
  expect(() => verifyManagedSbomCoverage(receipt, { ...input, relationships: undefined })).toThrow('native Debian ownership')
  expect(() => verifyManagedSbomCoverage(receipt, { ...input, relationships: input.relationships.map(value => ({ ...value, spdxElementId: 'unverified-native' })) })).toThrow('native Debian ownership')
  expect(() => verifyManagedSbomCoverage(receipt, { ...input, relationships: input.relationships.map(value => ({ ...value, relationshipType: 'CONTAINS' })) })).toThrow('native Debian ownership')
})

test('coverage refuses absent, empty, duplicated or malformed receipt and SBOM inventories', () => {
  for (const value of [undefined, {}, { ...receipt, packages: [] }, { ...receipt, packages: [...receipt.packages, receipt.packages[0]] }, { ...receipt, packages: [{ name: '../ffmpeg', version: '1' }] }]) {
    expect(() => verifyManagedSbomCoverage(value, sbom())).toThrow()
  }
  for (const value of [undefined, {}, { packages: [] }, { spdxVersion: 'SPDX-2.3', packages: {} }]) expect(() => verifyManagedSbomCoverage(receipt, value)).toThrow()
})

test('receipt export rejects unverified payloads without emitting a package graph', async () => {
  const root = await createRuntimeTempDirectory('managed-sbom-export-')
  try {
    const directory = join(root, 'tools/linux-root')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, '.autoshow-linux-toolchain.json'), JSON.stringify({
      ...receipt, recipeRevision: 'linux-runtime-v3', architecture: process.arch, requestedPackages: ['ffmpeg'],
      payload: [{ path: 'usr/bin/ffmpeg', mode: 0o755, kind: 'file', sha256: '0'.repeat(64) }]
    }))
    const child = Bun.spawnSync([process.execPath, '--no-env-file', 'src/tools/docker-verify-managed-sbom.ts', 'receipt', root], {
      stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'], HOME: process.env['HOME'], BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' }
    })
    expect(child.exitCode).not.toBe(0)
    expect(child.stdout.toString()).toBe('')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('the scanner checks managed coverage before its single unchanged vulnerability scan', async () => {
  const action = await Bun.file('.github/actions/scan-image/action.yml').text()
  const inventory = action.indexOf('syft "${IMAGE}" -o "spdx-json=${SBOM}"')
  const coverage = action.indexOf('docker-verify-managed-sbom.ts verify')
  const audit = action.indexOf('grype "sbom:${SBOM}" -o json')
  expect(inventory).toBeGreaterThan(0)
  expect(coverage).toBeGreaterThan(inventory)
  expect(audit).toBeGreaterThan(coverage)
  expect(action.match(/syft "\$\{IMAGE\}" -o/g)).toHaveLength(1)
  expect(action.match(/grype "sbom:\$\{SBOM\}" -o/g)).toHaveLength(1)
  expect(action).toContain('--no-env-file --no-install /app/src/tools/docker-verify-managed-sbom.ts verify')
  expect(action).toContain('dst=/evidence/image.spdx.json,readonly')
  expect(action).not.toContain('bun --no-env-file src/tools/docker-verify-managed-sbom.ts verify')
  expect(action).toContain('FAIL_ON_FIXABLE: ${{ inputs.fail-on-fixable }}')
})
