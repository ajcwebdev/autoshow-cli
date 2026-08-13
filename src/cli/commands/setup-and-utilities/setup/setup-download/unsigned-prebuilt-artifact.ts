import { randomUUID } from 'node:crypto'
import { chmod, cp, lstat, mkdir, readdir, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import * as v from 'valibot'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import {
  managedArtifactBinaryRelativePath,
  managedArtifactBuildFlags,
  MANAGED_ARTIFACT_SCHEMA_VERSION,
  readExpectedManagedArtifactSources,
  sha256Bytes,
  sha256File,
  validateManagedSourceArtifact,
  verifyManagedPrebuiltArchitecture
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import {
  extractManagedPrebuiltZip,
  installManagedPrebuiltOrSource,
  managedPrebuiltTrustError
} from '~/cli/commands/setup-and-utilities/setup/setup-download/prebuilt-artifact'
import {
  managedToolchainDistributionLicense,
  validateManagedToolchainDistributionLicense
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import {
  createManagedToolchainSpdx,
  writeManagedToolchainPackageNotices
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-package'
import { findForbiddenMacosDynamicLibraryReferences } from '~/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build'
import { promoteManagedToolDirectory } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import type {
  ManagedArtifactPayloadFile,
  ManagedArtifactToolId,
  ManagedPrebuiltProducer,
  ManagedUnsignedVerificationBundle,
  ManagedUnsignedVerificationManifest,
  ManagedUnsignedVerificationPayloadManifest,
  RunResult
} from '~/types'
import { pathExists } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'

export const MANAGED_UNSIGNED_PAYLOAD_MANIFEST_NAME = '.autoshow-unsigned-verification-payload.json'
export const MANAGED_UNSIGNED_REVISION = 'r1'
export const MANAGED_UNSIGNED_DEPLOYMENT_TARGET = '15.0'

const Sha256Schema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const NonEmptyStringSchema = v.pipe(v.string(), v.minLength(1))
const SafeRelativePathSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z0-9._+][A-Za-z0-9._+/-]*$/),
  v.regex(/^(?!.*(?:^|\/)\.{1,2}(?:\/|$)).+$/)
)
const SafeFileNameSchema = v.pipe(v.string(), v.regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/))

const ArtifactSourceSchema = v.strictObject({
  name: NonEmptyStringSchema,
  version: NonEmptyStringSchema,
  url: NonEmptyStringSchema,
  sha256: Sha256Schema
})

const PayloadFileSchema = v.strictObject({
  path: SafeRelativePathSchema,
  sha256: Sha256Schema,
  kind: v.picklist(['executable', 'library'])
})

const ProducerSchema = v.strictObject({
  repository: v.literal('ajcwebdev/autoshow-cli'),
  commit: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/)),
  workflowName: NonEmptyStringSchema,
  workflowRunUrl: NonEmptyStringSchema,
  runnerLabel: v.picklist(['macos-15', 'macos-15-intel']),
  runnerImage: NonEmptyStringSchema,
  compilerVersion: NonEmptyStringSchema,
  sdkVersion: NonEmptyStringSchema,
  buildToolVersions: v.array(NonEmptyStringSchema)
})

export const ManagedUnsignedVerificationPayloadManifestSchema = v.strictObject({
  schemaVersion: v.literal(MANAGED_ARTIFACT_SCHEMA_VERSION),
  artifactKind: v.literal('unsigned-verification'),
  promotable: v.literal(false),
  tool: v.picklist(['mupdf', 'qpdf']),
  version: NonEmptyStringSchema,
  revision: v.literal(MANAGED_UNSIGNED_REVISION),
  platform: v.literal('darwin'),
  architecture: v.picklist(['arm64', 'x64']),
  macosDeploymentTarget: v.literal(MANAGED_UNSIGNED_DEPLOYMENT_TARGET),
  sources: v.array(ArtifactSourceSchema),
  buildFlags: v.array(NonEmptyStringSchema),
  producer: ProducerSchema,
  payload: v.array(PayloadFileSchema),
  trust: v.strictObject({
    developerIdSigned: v.literal(false),
    notarized: v.literal(false)
  }),
  license: v.strictObject({
    primaryLicense: NonEmptyStringSchema,
    noticePaths: v.array(SafeRelativePathSchema),
    correspondingSourceAssets: v.array(SafeFileNameSchema),
    autoshowSourceArchive: NonEmptyStringSchema,
    reviewStatus: v.literal('approved'),
    reviewReferences: v.array(NonEmptyStringSchema),
    reviewedAt: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
    repositoryReviewer: NonEmptyStringSchema,
    complianceReviewer: NonEmptyStringSchema,
    writtenOfferRequired: v.literal(false),
    userNoticePath: SafeRelativePathSchema
  })
})

export const ManagedUnsignedVerificationManifestSchema = v.strictObject({
  schemaVersion: v.literal(MANAGED_ARTIFACT_SCHEMA_VERSION),
  artifactKind: v.literal('unsigned-verification'),
  promotable: v.literal(false),
  tool: v.picklist(['mupdf', 'qpdf']),
  version: NonEmptyStringSchema,
  revision: v.literal(MANAGED_UNSIGNED_REVISION),
  platform: v.literal('darwin'),
  architecture: v.picklist(['arm64', 'x64']),
  minimumMacosVersion: v.literal(MANAGED_UNSIGNED_DEPLOYMENT_TARGET),
  producerCommit: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/)),
  archive: v.strictObject({
    name: SafeFileNameSchema,
    sha256: Sha256Schema
  }),
  payloadManifestSha256: Sha256Schema,
  sbom: v.strictObject({
    name: SafeFileNameSchema,
    sha256: Sha256Schema,
    format: v.literal('SPDX-2.3-json')
  }),
  licenseReviewReferences: v.array(NonEmptyStringSchema)
})

const parseSchema = <T>(schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>, value: unknown, label: string): T => {
  const result = v.safeParse(schema, value)
  if (!result.success) throw managedPrebuiltTrustError(`invalid ${label}`)
  return result.output
}

export const parseManagedUnsignedVerificationPayloadManifest = (value: unknown): ManagedUnsignedVerificationPayloadManifest =>
  parseSchema(ManagedUnsignedVerificationPayloadManifestSchema, value, 'unsigned verification payload manifest')

export const parseManagedUnsignedVerificationManifest = (value: unknown): ManagedUnsignedVerificationManifest =>
  parseSchema(ManagedUnsignedVerificationManifestSchema, value, 'unsigned verification manifest')

const versionByTool = (tool: ManagedArtifactToolId): string => tool === 'mupdf' ? '1.27.2' : '12.3.2'

export const managedUnsignedVerificationBaseName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `autoshow-unsigned-verification-${tool}-${versionByTool(tool)}-${MANAGED_UNSIGNED_REVISION}-darwin-${architecture}`

export const managedUnsignedVerificationArchiveName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `${managedUnsignedVerificationBaseName(tool, architecture)}.zip`

export const managedUnsignedVerificationManifestName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `${managedUnsignedVerificationBaseName(tool, architecture)}.verification.json`

export const managedUnsignedVerificationSbomName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `${managedUnsignedVerificationBaseName(tool, architecture)}.spdx.json`

export const managedUnsignedVerificationNoticePaths = (tool: ManagedArtifactToolId): string[] =>
  managedToolchainDistributionLicense(tool).noticePaths

export const createManagedUnsignedVerificationSpdx = (
  payload: ManagedUnsignedVerificationPayloadManifest,
  created = new Date().toISOString()
): Record<string, unknown> => createManagedToolchainSpdx({
  documentName: `${managedUnsignedVerificationBaseName(payload.tool, payload.architecture)}-sbom`,
  tool: payload.tool,
  architecture: payload.architecture,
  producer: payload.producer,
  sources: payload.sources,
  payload: payload.payload,
  created
})

const assertCommand = async (
  command: string,
  args: string[],
  options: { cwd?: string, env?: Record<string, string | undefined> } = {}
): Promise<RunResult> => {
  const result = await runCapture(command, args, { allowFailure: true, ...options })
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.trim() || result.stdout.trim()}`)
  return result
}

const collectRegularFiles = async (root: string, relativeDir = ''): Promise<string[]> => {
  const directory = relativeDir ? join(root, relativeDir) : root
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
    const stat = await lstat(join(root, relativePath))
    if (stat.isSymbolicLink()) throw managedPrebuiltTrustError(`unsigned verification package contains symbolic link ${relativePath}`)
    if (stat.isDirectory()) files.push(...await collectRegularFiles(root, relativePath))
    else if (stat.isFile()) files.push(relativePath)
    else throw managedPrebuiltTrustError(`unsigned verification package contains unsupported file type ${relativePath}`)
  }
  return files.sort()
}

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)

export const packageManagedUnsignedVerificationArtifact = async (options: {
  tool: ManagedArtifactToolId
  architecture: 'arm64' | 'x64'
  binaryPath: string
  sourceDirectories: Partial<Record<'mupdf' | 'qpdf' | 'libjpeg-turbo', string>>
  outputDir: string
  producer: ManagedPrebuiltProducer
}): Promise<ManagedUnsignedVerificationBundle> => {
  const workDir = join(options.outputDir, `.unsigned-package-${options.tool}-${randomUUID()}`)
  const packageDir = join(workDir, options.tool)
  const binaryRelativePath = managedArtifactBinaryRelativePath(options.tool)
  const archiveName = managedUnsignedVerificationArchiveName(options.tool, options.architecture)
  const sbomName = managedUnsignedVerificationSbomName(options.tool, options.architecture)
  const manifestName = managedUnsignedVerificationManifestName(options.tool, options.architecture)
  const archivePath = join(options.outputDir, archiveName)
  const sbomPath = join(options.outputDir, sbomName)
  const manifestPath = join(options.outputDir, manifestName)
  await mkdir(options.outputDir, { recursive: true })
  await rm(archivePath, { force: true })
  await rm(sbomPath, { force: true })
  await rm(manifestPath, { force: true })
  try {
    await mkdir(dirname(join(packageDir, binaryRelativePath)), { recursive: true })
    await cp(options.binaryPath, join(packageDir, binaryRelativePath))
    await chmod(join(packageDir, binaryRelativePath), 0o755)
    await writeManagedToolchainPackageNotices({
      tool: options.tool,
      packageDir,
      sourceDirectories: options.sourceDirectories
    })
    const license = managedToolchainDistributionLicense(options.tool)
    const payload: ManagedUnsignedVerificationPayloadManifest = {
      schemaVersion: MANAGED_ARTIFACT_SCHEMA_VERSION,
      artifactKind: 'unsigned-verification',
      promotable: false,
      tool: options.tool,
      version: versionByTool(options.tool),
      revision: MANAGED_UNSIGNED_REVISION,
      platform: 'darwin',
      architecture: options.architecture,
      macosDeploymentTarget: MANAGED_UNSIGNED_DEPLOYMENT_TARGET,
      sources: await readExpectedManagedArtifactSources(options.tool),
      buildFlags: managedArtifactBuildFlags(options.tool),
      producer: options.producer,
      payload: [{ path: binaryRelativePath, sha256: await sha256File(join(packageDir, binaryRelativePath)), kind: 'executable' }],
      trust: { developerIdSigned: false, notarized: false },
      license
    }
    parseManagedUnsignedVerificationPayloadManifest(payload)
    const payloadBytes = `${JSON.stringify(payload, null, 2)}\n`
    await Bun.write(join(packageDir, MANAGED_UNSIGNED_PAYLOAD_MANIFEST_NAME), payloadBytes)
    await assertCommand('zip', ['-X', '-q', '-r', archivePath, options.tool], { cwd: workDir })
    const sbomBytes = `${JSON.stringify(createManagedUnsignedVerificationSpdx(payload), null, 2)}\n`
    await Bun.write(sbomPath, sbomBytes)
    const archiveSha256 = await sha256File(archivePath)
    const sbomSha256 = sha256Bytes(sbomBytes)
    const verificationManifest: ManagedUnsignedVerificationManifest = {
      schemaVersion: MANAGED_ARTIFACT_SCHEMA_VERSION,
      artifactKind: 'unsigned-verification',
      promotable: false,
      tool: options.tool,
      version: payload.version,
      revision: MANAGED_UNSIGNED_REVISION,
      platform: 'darwin',
      architecture: options.architecture,
      minimumMacosVersion: MANAGED_UNSIGNED_DEPLOYMENT_TARGET,
      producerCommit: options.producer.commit,
      archive: { name: archiveName, sha256: archiveSha256 },
      payloadManifestSha256: sha256Bytes(payloadBytes),
      sbom: { name: sbomName, sha256: sbomSha256, format: 'SPDX-2.3-json' },
      licenseReviewReferences: payload.license.reviewReferences
    }
    parseManagedUnsignedVerificationManifest(verificationManifest)
    const manifestBytes = `${JSON.stringify(verificationManifest, null, 2)}\n`
    await Bun.write(manifestPath, manifestBytes)
    return {
      archivePath,
      manifestPath,
      sbomPath,
      archiveSha256,
      manifestSha256: sha256Bytes(manifestBytes),
      sbomSha256
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

export const parseMacosDeploymentTarget = (vtoolOutput: string): string | undefined =>
  vtoolOutput.match(/^\s*minos\s+(\d+(?:\.\d+){1,2})\s*$/m)?.[1]

export const assertManagedUnsignedCodeSignature = async (binaryPath: string): Promise<void> => {
  const result = await runCapture('codesign', ['-d', '--verbose=4', binaryPath], { allowFailure: true })
  const output = `${result.stdout}\n${result.stderr}`
  const completelyUnsigned = output.includes('code object is not signed at all')
  if (output.includes('Authority=') || (!completelyUnsigned && !output.includes('TeamIdentifier=not set'))) {
    throw managedPrebuiltTrustError('unsigned verification binary unexpectedly carries a distribution signing identity')
  }
  if (!output.includes('Signature=adhoc') && !completelyUnsigned) {
    throw managedPrebuiltTrustError('unsigned verification binary signature state is not unsigned or linker-signed')
  }
}

export const findManagedUnsignedArtifactLeaks = (value: string, forbiddenPaths: string[] = []): string[] => {
  const findings = new Set<string>()
  const checks: Array<[string, RegExp]> = [
    ['GitHub token', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
    ['AWS access key', /\bAKIA[A-Z0-9]{16}\b/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['Homebrew path', /\/(?:opt\/homebrew|usr\/local)\//],
    ['GitHub Actions build path', /\/Users\/runner\/work\//],
    ['temporary build path', /\/(?:private\/)?var\/folders\//]
  ]
  for (const [label, pattern] of checks) if (pattern.test(value)) findings.add(label)
  for (const path of forbiddenPaths.filter(Boolean)) if (value.includes(path)) findings.add(`build path ${path}`)
  return [...findings]
}

export const assertManagedUnsignedBinaryHasNoLeaks = async (
  binaryPath: string,
  forbiddenPaths: string[] = []
): Promise<void> => {
  const strings = await assertCommand('strings', [binaryPath])
  const findings = findManagedUnsignedArtifactLeaks(strings.stdout, forbiddenPaths)
  if (findings.length > 0) throw managedPrebuiltTrustError(`unsigned verification binary contains forbidden material: ${findings.join(', ')}`)
}

export const assertManagedUnsignedPortableLinkage = async (binaryPath: string): Promise<void> => {
  const result = await assertCommand('otool', ['-L', binaryPath])
  const forbidden = findForbiddenMacosDynamicLibraryReferences(result.stdout)
  if (forbidden.length > 0) throw managedPrebuiltTrustError(`unsigned verification binary has forbidden dynamic-library references: ${forbidden.join(', ')}`)
}

export const assertManagedUnsignedDeploymentTarget = async (binaryPath: string): Promise<void> => {
  const result = await assertCommand('vtool', ['-show-build', binaryPath])
  const target = parseMacosDeploymentTarget(result.stdout)
  if (target !== MANAGED_UNSIGNED_DEPLOYMENT_TARGET) {
    throw managedPrebuiltTrustError(`unsigned verification binary deployment target is ${target ?? 'unknown'}, expected ${MANAGED_UNSIGNED_DEPLOYMENT_TARGET}`)
  }
}

export const runManagedToolFixtureChecks = async (
  tool: ManagedArtifactToolId,
  binaryPath: string,
  fixturePdfPath: string,
  outputDir: string
): Promise<void> => {
  await mkdir(outputDir, { recursive: true })
  if (tool === 'mupdf') {
    const version = await runCapture(binaryPath, ['-v'], { allowFailure: true })
    if (![0, 1].includes(version.exitCode) || !`${version.stdout}\n${version.stderr}`.includes(versionByTool(tool))) throw new Error('mutool version check failed')
    await assertCommand(binaryPath, ['info', fixturePdfPath])
    const renderedPath = join(outputDir, 'mupdf-render.png')
    await assertCommand(binaryPath, ['draw', '-q', '-o', renderedPath, fixturePdfPath, '1'])
    if (!await pathExists(renderedPath)) throw new Error('mutool render did not create an output image')
    return
  }
  const version = await assertCommand(binaryPath, ['--version'])
  if (!version.stdout.includes(versionByTool(tool))) throw new Error('qpdf version check failed')
  await assertCommand(binaryPath, ['--check', fixturePdfPath])
  const encryptedPath = join(outputDir, 'encrypted.pdf')
  const decryptedPath = join(outputDir, 'decrypted.pdf')
  const linearizedPath = join(outputDir, 'linearized.pdf')
  await assertCommand(binaryPath, ['--encrypt', 'autoshow-user', 'autoshow-owner', '256', '--', fixturePdfPath, encryptedPath])
  await assertCommand(binaryPath, ['--password=autoshow-user', '--check', encryptedPath])
  await assertCommand(binaryPath, ['--password=autoshow-user', '--decrypt', encryptedPath, decryptedPath])
  await assertCommand(binaryPath, ['--check', decryptedPath])
  await assertCommand(binaryPath, ['--linearize', fixturePdfPath, linearizedPath])
  await assertCommand(binaryPath, ['--check-linearization', linearizedPath])
}

export type ManagedUnsignedVerificationDependencies = {
  extractArchive: typeof extractManagedPrebuiltZip
  verifyArchitecture: typeof verifyManagedPrebuiltArchitecture
  verifyDeploymentTarget: typeof assertManagedUnsignedDeploymentTarget
  verifyUnsignedSignature: typeof assertManagedUnsignedCodeSignature
  verifyLinkage: typeof assertManagedUnsignedPortableLinkage
  verifyNoLeaks: typeof assertManagedUnsignedBinaryHasNoLeaks
  runFixtureChecks: typeof runManagedToolFixtureChecks
}

const defaultUnsignedDependencies: ManagedUnsignedVerificationDependencies = {
  extractArchive: extractManagedPrebuiltZip,
  verifyArchitecture: verifyManagedPrebuiltArchitecture,
  verifyDeploymentTarget: assertManagedUnsignedDeploymentTarget,
  verifyUnsignedSignature: assertManagedUnsignedCodeSignature,
  verifyLinkage: assertManagedUnsignedPortableLinkage,
  verifyNoLeaks: assertManagedUnsignedBinaryHasNoLeaks,
  runFixtureChecks: runManagedToolFixtureChecks
}

const validateSpdxDocument = (value: unknown, payload: ManagedUnsignedVerificationPayloadManifest): void => {
  if (!value || typeof value !== 'object') throw managedPrebuiltTrustError('SPDX SBOM is not an object')
  const sbom = value as Record<string, unknown>
  const creationInfo = sbom['creationInfo']
  const created = creationInfo && typeof creationInfo === 'object' ? (creationInfo as Record<string, unknown>)['created'] : undefined
  if (typeof created !== 'string' || !sameJson(sbom, createManagedUnsignedVerificationSpdx(payload, created))) throw managedPrebuiltTrustError('SPDX SBOM inventory does not match the approved payload')
}

const readUnsignedPayload = async (
  packageDir: string,
  verification: ManagedUnsignedVerificationManifest
): Promise<ManagedUnsignedVerificationPayloadManifest> => {
  const payloadPath = join(packageDir, MANAGED_UNSIGNED_PAYLOAD_MANIFEST_NAME)
  const payloadBytes = await Bun.file(payloadPath).text()
  if (sha256Bytes(payloadBytes) !== verification.payloadManifestSha256) throw managedPrebuiltTrustError('unsigned payload manifest SHA-256 mismatch')
  return parseManagedUnsignedVerificationPayloadManifest(JSON.parse(payloadBytes) as unknown)
}

const validateUnsignedPackage = async (options: {
  packageDir: string
  verification: ManagedUnsignedVerificationManifest
  fixturePdfPath: string
  checkOutputDir: string
  forbiddenPaths: string[]
  dependencies: ManagedUnsignedVerificationDependencies
}): Promise<void> => {
  const payload = await readUnsignedPayload(options.packageDir, options.verification)
  const verification = options.verification
  if (payload.tool !== verification.tool || payload.version !== verification.version || payload.revision !== verification.revision || payload.platform !== verification.platform || payload.architecture !== verification.architecture || payload.macosDeploymentTarget !== verification.minimumMacosVersion) throw managedPrebuiltTrustError('unsigned payload identity does not match its verification manifest')
  if (payload.producer.commit !== verification.producerCommit) throw managedPrebuiltTrustError('unsigned producer commit mismatch')
  if (!sameJson(payload.license.reviewReferences, verification.licenseReviewReferences)) throw managedPrebuiltTrustError('unsigned license reviews do not match the verification manifest')
  const expectedSources = await readExpectedManagedArtifactSources(payload.tool)
  if (!sameJson(payload.sources, expectedSources)) throw managedPrebuiltTrustError('unsigned payload source pins do not match dependency metadata')
  if (!sameJson(payload.buildFlags, managedArtifactBuildFlags(payload.tool))) throw managedPrebuiltTrustError('unsigned payload build flags do not match the shared source recipe')
  if (payload.promotable !== false || payload.trust.developerIdSigned !== false || payload.trust.notarized !== false) throw managedPrebuiltTrustError('unsigned payload is not explicitly non-promotable')
  const licenseIssue = validateManagedToolchainDistributionLicense(payload.tool, payload.license)
  if (licenseIssue) throw managedPrebuiltTrustError(licenseIssue)
  const binaryRelativePath = managedArtifactBinaryRelativePath(payload.tool)
  if (payload.payload.length !== 1 || payload.payload[0]?.path !== binaryRelativePath || payload.payload[0]?.kind !== 'executable') throw managedPrebuiltTrustError(`unsigned payload must contain only executable ${binaryRelativePath}`)
  const expectedPaths = [MANAGED_UNSIGNED_PAYLOAD_MANIFEST_NAME, binaryRelativePath, ...payload.license.noticePaths].sort()
  if (new Set(expectedPaths).size !== expectedPaths.length || !sameJson(await collectRegularFiles(options.packageDir), expectedPaths)) throw managedPrebuiltTrustError('unsigned package inventory does not match its payload manifest')
  for (const file of payload.payload) {
    if (await sha256File(join(options.packageDir, file.path)) !== file.sha256) throw managedPrebuiltTrustError(`unsigned payload hash mismatch for ${file.path}`)
  }
  const binaryPath = join(options.packageDir, binaryRelativePath)
  await chmod(binaryPath, 0o755)
  await options.dependencies.verifyArchitecture(binaryPath, payload.architecture)
  await options.dependencies.verifyDeploymentTarget(binaryPath)
  await options.dependencies.verifyUnsignedSignature(binaryPath)
  await options.dependencies.verifyLinkage(binaryPath)
  await options.dependencies.verifyNoLeaks(binaryPath, options.forbiddenPaths)
  await options.dependencies.runFixtureChecks(payload.tool, binaryPath, options.fixturePdfPath, options.checkOutputDir)
}

export const installManagedUnsignedVerificationArtifact = async (options: {
  tool: ManagedArtifactToolId
  architecture: 'arm64' | 'x64'
  artifactsDir: string
  destinationDir: string
  fixturePdfPath: string
  forbiddenPaths?: string[]
  dependencies?: Partial<ManagedUnsignedVerificationDependencies>
}): Promise<ManagedUnsignedVerificationManifest> => {
  const manifestPath = join(options.artifactsDir, managedUnsignedVerificationManifestName(options.tool, options.architecture))
  const verification = parseManagedUnsignedVerificationManifest(JSON.parse(await Bun.file(manifestPath).text()) as unknown)
  if (verification.tool !== options.tool || verification.architecture !== options.architecture || verification.version !== versionByTool(options.tool)) throw managedPrebuiltTrustError('unsigned verification identity does not match the requested tool and architecture')
  if (verification.archive.name !== managedUnsignedVerificationArchiveName(options.tool, options.architecture) || verification.sbom.name !== managedUnsignedVerificationSbomName(options.tool, options.architecture)) throw managedPrebuiltTrustError('unsigned verification artifact name is not canonical')
  const archivePath = join(options.artifactsDir, verification.archive.name)
  const sbomPath = join(options.artifactsDir, verification.sbom.name)
  if (await sha256File(archivePath) !== verification.archive.sha256) throw managedPrebuiltTrustError('unsigned verification archive SHA-256 mismatch')
  if (await sha256File(sbomPath) !== verification.sbom.sha256) throw managedPrebuiltTrustError('unsigned verification SBOM SHA-256 mismatch')
  const workDir = join(dirname(options.destinationDir), `.unsigned-consumer-${options.tool}-${randomUUID()}`)
  const extractionRoot = join(workDir, 'extracted')
  const stagingDir = join(extractionRoot, options.tool)
  const dependencies = { ...defaultUnsignedDependencies, ...options.dependencies }
  try {
    await mkdir(dirname(options.destinationDir), { recursive: true })
    await mkdir(workDir, { recursive: false })
    await dependencies.extractArchive(archivePath, extractionRoot, options.tool)
    if (!await pathExists(stagingDir)) throw managedPrebuiltTrustError(`unsigned archive is missing top-level ${options.tool}`)
    const payload = await readUnsignedPayload(stagingDir, verification)
    validateSpdxDocument(JSON.parse(await Bun.file(sbomPath).text()) as unknown, payload)
    await validateUnsignedPackage({
      packageDir: stagingDir,
      verification,
      fixturePdfPath: options.fixturePdfPath,
      checkOutputDir: join(workDir, 'fixture-checks-staged'),
      forbiddenPaths: options.forbiddenPaths ?? [],
      dependencies
    })
    await promoteManagedToolDirectory({
      stagingDir,
      destinationDir: options.destinationDir,
      validateStaging: async promotedDir => {
        await validateUnsignedPackage({
          packageDir: promotedDir,
          verification,
          fixturePdfPath: options.fixturePdfPath,
          checkOutputDir: join(workDir, 'fixture-checks-promoted'),
          forbiddenPaths: options.forbiddenPaths ?? [],
          dependencies
        })
      }
    })
    const sourceValidation = await validateManagedSourceArtifact(options.tool, { toolDir: options.destinationDir })
    if (sourceValidation.healthy || !sourceValidation.reason.includes('invalid or missing')) throw managedPrebuiltTrustError('unsigned verification install was mistaken for a production managed artifact')
    return verification
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

export const exerciseManagedUnsignedSourceFallback = async (options: {
  tool: ManagedArtifactToolId
  architecture: 'arm64' | 'x64'
  installSource: () => Promise<void>
  warn: (message: string) => void
}): Promise<void> => {
  const result = await installManagedPrebuiltOrSource({
    tool: options.tool,
    platform: 'darwin',
    architecture: options.architecture,
    macosVersion: MANAGED_UNSIGNED_DEPLOYMENT_TARGET,
    resolveCandidate: async () => undefined,
    installPrebuilt: async () => { throw new Error('dormant prebuilt must not run during source fallback verification') },
    installSource: options.installSource,
    warn: options.warn
  })
  if (result !== 'source') throw new Error(`expected independent source fallback, received ${result}`)
}

export const writeManagedUnsignedSha256Sums = async (
  bundles: ManagedUnsignedVerificationBundle[],
  outputPath: string
): Promise<void> => {
  const files: ManagedArtifactPayloadFile[] = bundles.flatMap(bundle => [
    { path: basename(bundle.archivePath), sha256: bundle.archiveSha256 },
    { path: basename(bundle.manifestPath), sha256: bundle.manifestSha256 },
    { path: basename(bundle.sbomPath), sha256: bundle.sbomSha256 }
  ]).sort((left, right) => left.path.localeCompare(right.path))
  await Bun.write(outputPath, `${files.map(file => `${file.sha256}  ${file.path}`).join('\n')}\n`)
}
