import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  managedToolchainDistributionLicense,
  managedToolchainDistributionNoticePlan,
  validateManagedToolchainDistributionLicense
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import {
  exerciseManagedUnsignedSourceFallback,
  findManagedUnsignedArtifactLeaks,
  installManagedUnsignedVerificationArtifact,
  managedUnsignedVerificationArchiveName,
  managedUnsignedVerificationManifestName,
  managedUnsignedVerificationNoticePaths,
  managedUnsignedVerificationSbomName,
  MANAGED_UNSIGNED_PAYLOAD_MANIFEST_NAME,
  packageManagedUnsignedVerificationArtifact,
  parseMacosDeploymentTarget,
  parseManagedUnsignedVerificationManifest,
  parseManagedUnsignedVerificationPayloadManifest
} from '~/cli/commands/setup-and-utilities/setup/setup-download/unsigned-prebuilt-artifact'
import { buildMupdfMakeArguments } from '~/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build'
import type { ManagedArtifactToolId, ManagedPrebuiltProducer, ManagedUnsignedVerificationBundle } from '~/types'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: [],
  tempPrefix: 'autoshow-prebuilt-producer-test-'
})

const COMMIT = '0123456789abcdef0123456789abcdef01234567'
const producer: ManagedPrebuiltProducer = {
  repository: 'ajcwebdev/autoshow-cli',
  commit: COMMIT,
  workflowName: 'macOS Toolchain Unsigned Verification',
  workflowRunUrl: 'https://github.com/ajcwebdev/autoshow-cli/actions/runs/123',
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

const createBundle = async (
  tool: ManagedArtifactToolId = 'qpdf'
): Promise<{ root: string, outputDir: string, bundle: ManagedUnsignedVerificationBundle }> => {
  const root = await tempDirs.make()
  const outputDir = join(root, 'artifacts')
  const binaryPath = join(root, tool === 'mupdf' ? 'mutool' : 'qpdf')
  await Bun.write(binaryPath, `#!/bin/sh\necho '${tool} ${tool === 'mupdf' ? '1.27.2' : '12.3.2'}'\n`)
  const bundle = await packageManagedUnsignedVerificationArtifact({
    tool,
    architecture: 'arm64',
    binaryPath,
    sourceDirectories: await createSourceDirectories(root),
    outputDir,
    producer
  })
  return { root, outputDir, bundle }
}

describe('Phase 5 approved unsigned artifact schemas and packaging', () => {
  test('uses conspicuous non-release names for both tools and architectures', () => {
    expect(managedUnsignedVerificationArchiveName('mupdf', 'arm64')).toBe('autoshow-unsigned-verification-mupdf-1.27.2-r1-darwin-arm64.zip')
    expect(managedUnsignedVerificationArchiveName('qpdf', 'x64')).toBe('autoshow-unsigned-verification-qpdf-12.3.2-r1-darwin-x64.zip')
    expect(managedUnsignedVerificationArchiveName('qpdf', 'x64')).not.toBe('autoshow-qpdf-12.3.2-r1-darwin-x64.zip')
  })

  test('packages exact pins, approved notices, a closed non-promotable manifest, and SPDX 2.3 JSON', async () => {
    const fixture = await createBundle()
    const verification = parseManagedUnsignedVerificationManifest(JSON.parse(await Bun.file(fixture.bundle.manifestPath).text()) as unknown)
    expect(verification).toMatchObject({
      artifactKind: 'unsigned-verification',
      promotable: false,
      tool: 'qpdf',
      version: '12.3.2',
      architecture: 'arm64',
      minimumMacosVersion: '15.0',
      producerCommit: COMMIT
    })
    const sbom = JSON.parse(await Bun.file(fixture.bundle.sbomPath).text()) as Record<string, unknown>
    expect(sbom['spdxVersion']).toBe('SPDX-2.3')
    expect((sbom['packages'] as Array<{ name: string, licenseDeclared: string }>).map(entry => ({ name: entry.name, license: entry.licenseDeclared }))).toEqual([
      { name: 'qpdf', license: 'Apache-2.0' },
      { name: 'libjpeg-turbo', license: 'IJG AND BSD-3-Clause' }
    ])
    expect(managedUnsignedVerificationNoticePaths('qpdf')).toEqual([
      'licenses/qpdf-LICENSE.txt',
      'licenses/qpdf-NOTICE.md',
      'licenses/libjpeg-turbo-LICENSE.md',
      'licenses/DISTRIBUTION-NOTICE.txt'
    ])
  })

  test('rejects unknown fields and any attempt to mark an unsigned artifact promotable', async () => {
    const fixture = await createBundle('mupdf')
    const verification = JSON.parse(await Bun.file(fixture.bundle.manifestPath).text()) as Record<string, unknown>
    expect(() => parseManagedUnsignedVerificationManifest({ ...verification, unexpected: true })).toThrow('invalid unsigned verification manifest')
    expect(() => parseManagedUnsignedVerificationManifest({ ...verification, promotable: true })).toThrow('invalid unsigned verification manifest')
  })

  test('keeps unsigned payloads structurally distinct from release payloads', async () => {
    const fixture = await createBundle('mupdf')
    const extractionDir = join(fixture.root, 'extract')
    const process = Bun.spawn(['unzip', '-q', fixture.bundle.archivePath, '-d', extractionDir])
    expect(await process.exited).toBe(0)
    const payload = JSON.parse(await Bun.file(join(extractionDir, 'mupdf', MANAGED_UNSIGNED_PAYLOAD_MANIFEST_NAME)).text()) as Record<string, unknown>
    expect(parseManagedUnsignedVerificationPayloadManifest(payload).trust).toEqual({ developerIdSigned: false, notarized: false })
    expect(payload['license']).toMatchObject({
      reviewStatus: 'approved',
      reviewReferences: ['ADR-004-P5-MUPDF-1.27.2-r1'],
      repositoryReviewer: 'github:ajcwebdev/repository-owner',
      complianceReviewer: 'github:ajcwebdev/project-compliance-owner',
      writtenOfferRequired: false
    })
    expect(await Bun.file(join(extractionDir, 'mupdf', '.autoshow-payload-manifest.json')).exists()).toBe(false)
  })

  test('rejects missing or changed Phase 5 review identities', async () => {
    const approved = managedToolchainDistributionLicense('qpdf')
    expect(validateManagedToolchainDistributionLicense('qpdf', approved)).toBeUndefined()
    expect(validateManagedToolchainDistributionLicense('qpdf', {
      ...approved,
      reviewReferences: ['ADR-004-P5-QPDF-CHANGED']
    })).toContain('does not match the approved')
    const missing = { ...approved } as unknown as Record<string, unknown>
    delete missing['reviewReferences']
    expect(() => parseManagedUnsignedVerificationPayloadManifest({
      schemaVersion: 1,
      artifactKind: 'unsigned-verification',
      promotable: false,
      tool: 'qpdf',
      version: '12.3.2',
      revision: 'r1',
      platform: 'darwin',
      architecture: 'arm64',
      macosDeploymentTarget: '15.0',
      sources: [],
      buildFlags: [],
      producer,
      payload: [],
      trust: { developerIdSigned: false, notarized: false },
      license: missing
    })).toThrow('invalid unsigned verification payload manifest')
  })
})

describe('Phase 4 staged consumer and source fallback', () => {
  test('clean-installs an unsigned candidate through archive validation and atomic promotion', async () => {
    const fixture = await createBundle()
    const destinationDir = join(fixture.root, 'installed')
    const calls: string[] = []
    const verification = await installManagedUnsignedVerificationArtifact({
      tool: 'qpdf',
      architecture: 'arm64',
      artifactsDir: fixture.outputDir,
      destinationDir,
      fixturePdfPath: join(PROJECT_ROOT, 'test/fixtures/setup/managed-toolchain-smoke.pdf'),
      dependencies: {
        verifyArchitecture: async (_path, architecture) => { calls.push(`architecture:${architecture}`) },
        verifyDeploymentTarget: async () => { calls.push('deployment') },
        verifyUnsignedSignature: async () => { calls.push('unsigned') },
        verifyLinkage: async () => { calls.push('linkage') },
        verifyNoLeaks: async () => { calls.push('leaks') },
        runFixtureChecks: async tool => { calls.push(`fixture:${tool}`) }
      }
    })
    expect(verification.promotable).toBe(false)
    expect(await Bun.file(join(destinationDir, 'bin/qpdf')).exists()).toBe(true)
    expect(await Bun.file(join(destinationDir, MANAGED_UNSIGNED_PAYLOAD_MANIFEST_NAME)).exists()).toBe(true)
    expect(await Bun.file(join(destinationDir, '.autoshow-managed-artifact.json')).exists()).toBe(false)
    expect(calls).toEqual([
      'architecture:arm64', 'deployment', 'unsigned', 'linkage', 'leaks', 'fixture:qpdf',
      'architecture:arm64', 'deployment', 'unsigned', 'linkage', 'leaks', 'fixture:qpdf',
      'architecture:arm64', 'deployment', 'unsigned', 'linkage', 'leaks', 'fixture:qpdf'
    ])
  })

  test('leaves a prior install intact when the unsigned archive fails trust validation', async () => {
    const fixture = await createBundle()
    const destinationDir = join(fixture.root, 'installed')
    await mkdir(destinationDir, { recursive: true })
    await Bun.write(join(destinationDir, 'prior.txt'), 'healthy prior install\n')
    await Bun.write(fixture.bundle.archivePath, 'corrupt archive\n')
    await expect(installManagedUnsignedVerificationArtifact({
      tool: 'qpdf',
      architecture: 'arm64',
      artifactsDir: fixture.outputDir,
      destinationDir,
      fixturePdfPath: join(PROJECT_ROOT, 'test/fixtures/setup/managed-toolchain-smoke.pdf')
    })).rejects.toThrow('archive SHA-256 mismatch')
    expect(await Bun.file(join(destinationDir, 'prior.txt')).text()).toBe('healthy prior install\n')
  })

  test('fails closed when the outer verification review identifiers drift', async () => {
    const fixture = await createBundle()
    const verification = JSON.parse(await Bun.file(fixture.bundle.manifestPath).text()) as Record<string, unknown>
    verification['licenseReviewReferences'] = ['ADR-004-P5-QPDF-CHANGED']
    await Bun.write(fixture.bundle.manifestPath, `${JSON.stringify(verification, null, 2)}\n`)
    await expect(installManagedUnsignedVerificationArtifact({
      tool: 'qpdf',
      architecture: 'arm64',
      artifactsDir: fixture.outputDir,
      destinationDir: join(fixture.root, 'installed'),
      fixturePdfPath: join(PROJECT_ROOT, 'test/fixtures/setup/managed-toolchain-smoke.pdf')
    })).rejects.toThrow('license reviews do not match')
  })

  test('proves absent candidates select the independent source callback with a visible warning', async () => {
    let sourceRuns = 0
    const warnings: string[] = []
    await exerciseManagedUnsignedSourceFallback({
      tool: 'mupdf',
      architecture: 'arm64',
      installSource: async () => { sourceRuns += 1 },
      warn: message => { warnings.push(message) }
    })
    expect(sourceRuns).toBe(1)
    expect(warnings).toHaveLength(1)
    expect(warnings[0] ?? '').toContain('no pinned prebuilt candidate')
  })
})

describe('Phase 4 producer hardening contracts', () => {
  test('disables host libcrypto discovery in the shared MuPDF recipe', () => {
    expect(buildMupdfMakeArguments(4)).toEqual([
      '-j', '4',
      'build=release',
      'HAVE_X11=no',
      'HAVE_GLUT=no',
      'HAVE_OBJCOPY=no',
      'HAVE_LIBCRYPTO=no'
    ])
  })

  test('checks qpdf portability before running its upstream test suite', async () => {
    const source = await Bun.file(join(PROJECT_ROOT, 'src/tools/macos-toolchain-producer.ts')).text()
    const buildStart = source.indexOf('const buildQpdf = async')
    const buildEnd = source.indexOf('export const buildManagedUnsignedTool', buildStart)
    const buildSource = source.slice(buildStart, buildEnd)
    expect(buildSource.indexOf('await assertPortableQpdfDynamicLibraryClosure')).toBeLessThan(buildSource.indexOf("await runChecked('ctest'"))
  })

  test('parses the exact deployment target and detects build paths and credential shapes', () => {
    expect(parseMacosDeploymentTarget(' platform MACOS\n    minos 15.0\n      sdk 15.5\n')).toBe('15.0')
    expect(parseMacosDeploymentTarget('no build command')).toBeUndefined()
    expect(findManagedUnsignedArtifactLeaks('safe release strings')).toEqual([])
    expect(findManagedUnsignedArtifactLeaks('/Users/runner/work/autoshow secret ghp_abcdefghijklmnopqrstuvwxyz')).toEqual([
      'GitHub token',
      'GitHub Actions build path'
    ])
  })

  test('keeps retired toolchain producer workflows out of repository automation', async () => {
    expect(await Bun.file(join(PROJECT_ROOT, '.github/workflows/macos-toolchain-unsigned.yml')).exists()).toBe(false)
    expect(await Bun.file(join(PROJECT_ROOT, '.github/workflows/macos-toolchain-release.yml')).exists()).toBe(false)
  })

  test('does not configure an unsigned or release candidate in production metadata', async () => {
    const dependencyMetadata = await Bun.file(join(PROJECT_ROOT, 'src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts')).text()

    expect(dependencyMetadata).not.toContain('unsigned-verification')
    expect(managedUnsignedVerificationManifestName('qpdf', 'arm64')).toEndWith('.verification.json')
    expect(managedUnsignedVerificationSbomName('qpdf', 'arm64')).toEndWith('.spdx.json')
  })
})
