import { describe, expect, test } from 'bun:test'
import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  managedArtifactBuildFlags,
  managedArtifactManifestPath,
  MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME,
  readExpectedManagedArtifactSources,
  sha256Bytes,
  sha256File,
  validateManagedArtifact,
  validateManagedPrebuiltArtifact
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import {
  classifyManagedPrebuiltFailure,
  installManagedPrebuiltCandidate,
  installManagedPrebuiltOrSource,
  managedPrebuiltAvailabilityError,
  managedPrebuiltTrustError,
  resolveManagedPrebuiltEligibility,
  validateManagedPrebuiltArchiveEntries
} from '~/cli/commands/setup-and-utilities/setup/setup-download/prebuilt-artifact'
import { managedToolchainDistributionLicense } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import type {
  ManagedArtifactToolId,
  ManagedPrebuiltCandidate,
  ManagedPrebuiltLicense,
  ManagedPrebuiltPayloadManifest,
  ManagedPrebuiltReleaseManifest
} from '~/types'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: [],
  tempPrefix: 'autoshow-prebuilt-artifact-test-'
})

const TEAM_ID = 'A1B2C3D4E5'
const SIGNING_IDENTITY = `Developer ID Application: AutoShow Fixture (${TEAM_ID})`
const PRODUCER_COMMIT = '0123456789abcdef0123456789abcdef01234567'
const VERSION_BY_TOOL = { mupdf: '1.27.2', qpdf: '12.3.2' } as const
const BINARY_BY_TOOL = { mupdf: 'bin/mutool', qpdf: 'bin/qpdf' } as const

type PrebuiltFixture = {
  tool: ManagedArtifactToolId
  root: string
  packageDir: string
  archiveBytes: string
  candidate: ManagedPrebuiltCandidate
  payload: ManagedPrebuiltPayloadManifest
  release: ManagedPrebuiltReleaseManifest
  writePayload: (mutate: (payload: ManagedPrebuiltPayloadManifest) => void) => Promise<void>
  writeRelease: (mutate: (release: ManagedPrebuiltReleaseManifest) => void) => void
  dependencies: {
    downloadArchive: (candidate: ManagedPrebuiltCandidate, destination: string) => Promise<void>
    extractArchive: (archivePath: string, destination: string, packageRoot: string) => Promise<void>
    verifyCodeSignature: (binaryPath: string, expected: { signingIdentity: string, teamId: string }) => Promise<void>
    verifyArchitecture: (binaryPath: string, expected: 'arm64' | 'x64') => Promise<void>
    runBinary: (command: string, args: string[]) => Promise<{ exitCode: number, stdout: string, stderr: string }>
  }
}

const materializeFixturePackage = async (
  tool: ManagedArtifactToolId,
  packageDir: string,
  license: ManagedPrebuiltLicense
): Promise<void> => {
  await mkdir(join(packageDir, 'bin'), { recursive: true })
  await mkdir(join(packageDir, 'licenses'), { recursive: true })
  await Bun.write(join(packageDir, BINARY_BY_TOOL[tool]), `${tool} ${VERSION_BY_TOOL[tool]} signed fixture\n`)
  for (const noticePath of license.noticePaths) {
    await mkdir(dirname(join(packageDir, noticePath)), { recursive: true })
    await Bun.write(join(packageDir, noticePath), `${tool} ${noticePath} fixture\n`)
  }
}

const buildPayloadManifest = async (
  tool: ManagedArtifactToolId,
  packageDir: string,
  license: ManagedPrebuiltLicense
): Promise<ManagedPrebuiltPayloadManifest> => {
  const binaryPath = BINARY_BY_TOOL[tool]
  return {
    schemaVersion: 1,
    tool,
    version: VERSION_BY_TOOL[tool],
    revision: 'r1',
    platform: 'darwin',
    architecture: 'arm64',
    macosDeploymentTarget: '15.0',
    sources: await readExpectedManagedArtifactSources(tool),
    buildFlags: managedArtifactBuildFlags(tool),
    producer: {
      repository: 'ajcwebdev/autoshow-cli',
      commit: PRODUCER_COMMIT,
      workflowName: 'macOS toolchain fixture',
      workflowRunUrl: 'https://github.com/ajcwebdev/autoshow-cli/actions/runs/1',
      runnerLabel: 'macos-15',
      runnerImage: 'macos-15-arm64-fixture',
      compilerVersion: 'AppleClang fixture',
      sdkVersion: '15.0',
      buildToolVersions: ['cmake fixture', 'make fixture']
    },
    payload: [{ path: binaryPath, sha256: await sha256File(join(packageDir, binaryPath)), kind: 'executable' }],
    trust: { signingIdentity: SIGNING_IDENTITY, teamId: TEAM_ID },
    license
  }
}

const buildReleaseManifest = (
  tool: ManagedArtifactToolId,
  payload: ManagedPrebuiltPayloadManifest,
  payloadBytes: string,
  archiveName: string,
  archiveBytes: string
): ManagedPrebuiltReleaseManifest => ({
  schemaVersion: 1,
  identity: `${tool}-${payload.version}-${payload.revision}-darwin-${payload.architecture}`,
  tool,
  version: payload.version,
  revision: payload.revision,
  platform: 'darwin',
  architecture: payload.architecture,
  minimumMacosVersion: payload.macosDeploymentTarget,
  producerCommit: PRODUCER_COMMIT,
  archive: { name: archiveName, sha256: sha256Bytes(archiveBytes) },
  payloadManifestSha256: sha256Bytes(payloadBytes),
  notarization: { submissionId: 'fixture-notary-submission', status: 'Accepted' },
  sbom: { name: `${tool}-${payload.version}-${payload.revision}.spdx.json`, sha256: '1'.repeat(64) },
  provenance: { repository: 'ajcwebdev/autoshow-cli', subjectDigest: sha256Bytes(archiveBytes) },
  licenseReviewReferences: payload.license.reviewReferences
})

const buildFixtureDependencies = (
  tool: ManagedArtifactToolId,
  packageDir: string,
  archiveBytes: string
): PrebuiltFixture['dependencies'] => ({
  downloadArchive: async (_candidate, destination) => { await Bun.write(destination, archiveBytes) },
  extractArchive: async (_archivePath, destination, packageRoot) => {
    await mkdir(destination, { recursive: true })
    await cp(packageDir, join(destination, packageRoot), { recursive: true })
  },
  verifyCodeSignature: async (_binaryPath, expected) => {
    if (expected.signingIdentity !== SIGNING_IDENTITY || expected.teamId !== TEAM_ID) throw new Error('fixture signature identity mismatch')
  },
  verifyArchitecture: async (_binaryPath, expected) => {
    if (expected !== 'arm64') throw new Error('fixture architecture mismatch')
  },
  runBinary: async () => ({ exitCode: 0, stdout: `${tool} version ${VERSION_BY_TOOL[tool]}\n`, stderr: '' })
})

const createFixture = async (tool: ManagedArtifactToolId = 'qpdf'): Promise<PrebuiltFixture> => {
  const root = await tempDirs.make()
  const packageDir = join(root, 'package')
  const license = managedToolchainDistributionLicense(tool)
  await materializeFixturePackage(tool, packageDir, license)
  const payload = await buildPayloadManifest(tool, packageDir, license)
  const payloadPath = join(packageDir, MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME)
  const writePayloadBytes = async (): Promise<string> => {
    const bytes = `${JSON.stringify(payload, null, 2)}\n`
    await Bun.write(payloadPath, bytes)
    return bytes
  }
  const payloadBytes = await writePayloadBytes()
  const archiveBytes = `${tool} prebuilt archive fixture bytes\n`
  const archiveName = `autoshow-${tool}-${payload.version}-${payload.revision}-darwin-${payload.architecture}.zip`
  const release = buildReleaseManifest(tool, payload, payloadBytes, archiveName, archiveBytes)
  // The candidate embeds the serialized release manifest and its hash, and the release
  // hashes the payload bytes, so every payload or release mutation below has to refresh
  // the candidate afterwards or the fixture stops describing itself.
  const candidate = {} as ManagedPrebuiltCandidate
  const refreshCandidateRelease = (): void => {
    const releaseManifestJson = `${JSON.stringify(release, null, 2)}\n`
    Object.assign(candidate, {
      tool,
      version: payload.version,
      revision: payload.revision,
      platform: 'darwin',
      architecture: payload.architecture,
      minimumMacosVersion: payload.macosDeploymentTarget,
      url: `https://fixtures.invalid/releases/${archiveName}`,
      archiveName,
      archiveSha256: release.archive.sha256,
      releaseManifestJson,
      releaseManifestSha256: sha256Bytes(releaseManifestJson),
      expectedSigningIdentity: SIGNING_IDENTITY,
      expectedTeamId: TEAM_ID
    } satisfies ManagedPrebuiltCandidate)
  }
  refreshCandidateRelease()
  return {
    tool,
    root,
    packageDir,
    archiveBytes,
    candidate,
    payload,
    release,
    writePayload: async mutate => {
      mutate(payload)
      const bytes = await writePayloadBytes()
      release.payloadManifestSha256 = sha256Bytes(bytes)
      refreshCandidateRelease()
    },
    writeRelease: mutate => {
      mutate(release)
      refreshCandidateRelease()
    },
    dependencies: buildFixtureDependencies(tool, packageDir, archiveBytes)
  }
}

const installFixture = async (fixture: PrebuiltFixture, destinationDir = join(fixture.root, 'installed')): Promise<string> => {
  await installManagedPrebuiltCandidate({
    tool: fixture.tool,
    candidate: fixture.candidate,
    destinationDir,
    host: { platform: 'darwin', architecture: 'arm64', macosVersion: '15.4' },
    dependencies: fixture.dependencies
  })
  return destinationDir
}

describe('dormant prebuilt schemas and eligible installation', () => {
  test('installs an exact eligible fixture through staging and validates it offline', async () => {
    const fixture = await createFixture('qpdf')
    let signatureChecks = 0
    fixture.dependencies.verifyCodeSignature = async (_path, expected) => {
      signatureChecks += 1
      expect(expected).toEqual({ signingIdentity: SIGNING_IDENTITY, teamId: TEAM_ID })
    }
    const destinationDir = await installFixture(fixture)

    expect(signatureChecks).toBeGreaterThanOrEqual(3)
    expect(await validateManagedPrebuiltArtifact('qpdf', {
      toolDir: destinationDir,
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4',
      expectedCandidate: fixture.candidate,
      verifyCodeSignature: fixture.dependencies.verifyCodeSignature,
      verifyArchitecture: fixture.dependencies.verifyArchitecture
    })).toMatchObject({
      healthy: true,
      distribution: 'prebuilt',
      version: '12.3.2',
      revision: 'r1',
      platform: 'darwin',
      architecture: 'arm64'
    })
    expect(JSON.parse(await Bun.file(managedArtifactManifestPath(destinationDir)).text())).toMatchObject({
      distribution: 'prebuilt',
      release: { notarizationStatus: 'Accepted', teamId: TEAM_ID }
    })
  })

  test('uses closed embedded and release schemas', async () => {
    const embedded = await createFixture()
    await embedded.writePayload(payload => { (payload as unknown as Record<string, unknown>)['unreviewed'] = true })
    await expect(installFixture(embedded)).rejects.toThrow('closed-schema validation')

    const released = await createFixture()
    released.writeRelease(release => { (release as unknown as Record<string, unknown>)['unreviewed'] = true })
    await expect(installFixture(released)).rejects.toThrow('closed-schema validation')
  })

  test('rejects release and payload review identifiers outside the approved Phase 5 policy', async () => {
    const fixture = await createFixture()
    await fixture.writePayload(payload => { payload.license.reviewReferences = ['ADR-004-P5-QPDF-CHANGED'] })
    fixture.writeRelease(release => { release.licenseReviewReferences = ['ADR-004-P5-QPDF-CHANGED'] })
    await expect(installFixture(fixture)).rejects.toThrow('license reviews do not match the approved Phase 5 policy')
  })

  test('keeps prebuilts dormant without explicitly injected candidate metadata', async () => {
    const fixture = await createFixture()
    const destinationDir = await installFixture(fixture)

    expect(await validateManagedArtifact('qpdf', {
      toolDir: destinationDir,
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4'
    })).toEqual({ healthy: false, reason: 'no pinned prebuilt candidate metadata is configured' })

    const managedToolsSource = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools.ts').text()
    expect(managedToolsSource).not.toContain('installManagedPrebuiltCandidate')
  })
})

describe('eligibility and availability fallback', () => {
  test('rejects unsupported hosts before candidate resolution and falls back visibly', async () => {
    expect(resolveManagedPrebuiltEligibility({ platform: 'darwin', architecture: 'arm64', macosVersion: '15.0' })).toMatchObject({ eligible: true })
    expect(resolveManagedPrebuiltEligibility({ platform: 'darwin', architecture: 'riscv64', macosVersion: '15.0' })).toMatchObject({ eligible: false })
    expect(resolveManagedPrebuiltEligibility({ platform: 'darwin', architecture: 'x64', macosVersion: '14.7' })).toMatchObject({ eligible: false })

    const warnings: string[] = []
    let candidateResolutions = 0
    let sourceInstalls = 0
    const result = await installManagedPrebuiltOrSource({
      tool: 'mupdf',
      platform: 'darwin',
      architecture: 'riscv64',
      macosVersion: '15.4',
      resolveCandidate: async () => { candidateResolutions += 1; return undefined },
      installPrebuilt: async () => undefined,
      installSource: async () => { sourceInstalls += 1 },
      warn: message => warnings.push(message)
    })
    expect(result).toBe('source')
    expect(candidateResolutions).toBe(0)
    expect(sourceInstalls).toBe(1)
    expect(warnings.join('\n')).toContain('falling back')
  })

  test('absent candidates and exhausted availability retries fall back per tool', async () => {
    const fixture = await createFixture('mupdf')
    const warnings: string[] = []
    const sourceTools: string[] = []
    const prebuiltTools: string[] = []
    const common = {
      platform: 'darwin' as const,
      architecture: 'arm64',
      macosVersion: '15.4',
      installSource: async () => undefined,
      warn: (message: string) => warnings.push(message)
    }
    expect(await installManagedPrebuiltOrSource({
      ...common,
      tool: 'mupdf',
      resolveCandidate: async () => fixture.candidate,
      installPrebuilt: async candidate => { prebuiltTools.push(candidate.tool) }
    })).toBe('prebuilt')
    expect(await installManagedPrebuiltOrSource({
      ...common,
      tool: 'qpdf',
      resolveCandidate: async () => undefined,
      installPrebuilt: async () => undefined,
      installSource: async () => { sourceTools.push('qpdf') }
    })).toBe('source')
    expect(await installManagedPrebuiltOrSource({
      ...common,
      tool: 'qpdf',
      resolveCandidate: async () => { throw managedPrebuiltAvailabilityError('HTTP retries exhausted') },
      installPrebuilt: async () => undefined,
      installSource: async () => { sourceTools.push('qpdf-retry') }
    })).toBe('source')
    expect(prebuiltTools).toEqual(['mupdf'])
    expect(sourceTools).toEqual(['qpdf', 'qpdf-retry'])
    expect(warnings.join('\n')).toContain('no pinned prebuilt candidate')
    expect(warnings.join('\n')).toContain('HTTP retries exhausted')
  })

  test('a clean-host candidate incompatibility falls back before trust verification', async () => {
    const fixture = await createFixture()
    fixture.candidate.minimumMacosVersion = '16.0'
    let prebuiltInstalls = 0
    let sourceInstalls = 0
    expect(await installManagedPrebuiltOrSource({
      tool: 'qpdf',
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4',
      resolveCandidate: async () => fixture.candidate,
      installPrebuilt: async () => { prebuiltInstalls += 1 },
      installSource: async () => { sourceInstalls += 1 },
      warn: () => undefined
    })).toBe('source')
    expect(prebuiltInstalls).toBe(0)
    expect(sourceInstalls).toBe(1)
  })

  test('a healthy explicit override bypasses candidate and source work', async () => {
    let work = 0
    expect(await installManagedPrebuiltOrSource({
      tool: 'qpdf',
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4',
      overrideSatisfied: true,
      resolveCandidate: async () => { work += 1; return undefined },
      installPrebuilt: async () => { work += 1 },
      installSource: async () => { work += 1 },
      warn: () => undefined
    })).toBe('override')
    expect(work).toBe(0)
  })
})

describe('trust failures fail closed without source fallback', () => {
  test('classifies availability explicitly and unknown failures as trust failures', () => {
    expect(classifyManagedPrebuiltFailure(managedPrebuiltAvailabilityError('offline'))).toBe('availability')
    expect(classifyManagedPrebuiltFailure(managedPrebuiltTrustError('tampered'))).toBe('trust')
    expect(classifyManagedPrebuiltFailure(new Error('unexpected'))).toBe('trust')
  })

  test('does not source-fallback after any trust failure', async () => {
    const fixture = await createFixture()
    let sourceInstalls = 0
    await expect(installManagedPrebuiltOrSource({
      tool: 'qpdf',
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4',
      resolveCandidate: async () => fixture.candidate,
      installPrebuilt: async () => { throw managedPrebuiltTrustError('signature mismatch') },
      installSource: async () => { sourceInstalls += 1 },
      warn: () => undefined
    })).rejects.toThrow('signature mismatch')
    expect(sourceInstalls).toBe(0)
  })

  test('fails closed on archive checksum, payload hash, and exact version mismatches', async () => {
    const checksum = await createFixture()
    checksum.dependencies.downloadArchive = async (_candidate, destination) => { await Bun.write(destination, 'different archive bytes') }
    await expect(installFixture(checksum)).rejects.toThrow('archive SHA-256')

    const payloadHash = await createFixture()
    await Bun.write(join(payloadHash.packageDir, BINARY_BY_TOOL.qpdf), 'corrupt payload\n')
    await expect(installFixture(payloadHash)).rejects.toThrow('payload hash mismatch')

    const version = await createFixture()
    await version.writePayload(payload => { payload.version = '11.0.0' })
    version.candidate.version = '12.3.2'
    await expect(installFixture(version)).rejects.toThrow('embedded payload identity')
  })

  test('fails closed on architecture, Team-ID, signature, and notary mismatches', async () => {
    const architecture = await createFixture()
    architecture.candidate.architecture = 'x64'
    await expect(installFixture(architecture)).rejects.toThrow('candidate platform or architecture')

    const binaryArchitecture = await createFixture()
    binaryArchitecture.dependencies.verifyArchitecture = async () => { throw new Error('not a thin arm64 Mach-O') }
    await expect(installFixture(binaryArchitecture)).rejects.toThrow('not a thin arm64 Mach-O')

    const team = await createFixture()
    await team.writePayload(payload => { payload.trust.teamId = 'Z9Y8X7W6V5' })
    await expect(installFixture(team)).rejects.toThrow('embedded Team ID')

    const signature = await createFixture()
    signature.dependencies.verifyCodeSignature = async () => { throw new Error('codesign rejected fixture') }
    await expect(installFixture(signature)).rejects.toThrow('code-signature verification failed')

    const notary = await createFixture()
    notary.writeRelease(release => { (release.notarization as { status: string }).status = 'Rejected' })
    await expect(installFixture(notary)).rejects.toThrow('closed-schema validation')
  })

  test('rejects traversal, absolute, alternate-root, and duplicate archive entries', () => {
    expect(() => validateManagedPrebuiltArchiveEntries(['qpdf/', 'qpdf/bin/qpdf'], 'qpdf')).not.toThrow()
    expect(() => validateManagedPrebuiltArchiveEntries(['qpdf/../outside'], 'qpdf')).toThrow('traversal')
    expect(() => validateManagedPrebuiltArchiveEntries(['/qpdf/bin/qpdf'], 'qpdf')).toThrow('unsafe path')
    expect(() => validateManagedPrebuiltArchiveEntries(['other/bin/qpdf'], 'qpdf')).toThrow('outside top-level')
    expect(() => validateManagedPrebuiltArchiveEntries(['qpdf/bin/qpdf', 'qpdf/bin/qpdf'], 'qpdf')).toThrow('duplicate')
  })
})

describe('prebuilt atomic rollback', () => {
  test('preserves a prior healthy directory when candidate activation fails', async () => {
    const fixture = await createFixture()
    const destinationDir = join(fixture.root, 'installed')
    await mkdir(destinationDir, { recursive: true })
    await Bun.write(join(destinationDir, 'prior'), 'healthy prior install\n')

    await expect(installManagedPrebuiltCandidate({
      tool: 'qpdf',
      candidate: fixture.candidate,
      destinationDir,
      host: { platform: 'darwin', architecture: 'arm64', macosVersion: '15.4' },
      dependencies: fixture.dependencies,
      activate: async () => { throw new Error('shim activation interrupted') }
    })).rejects.toThrow('shim activation interrupted')

    expect(await Bun.file(join(destinationDir, 'prior')).text()).toBe('healthy prior install\n')
    expect(await Bun.file(join(destinationDir, 'bin/qpdf')).exists()).toBe(false)
  })

  test('preserves a prior install when staged provenance validation fails', async () => {
    const fixture = await createFixture()
    const destinationDir = join(fixture.root, 'installed')
    await mkdir(destinationDir, { recursive: true })
    await Bun.write(join(destinationDir, 'prior'), 'healthy prior install\n')
    fixture.dependencies.runBinary = async () => ({ exitCode: 0, stdout: 'qpdf version 11.0.0\n', stderr: '' })

    await expect(installManagedPrebuiltCandidate({
      tool: 'qpdf',
      candidate: fixture.candidate,
      destinationDir,
      host: { platform: 'darwin', architecture: 'arm64', macosVersion: '15.4' },
      dependencies: fixture.dependencies
    })).rejects.toThrow('exact 12.3.2 version check')

    expect(await Bun.file(join(destinationDir, 'prior')).text()).toBe('healthy prior install\n')
  })
})
