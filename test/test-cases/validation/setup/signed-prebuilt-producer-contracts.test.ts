import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME,
  parseManagedPrebuiltPayloadManifest,
  parseManagedPrebuiltReleaseManifest,
  sha256File
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import {
  managedToolchainDistributionLicense,
  managedToolchainDistributionNoticePlan
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import {
  assertManagedProtectedReleaseInputs,
  createManagedSignedSpdx,
  managedSignedArchiveName,
  managedSignedReleaseManifestName,
  managedSignedSbomName,
  managedToolchainReleaseTag,
  packageManagedSignedCandidate
} from '~/cli/commands/setup-and-utilities/setup/setup-download/signed-prebuilt-artifact'
import type { ManagedArtifactToolId, ManagedPrebuiltProducer } from '~/types'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { managedSignedReleaseAssetNames } from '~/tools/macos-toolchain-producer'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: [],
  tempPrefix: 'autoshow-signed-prebuilt-test-'
})

const COMMIT = '0123456789abcdef0123456789abcdef01234567'
const SIGNING_IDENTITY = 'Developer ID Application: AutoShow Fixture (AB12CD34EF)'
const TEAM_ID = 'AB12CD34EF'

const producer: ManagedPrebuiltProducer = {
  repository: 'ajcwebdev/autoshow-cli',
  commit: COMMIT,
  workflowName: 'macOS Toolchain Protected Release Rehearsal',
  workflowRunUrl: 'https://github.com/ajcwebdev/autoshow-cli/actions/runs/456',
  runnerLabel: 'macos-15',
  runnerImage: 'macos-15-arm64-fixture',
  compilerVersion: 'Apple clang fixture',
  sdkVersion: '15.0',
  buildToolVersions: ['cmake fixture', 'make fixture', 'bun fixture']
}

const createSourceDirectories = async (root: string): Promise<Record<'mupdf' | 'qpdf' | 'libjpeg-turbo', string>> => {
  const sources = {
    mupdf: join(root, 'mupdf-source'),
    qpdf: join(root, 'qpdf-source'),
    'libjpeg-turbo': join(root, 'libjpeg-turbo-source')
  }
  await Promise.all(Object.values(sources).map(async path => { await mkdir(path, { recursive: true }) }))
  for (const tool of ['mupdf', 'qpdf'] as const) {
    for (const entry of managedToolchainDistributionNoticePlan(tool)) {
      for (const sourcePath of entry.sourcePaths) {
        const path = join(sources[entry.source], sourcePath)
        await mkdir(dirname(path), { recursive: true })
        await Bun.write(path, `${entry.source} ${sourcePath} fixture\n`)
      }
    }
  }
  return sources
}

const packageFixture = async (tool: ManagedArtifactToolId = 'qpdf') => {
  const root = await tempDirs.make()
  const binaryPath = join(root, tool === 'mupdf' ? 'mutool' : 'qpdf')
  await Bun.write(binaryPath, `${tool} signed fixture\n`)
  const outputDir = join(root, 'artifacts')
  const bundle = await packageManagedSignedCandidate({
    tool,
    architecture: 'arm64',
    binaryPath,
    sourceDirectories: await createSourceDirectories(root),
    outputDir,
    producer,
    signingIdentity: SIGNING_IDENTITY,
    teamId: TEAM_ID,
    notarize: async () => ({ submissionId: 'fixture-submission-id', status: 'Accepted', log: { status: 'Accepted' } }),
    verifySignature: async (_path, expected) => { expect(expected).toEqual({ signingIdentity: SIGNING_IDENTITY, teamId: TEAM_ID }) }
  })
  return { root, outputDir, bundle }
}

describe('Phase 6 signed candidate contracts', () => {
  test('uses only the accepted immutable release identities and asset names', () => {
    expect(managedToolchainReleaseTag('mupdf')).toBe('toolchain-mupdf-1.27.2-r1')
    expect(managedToolchainReleaseTag('qpdf')).toBe('toolchain-qpdf-12.3.2-r1')
    expect(managedSignedArchiveName('mupdf', 'arm64')).toBe('autoshow-mupdf-1.27.2-r1-darwin-arm64.zip')
    expect(managedSignedArchiveName('qpdf', 'x64')).toBe('autoshow-qpdf-12.3.2-r1-darwin-x64.zip')
    expect(managedSignedReleaseAssetNames('mupdf')).toHaveLength(15)
    expect(managedSignedReleaseAssetNames('qpdf')).toHaveLength(16)
    expect(managedSignedReleaseAssetNames('mupdf')).toContain('mupdf-1.27.2-source.tar.gz')
    expect(managedSignedReleaseAssetNames('qpdf')).toEqual(expect.arrayContaining(['qpdf-12.3.2.tar.gz', 'libjpeg-turbo-3.2.0.tar.gz', 'DISTRIBUTION-NOTICE.txt', 'SHA256SUMS']))
  })

  test('packages a production-shaped signed payload once and binds Accepted notarization to its final ZIP', async () => {
    const fixture = await packageFixture()
    const releaseJson = await Bun.file(fixture.bundle.releaseManifestPath).text()
    const release = parseManagedPrebuiltReleaseManifest(JSON.parse(releaseJson) as unknown)
    expect(release).toMatchObject({
      identity: 'qpdf-12.3.2-r1-darwin-arm64',
      archive: { name: managedSignedArchiveName('qpdf', 'arm64'), sha256: fixture.bundle.archiveSha256 },
      notarization: { submissionId: 'fixture-submission-id', status: 'Accepted' },
      provenance: { repository: 'ajcwebdev/autoshow-cli', subjectDigest: fixture.bundle.archiveSha256 },
      licenseReviewReferences: ['ADR-004-P5-QPDF-12.3.2-r1', 'ADR-004-P5-LIBJPEG-TURBO-3.2.0-r1']
    })
    expect(release.sbom).toEqual({ name: managedSignedSbomName('qpdf', 'arm64'), sha256: fixture.bundle.sbomSha256 })
    expect(await sha256File(fixture.bundle.archivePath)).toBe(release.archive.sha256)
    const extractionDir = join(fixture.root, 'extracted')
    const unzip = Bun.spawn(['unzip', '-q', fixture.bundle.archivePath, '-d', extractionDir])
    expect(await unzip.exited).toBe(0)
    const packageDir = join(extractionDir, 'qpdf')
    const payload = parseManagedPrebuiltPayloadManifest(JSON.parse(await Bun.file(join(packageDir, MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME)).text()) as unknown)
    expect(payload.trust).toEqual({ signingIdentity: SIGNING_IDENTITY, teamId: TEAM_ID })
    expect(payload.license).toEqual(managedToolchainDistributionLicense('qpdf'))
    const files = await Array.fromAsync(new Bun.Glob('**/*').scan({ cwd: packageDir, onlyFiles: true }))
    if (await Bun.file(join(packageDir, MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME)).exists()) files.push(MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME)
    expect(files.sort()).toEqual([
      '.autoshow-payload-manifest.json',
      'bin/qpdf',
      'licenses/DISTRIBUTION-NOTICE.txt',
      'licenses/libjpeg-turbo-LICENSE.md',
      'licenses/qpdf-LICENSE.txt',
      'licenses/qpdf-NOTICE.md'
    ])
    const sbom = JSON.parse(await Bun.file(fixture.bundle.sbomPath).text()) as Record<string, unknown>
    const created = ((sbom['creationInfo'] as Record<string, unknown>)['created']) as string
    expect(sbom).toEqual(createManagedSignedSpdx(payload, created))
  })

  test('fails closed if notarization mutates the final archive or lacks an Accepted submission ID', async () => {
    const root = await tempDirs.make()
    const binaryPath = join(root, 'mutool')
    await Bun.write(binaryPath, 'signed fixture\n')
    const base = {
      tool: 'mupdf' as const,
      architecture: 'arm64' as const,
      binaryPath,
      sourceDirectories: await createSourceDirectories(root),
      producer,
      signingIdentity: SIGNING_IDENTITY,
      teamId: TEAM_ID,
      verifySignature: async () => undefined
    }
    await expect(packageManagedSignedCandidate({
      ...base,
      outputDir: join(root, 'mutated'),
      notarize: async archivePath => {
        await Bun.write(archivePath, 'mutated after submission\n')
        return { submissionId: 'fixture', status: 'Accepted', log: {} }
      }
    })).rejects.toThrow('notarization changed the final ZIP bytes')
    await expect(packageManagedSignedCandidate({
      ...base,
      outputDir: join(root, 'missing-id'),
      notarize: async () => ({ submissionId: '', status: 'Accepted', log: {} })
    })).rejects.toThrow('notarization did not return an Accepted submission')
  })
})

describe('Phase 6 protected workflow controls', () => {
  test('accepts only the exact dispatched default-branch commit, versions, and r1 revision', async () => {
    const exact = {
      ref: 'refs/heads/main',
      defaultBranch: 'main',
      checkedOutCommit: COMMIT,
      dispatchCommit: COMMIT,
      requestedCommit: COMMIT,
      revision: 'r1',
      mupdfVersion: '1.27.2',
      qpdfVersion: '12.3.2'
    }
    await expect(assertManagedProtectedReleaseInputs(exact)).resolves.toBeUndefined()
    await expect(assertManagedProtectedReleaseInputs({ ...exact, ref: 'refs/heads/staging' })).rejects.toThrow('must run from refs/heads/main')
    await expect(assertManagedProtectedReleaseInputs({ ...exact, dispatchCommit: 'f'.repeat(40) })).rejects.toThrow('exact workflow-dispatch')
    await expect(assertManagedProtectedReleaseInputs({ ...exact, revision: 'r2' })).rejects.toThrow('release revision must be r1')
    await expect(assertManagedProtectedReleaseInputs({ ...exact, qpdfVersion: '12.3.3' })).rejects.toThrow('must match pinned version 12.3.2')
  })

  test('pins a protected manual draft-only workflow with minimal scoped permissions', async () => {
    const workflow = await Bun.file(join(PROJECT_ROOT, '.github/workflows/macos-toolchain-release.yml')).text()
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/pull_request:|pull_request_target:|push:/)
    expect(workflow).toContain('environment: macos-toolchain-release')
    expect(workflow).toContain('runner: macos-15\n            architecture: arm64')
    expect(workflow).toContain('runner: macos-15-intel\n            architecture: x64')
    expect(workflow).toContain('contents: read\n      id-token: write\n      attestations: write')
    expect(workflow).toContain('contents: write\n      attestations: read')
    expect(workflow).toContain('toolchain:produce-signed')
    expect(workflow).toContain('toolchain:verify-signed')
    expect(workflow).toContain('gh attestation verify')
    expect(workflow).toContain('gh release create toolchain-mupdf-1.27.2-r1')
    expect(workflow).toContain('--draft')
    expect(workflow).not.toMatch(/--latest|--prerelease|--draft=false|gh release edit|gh release upload.*--clobber/)
    const actionReferences = [...workflow.matchAll(/uses:\s+[^@\s]+@([^\s]+)/g)].map(match => match[1] ?? '')
    expect(actionReferences.length).toBeGreaterThanOrEqual(12)
    expect(actionReferences.every(reference => /^[a-f0-9]{40}$/.test(reference))).toBe(true)
  })

  test('keeps signing secrets out of the unsigned path and notarizes without force', async () => {
    const unsignedWorkflow = await Bun.file(join(PROJECT_ROOT, '.github/workflows/macos-toolchain-unsigned.yml')).text()
    const signedSource = await Bun.file(join(PROJECT_ROOT, 'src/cli/commands/setup-and-utilities/setup/setup-download/signed-prebuilt-artifact.ts')).text()
    expect(unsignedWorkflow).not.toMatch(/APPLE_|DEVELOPER_ID|NOTARY|secrets\./)
    expect(signedSource).toContain("'--wait', '--output-format', 'json'")
    expect(signedSource).not.toContain("'--force', options.archivePath")
    expect(signedSource).toContain("'--options', 'runtime'")
    expect(signedSource).toContain("'--timestamp'")
  })

  test('does not activate a signed candidate in production metadata', async () => {
    const dependencyMetadata = await Bun.file(join(PROJECT_ROOT, 'src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts')).text()
    expect(dependencyMetadata).not.toContain('prebuiltUrl')
    expect(dependencyMetadata).not.toContain('prebuiltSha256')
    expect(managedSignedReleaseManifestName('qpdf', 'arm64')).toEndWith('.release.json')
  })
})
