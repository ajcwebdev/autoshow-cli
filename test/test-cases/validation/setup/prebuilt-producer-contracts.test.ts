import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
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
  await Bun.write(join(sources.mupdf, 'COPYING'), 'MuPDF AGPL fixture\n')
  await Bun.write(join(sources.qpdf, 'LICENSE.txt'), 'qpdf Apache fixture\n')
  await Bun.write(join(sources.qpdf, 'NOTICE.md'), 'qpdf notice fixture\n')
  await Bun.write(join(sources['libjpeg-turbo'], 'LICENSE.md'), 'libjpeg-turbo license fixture\n')
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

describe('Phase 4 unsigned artifact schemas and packaging', () => {
  test('uses conspicuous non-release names for both tools and architectures', () => {
    expect(managedUnsignedVerificationArchiveName('mupdf', 'arm64')).toBe('autoshow-unsigned-verification-mupdf-1.27.2-r1-darwin-arm64.zip')
    expect(managedUnsignedVerificationArchiveName('qpdf', 'x64')).toBe('autoshow-unsigned-verification-qpdf-12.3.2-r1-darwin-x64.zip')
    expect(managedUnsignedVerificationArchiveName('qpdf', 'x64')).not.toBe('autoshow-qpdf-12.3.2-r1-darwin-x64.zip')
  })

  test('packages exact pins, preliminary notices, a closed non-promotable manifest, and SPDX 2.3 JSON', async () => {
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
    expect((sbom['packages'] as Array<{ name: string }>).map(entry => entry.name)).toEqual(['qpdf', 'libjpeg-turbo'])
    expect(managedUnsignedVerificationNoticePaths('qpdf')).toEqual([
      'licenses/qpdf-LICENSE.txt',
      'licenses/qpdf-NOTICE.md',
      'licenses/libjpeg-turbo-LICENSE.md'
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
    expect(payload['license']).toMatchObject({ reviewStatus: 'pending-phase-5' })
    expect(await Bun.file(join(extractionDir, 'mupdf', '.autoshow-payload-manifest.json')).exists()).toBe(false)
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

  test('parses the exact deployment target and detects build paths and credential shapes', () => {
    expect(parseMacosDeploymentTarget(' platform MACOS\n    minos 15.0\n      sdk 15.5\n')).toBe('15.0')
    expect(parseMacosDeploymentTarget('no build command')).toBeUndefined()
    expect(findManagedUnsignedArtifactLeaks('safe release strings')).toEqual([])
    expect(findManagedUnsignedArtifactLeaks('/Users/runner/work/autoshow secret ghp_abcdefghijklmnopqrstuvwxyz')).toEqual([
      'GitHub token',
      'GitHub Actions build path'
    ])
  })

  test('pins an unprivileged two-architecture workflow entirely by full commit SHA', async () => {
    const workflow = await Bun.file(join(PROJECT_ROOT, '.github/workflows/macos-toolchain-unsigned.yml')).text()
    expect(workflow).toContain('runner: macos-15\n            architecture: arm64')
    expect(workflow).toContain('runner: macos-15-intel\n            architecture: x64')
    expect(workflow).toContain('permissions:\n  contents: read')
    expect(workflow).toContain('persist-credentials: false')
    expect(workflow).toContain('artifact-digest')
    expect(workflow).toContain('toolchain:verify-source-fallback')
    const actionReferences = [...workflow.matchAll(/uses:\s+[^@\s]+@([^\s]+)/g)].map(match => match[1] ?? '')
    expect(actionReferences.length).toBeGreaterThanOrEqual(6)
    expect(actionReferences.every(reference => /^[a-f0-9]{40}$/.test(reference))).toBe(true)
    expect(workflow).not.toMatch(/pull_request_target|secrets\.|notarytool|gh release|codesign\s+--sign|contents:\s*write/)
  })

  test('does not configure an unsigned or release candidate in production metadata', async () => {
    const dependencyMetadata = await Bun.file(join(PROJECT_ROOT, 'src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts')).text()
    expect(dependencyMetadata).not.toContain('prebuiltUrl')
    expect(dependencyMetadata).not.toContain('prebuiltSha256')
    expect(dependencyMetadata).not.toContain('unsigned-verification')
    expect(managedUnsignedVerificationManifestName('qpdf', 'arm64')).toEndWith('.verification.json')
    expect(managedUnsignedVerificationSbomName('qpdf', 'arm64')).toEndWith('.spdx.json')
  })
})
