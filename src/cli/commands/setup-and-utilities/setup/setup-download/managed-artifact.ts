import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import * as v from 'valibot'
import { readDependencyUrlAndSha256, readDependencyVersion } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { CLIUsageError, InfraError, InternalError, ValidationError } from '~/utils/error-handler'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import {
  managedToolchainDistributionLicense,
  validateManagedToolchainDistributionLicense
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import { LIBJPEG_TURBO_SOURCE_BUILD_FLAGS, QPDF_SOURCE_BUILD_FLAGS } from '~/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build'
import { MUPDF_SOURCE_BUILD_FLAGS } from '~/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build'
import type {
  ManagedArtifactManifest,
  ManagedArtifactSource,
  ManagedArtifactToolId,
  ManagedArtifactValidation,
  ManagedPrebuiltArtifactManifest,
  ManagedPrebuiltCandidate,
  ManagedPrebuiltPayloadManifest,
  ManagedPrebuiltReleaseManifest,
  ManagedSourceArtifactManifest,
  ManagedSourceArtifactValidation,
  ManagedSourceRecipe
} from '~/types'
import { pathExists } from '~/utils/filesystem'
import { mupdfToolDir, qpdfToolDir } from '~/utils/runtime-paths'
import { sha256Bytes } from '~/utils/value-helpers'

export const MANAGED_ARTIFACT_MANIFEST_NAME = '.autoshow-managed-artifact.json'
export const MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME = '.autoshow-payload-manifest.json'
export const MANAGED_ARTIFACT_SCHEMA_VERSION = 1

const Sha256Schema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const MacosVersionSchema = v.pipe(v.string(), v.regex(/^\d+(?:\.\d+){1,2}$/))
const RevisionSchema = v.pipe(v.string(), v.regex(/^r[1-9]\d*$/))
const SafeRelativePathSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z0-9._+][A-Za-z0-9._+/-]*$/),
  v.regex(/^(?!.*(?:^|\/)\.{1,2}(?:\/|$)).+$/)
)
const SafeFileNameSchema = v.pipe(v.string(), v.regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/))
const NonEmptyStringSchema = v.pipe(v.string(), v.minLength(1))

const ArtifactSourceSchema = v.strictObject({
  name: NonEmptyStringSchema,
  version: NonEmptyStringSchema,
  url: NonEmptyStringSchema,
  sha256: Sha256Schema
})

const ArtifactPayloadFileSchema = v.strictObject({
  path: SafeRelativePathSchema,
  sha256: Sha256Schema
})

const PrebuiltPayloadFileSchema = v.strictObject({
  path: SafeRelativePathSchema,
  sha256: Sha256Schema,
  kind: v.picklist(['executable', 'library'])
})

const PrebuiltProducerSchema = v.strictObject({
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

const PrebuiltLicenseSchema = v.strictObject({
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

export const ManagedSourceArtifactManifestSchema = v.strictObject({
  schemaVersion: v.literal(MANAGED_ARTIFACT_SCHEMA_VERSION),
  tool: v.picklist(['mupdf', 'qpdf']),
  version: NonEmptyStringSchema,
  distribution: v.literal('source'),
  platform: v.literal('darwin'),
  architecture: NonEmptyStringSchema,
  macosDeploymentTarget: MacosVersionSchema,
  sources: v.array(ArtifactSourceSchema),
  buildFlags: v.array(NonEmptyStringSchema),
  payload: v.array(ArtifactPayloadFileSchema)
})

export const ManagedPrebuiltPayloadManifestSchema = v.strictObject({
  schemaVersion: v.literal(MANAGED_ARTIFACT_SCHEMA_VERSION),
  tool: v.picklist(['mupdf', 'qpdf']),
  version: NonEmptyStringSchema,
  revision: RevisionSchema,
  platform: v.literal('darwin'),
  architecture: v.picklist(['arm64', 'x64']),
  macosDeploymentTarget: MacosVersionSchema,
  sources: v.array(ArtifactSourceSchema),
  buildFlags: v.array(NonEmptyStringSchema),
  producer: PrebuiltProducerSchema,
  payload: v.array(PrebuiltPayloadFileSchema),
  trust: v.strictObject({
    signingIdentity: NonEmptyStringSchema,
    teamId: v.pipe(v.string(), v.regex(/^[A-Z0-9]{10}$/))
  }),
  license: PrebuiltLicenseSchema
})

export const ManagedPrebuiltReleaseManifestSchema = v.strictObject({
  schemaVersion: v.literal(MANAGED_ARTIFACT_SCHEMA_VERSION),
  identity: NonEmptyStringSchema,
  tool: v.picklist(['mupdf', 'qpdf']),
  version: NonEmptyStringSchema,
  revision: RevisionSchema,
  platform: v.literal('darwin'),
  architecture: v.picklist(['arm64', 'x64']),
  minimumMacosVersion: MacosVersionSchema,
  producerCommit: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/)),
  archive: v.strictObject({
    name: SafeFileNameSchema,
    sha256: Sha256Schema
  }),
  payloadManifestSha256: Sha256Schema,
  notarization: v.strictObject({
    submissionId: NonEmptyStringSchema,
    status: v.literal('Accepted')
  }),
  sbom: v.strictObject({
    name: SafeFileNameSchema,
    sha256: Sha256Schema
  }),
  provenance: v.strictObject({
    repository: v.literal('ajcwebdev/autoshow-cli'),
    subjectDigest: Sha256Schema
  }),
  licenseReviewReferences: v.array(NonEmptyStringSchema)
})

export const ManagedPrebuiltArtifactManifestSchema = v.strictObject({
  schemaVersion: v.literal(MANAGED_ARTIFACT_SCHEMA_VERSION),
  tool: v.picklist(['mupdf', 'qpdf']),
  version: NonEmptyStringSchema,
  distribution: v.literal('prebuilt'),
  platform: v.literal('darwin'),
  architecture: v.picklist(['arm64', 'x64']),
  macosDeploymentTarget: MacosVersionSchema,
  sources: v.array(ArtifactSourceSchema),
  buildFlags: v.array(NonEmptyStringSchema),
  producer: PrebuiltProducerSchema,
  payload: v.array(PrebuiltPayloadFileSchema),
  packageFiles: v.array(ArtifactPayloadFileSchema),
  release: v.strictObject({
    revision: RevisionSchema,
    url: NonEmptyStringSchema,
    archiveName: SafeFileNameSchema,
    archiveSha256: Sha256Schema,
    releaseManifestIdentity: NonEmptyStringSchema,
    releaseManifestSha256: Sha256Schema,
    payloadManifestSha256: Sha256Schema,
    signingIdentity: NonEmptyStringSchema,
    teamId: v.pipe(v.string(), v.regex(/^[A-Z0-9]{10}$/)),
    notarizationSubmissionId: NonEmptyStringSchema,
    notarizationStatus: v.literal('Accepted'),
    sbomName: SafeFileNameSchema,
    sbomSha256: Sha256Schema,
    provenanceSubjectDigest: Sha256Schema,
    producerCommit: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/)),
    licenseReviewReferences: v.array(NonEmptyStringSchema)
  })
})

export const ManagedArtifactManifestSchema = v.union([
  ManagedSourceArtifactManifestSchema,
  ManagedPrebuiltArtifactManifestSchema
])

const SOURCE_RECIPES: Record<ManagedArtifactToolId, ManagedSourceRecipe> = {
  mupdf: {
    binaryRelativePath: 'bin/mutool',
    sourceNames: ['mupdf'],
    buildFlags: MUPDF_SOURCE_BUILD_FLAGS
  },
  qpdf: {
    binaryRelativePath: 'bin/qpdf',
    sourceNames: ['qpdf', 'libjpeg-turbo'],
    buildFlags: [...LIBJPEG_TURBO_SOURCE_BUILD_FLAGS, ...QPDF_SOURCE_BUILD_FLAGS]
  }
}

const MANAGED_TOOL_DIRS: Record<ManagedArtifactToolId, string> = {
  mupdf: mupdfToolDir,
  qpdf: qpdfToolDir
}

export const managedArtifactManifestPath = (toolDir: string): string =>
  join(toolDir, MANAGED_ARTIFACT_MANIFEST_NAME)

export const managedPrebuiltPayloadManifestPath = (toolDir: string): string =>
  join(toolDir, MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME)

const parseSchema = <T>(schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>, value: unknown, label: string): T => {
  const result = v.safeParse(schema, value)
  if (!result.success) {
    throw ValidationError(`Invalid ${label}`, { stage: 'setup:managed-artifact', retryable: false })
  }
  return result.output
}

export const parseManagedSourceArtifactManifest = (value: unknown): ManagedSourceArtifactManifest =>
  parseSchema(ManagedSourceArtifactManifestSchema, value, 'managed source artifact manifest')

export const parseManagedPrebuiltPayloadManifest = (value: unknown): ManagedPrebuiltPayloadManifest =>
  parseSchema(ManagedPrebuiltPayloadManifestSchema, value, 'managed prebuilt payload manifest')

export const parseManagedPrebuiltReleaseManifest = (value: unknown): ManagedPrebuiltReleaseManifest =>
  parseSchema(ManagedPrebuiltReleaseManifestSchema, value, 'managed prebuilt release manifest')

export const parseManagedPrebuiltArtifactManifest = (value: unknown): ManagedPrebuiltArtifactManifest =>
  parseSchema(ManagedPrebuiltArtifactManifestSchema, value, 'managed prebuilt artifact manifest')

export const parseManagedArtifactManifest = (value: unknown): ManagedArtifactManifest =>
  parseSchema(ManagedArtifactManifestSchema, value, 'managed artifact manifest')

export const sha256File = async (path: string): Promise<string> =>
  sha256Bytes(await readFile(path))

const normalizeMacosVersion = (value: string): string | undefined => {
  const match = value.trim().match(/^(\d+)\.(\d+)(?:\.\d+)?$/)
  return match ? `${Number(match[1])}.${Number(match[2])}` : undefined
}

export const compareMacosVersions = (left: string, right: string): number => {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export const resolveHostMacosVersion = async (): Promise<string> => {
  const result = await runCapture('sw_vers', ['-productVersion'], { allowFailure: true })
  const version = result.exitCode === 0 ? normalizeMacosVersion(result.stdout) : undefined
  if (!version) throw InfraError('could not determine the host macOS version with sw_vers', { stage: 'setup:managed-artifact' })
  return version
}

export const resolveSourceDeploymentTarget = async (): Promise<string> => {
  const configured = process.env['MACOSX_DEPLOYMENT_TARGET']
  if (configured) {
    const version = normalizeMacosVersion(configured)
    if (!version) {
      throw CLIUsageError(`Invalid MACOSX_DEPLOYMENT_TARGET: ${configured}`, 'Use a MAJOR.MINOR macOS version, for example 15.0.')
    }
    return version
  }
  const hostVersion = await resolveHostMacosVersion()
  return `${hostVersion.split('.')[0]}.0`
}

export const managedArtifactBinaryRelativePath = (tool: ManagedArtifactToolId): string =>
  SOURCE_RECIPES[tool].binaryRelativePath

export const managedArtifactBuildFlags = (tool: ManagedArtifactToolId): string[] =>
  [...SOURCE_RECIPES[tool].buildFlags]

export const readExpectedManagedArtifactSources = async (tool: ManagedArtifactToolId): Promise<ManagedArtifactSource[]> =>
  await Promise.all(SOURCE_RECIPES[tool].sourceNames.map(async (name) => {
    const version = await readDependencyVersion(name)
    if (!version) {
      throw InternalError(`Missing version for managed source dependency ${name}`, { stage: 'setup:managed-artifact', retryable: false })
    }
    const { url, sha256 } = await readDependencyUrlAndSha256(name)
    return { name, version, url, sha256 }
  }))

export const createManagedSourceArtifactManifest = async (options: {
  tool: ManagedArtifactToolId
  toolDir: string
  deploymentTarget: string
  platform?: NodeJS.Platform
  architecture?: string
}): Promise<ManagedSourceArtifactManifest> => {
  const recipe = SOURCE_RECIPES[options.tool]
  const platform = options.platform ?? process.platform
  if (platform !== 'darwin') {
    throw InfraError(`Managed source artifacts require darwin, received ${platform}`, { stage: 'setup:managed-artifact', retryable: false })
  }
  const binaryPath = join(options.toolDir, recipe.binaryRelativePath)
  return {
    schemaVersion: MANAGED_ARTIFACT_SCHEMA_VERSION,
    tool: options.tool,
    version: (await readDependencyVersion(options.tool)) ?? 'unknown',
    distribution: 'source',
    platform,
    architecture: options.architecture ?? process.arch,
    macosDeploymentTarget: options.deploymentTarget,
    sources: await readExpectedManagedArtifactSources(options.tool),
    buildFlags: managedArtifactBuildFlags(options.tool),
    payload: [{ path: recipe.binaryRelativePath, sha256: await sha256File(binaryPath) }]
  }
}

export const writeManagedSourceArtifactManifest = async (options: {
  tool: ManagedArtifactToolId
  toolDir: string
  deploymentTarget: string
}): Promise<ManagedSourceArtifactManifest> => {
  const manifest = await createManagedSourceArtifactManifest(options)
  await Bun.write(managedArtifactManifestPath(options.toolDir), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)
const validationFailure = (reason: string): { healthy: false, reason: string } => ({ healthy: false, reason })

const readInstalledManifest = async (toolDir: string): Promise<ManagedArtifactManifest> => {
  const raw = JSON.parse(await Bun.file(managedArtifactManifestPath(toolDir)).text()) as unknown
  return parseManagedArtifactManifest(raw)
}

const resolveValidationHostVersion = async (value: string | undefined): Promise<string> =>
  value ?? await resolveHostMacosVersion()

const validateCommonIdentity = async (
  tool: ManagedArtifactToolId,
  manifest: ManagedArtifactManifest,
  options: { platform?: NodeJS.Platform, architecture?: string, macosVersion?: string }
): Promise<string | undefined> => {
  const platform = options.platform ?? process.platform
  const architecture = options.architecture ?? process.arch
  if (manifest.tool !== tool) return `manifest tool is ${manifest.tool}, expected ${tool}`
  if (manifest.platform !== platform) return `manifest platform is ${manifest.platform}, current platform is ${platform}`
  if (manifest.architecture !== architecture) return `manifest architecture is ${manifest.architecture}, current architecture is ${architecture}`
  const expectedVersion = await readDependencyVersion(tool)
  if (!expectedVersion || manifest.version !== expectedVersion) {
    return `manifest version is ${manifest.version}, expected ${expectedVersion ?? 'a pinned version'}`
  }
  if (platform === 'darwin') {
    const hostVersion = await resolveValidationHostVersion(options.macosVersion)
    if (compareMacosVersions(manifest.macosDeploymentTarget, hostVersion) > 0) {
      return `manifest deployment target ${manifest.macosDeploymentTarget} exceeds host macOS ${hostVersion}`
    }
  }
  return undefined
}

const validateManagedSourceManifest = async (
  tool: ManagedArtifactToolId,
  toolDir: string,
  manifest: ManagedSourceArtifactManifest,
  options: { platform?: NodeJS.Platform, architecture?: string, macosVersion?: string }
): Promise<ManagedSourceArtifactValidation> => {
  try {
    const identityIssue = await validateCommonIdentity(tool, manifest, options)
    if (identityIssue) return validationFailure(identityIssue)
  } catch (error) {
    return validationFailure(error instanceof Error ? error.message : String(error))
  }
  const expectedSources = await readExpectedManagedArtifactSources(tool)
  if (!sameJson(manifest.sources, expectedSources)) return validationFailure('manifest source pins do not match dependency metadata')
  if (!sameJson(manifest.buildFlags, managedArtifactBuildFlags(tool))) return validationFailure('manifest build flags do not match the source recipe')
  const expectedPayloadPath = managedArtifactBinaryRelativePath(tool)
  if (manifest.payload.length !== 1 || manifest.payload[0]?.path !== expectedPayloadPath) {
    return validationFailure(`manifest payload must contain only ${expectedPayloadPath}`)
  }
  try {
    const actualSha256 = await sha256File(join(toolDir, expectedPayloadPath))
    if (actualSha256 !== manifest.payload[0].sha256) return validationFailure(`payload hash mismatch for ${expectedPayloadPath}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return validationFailure(`could not hash payload ${expectedPayloadPath}: ${message}`)
  }
  return {
    healthy: true,
    distribution: 'source',
    version: manifest.version,
    platform: manifest.platform,
    architecture: manifest.architecture
  }
}

export const verifyManagedPrebuiltCodeSignature = async (
  binaryPath: string,
  expected: { signingIdentity: string, teamId: string }
): Promise<void> => {
  const verification = await runCapture('codesign', ['--verify', '--strict', '--verbose=2', binaryPath], { allowFailure: true })
  if (verification.exitCode !== 0) {
    throw InfraError(`strict code-signature verification failed for ${binaryPath}`, { stage: 'setup:managed-artifact', retryable: false })
  }
  const details = await runCapture('codesign', ['-d', '--verbose=4', binaryPath], { allowFailure: true })
  const output = `${details.stdout}\n${details.stderr}`
  if (details.exitCode !== 0) {
    throw InfraError(`could not inspect code signature for ${binaryPath}`, { stage: 'setup:managed-artifact' })
  }
  if (!output.split('\n').some(line => line.trim() === `TeamIdentifier=${expected.teamId}`)) {
    throw InfraError(`code-signature Team ID mismatch for ${binaryPath}`, { stage: 'setup:managed-artifact', retryable: false })
  }
  if (!output.split('\n').some(line => line.trim() === `Authority=${expected.signingIdentity}`)) {
    throw InfraError(`code-signature identity mismatch for ${binaryPath}`, { stage: 'setup:managed-artifact', retryable: false })
  }
}

export const verifyManagedPrebuiltArchitecture = async (
  binaryPath: string,
  expectedArchitecture: 'arm64' | 'x64'
): Promise<void> => {
  const inspected = await runCapture('lipo', ['-archs', binaryPath], { allowFailure: true })
  if (inspected.exitCode !== 0) {
    throw InfraError(`could not inspect Mach-O architecture for ${binaryPath}`, { stage: 'setup:managed-artifact' })
  }
  const architectures = inspected.stdout.trim().split(/\s+/).filter(Boolean)
  const expected = expectedArchitecture === 'x64' ? 'x86_64' : 'arm64'
  if (architectures.length !== 1 || architectures[0] !== expected) {
    throw InfraError(`Mach-O architecture mismatch for ${binaryPath}: expected thin ${expected}, got ${architectures.join(' ') || 'unknown'}`, { stage: 'setup:managed-artifact', retryable: false })
  }
}

const listRegularPackageFiles = async (toolDir: string, relativeDir = ''): Promise<string[]> => {
  const directory = relativeDir ? join(toolDir, relativeDir) : toolDir
  const entries = await readdir(directory, { withFileTypes: true })
  const paths: string[] = []
  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
    if (relativePath === MANAGED_ARTIFACT_MANIFEST_NAME) continue
    const entryStat = await lstat(join(toolDir, relativePath))
    if (entryStat.isSymbolicLink()) {
      throw ValidationError(`package contains symbolic link ${relativePath}`, { stage: 'setup:managed-artifact', retryable: false })
    }
    if (entryStat.isDirectory()) paths.push(...await listRegularPackageFiles(toolDir, relativePath))
    else if (entryStat.isFile()) paths.push(relativePath)
    else throw ValidationError(`package contains unsupported file type ${relativePath}`, { stage: 'setup:managed-artifact', retryable: false })
  }
  return paths.sort()
}

const readCandidateReleaseManifest = (candidate: ManagedPrebuiltCandidate): ManagedPrebuiltReleaseManifest => {
  if (sha256Bytes(candidate.releaseManifestJson) !== candidate.releaseManifestSha256) {
    throw ValidationError('release manifest SHA-256 does not match candidate metadata', { stage: 'setup:managed-artifact', retryable: false })
  }
  return parseManagedPrebuiltReleaseManifest(JSON.parse(candidate.releaseManifestJson) as unknown)
}

const expectedReleaseIdentity = (candidate: ManagedPrebuiltCandidate): string =>
  `${candidate.tool}-${candidate.version}-${candidate.revision}-${candidate.platform}-${candidate.architecture}`

const validateCandidateRelease = (
  candidate: ManagedPrebuiltCandidate,
  release: ManagedPrebuiltReleaseManifest
): string | undefined => {
  if (candidate.tool !== release.tool || candidate.version !== release.version || candidate.revision !== release.revision || candidate.platform !== release.platform || candidate.architecture !== release.architecture || candidate.minimumMacosVersion !== release.minimumMacosVersion) return 'release manifest identity does not match candidate metadata'
  if (release.identity !== expectedReleaseIdentity(candidate)) return 'release manifest identity is not canonical'
  if (candidate.archiveName !== release.archive.name || candidate.archiveSha256 !== release.archive.sha256) return 'release manifest archive does not match candidate metadata'
  if (release.notarization.status !== 'Accepted') return 'release manifest notarization status is not Accepted'
  if (!sameJson(release.licenseReviewReferences, managedToolchainDistributionLicense(candidate.tool).reviewReferences)) return 'release manifest license reviews do not match the approved Phase 5 policy'
  return undefined
}

const validatePayloadManifestAgainstCandidate = async (
  tool: ManagedArtifactToolId,
  payload: ManagedPrebuiltPayloadManifest,
  candidate: ManagedPrebuiltCandidate,
  release: ManagedPrebuiltReleaseManifest
): Promise<string | undefined> => {
  if (payload.tool !== candidate.tool || payload.version !== candidate.version || payload.revision !== candidate.revision || payload.platform !== candidate.platform || payload.architecture !== candidate.architecture || payload.macosDeploymentTarget !== candidate.minimumMacosVersion) return 'payload manifest identity does not match candidate metadata'
  if (payload.producer.commit !== release.producerCommit) return 'payload producer commit does not match the release manifest'
  if (payload.trust.signingIdentity !== candidate.expectedSigningIdentity) return 'payload signing identity does not match candidate metadata'
  if (payload.trust.teamId !== candidate.expectedTeamId) return 'payload Team ID does not match candidate metadata'
  if (!sameJson(payload.license.reviewReferences, release.licenseReviewReferences)) return 'payload license reviews do not match the release manifest'
  const licenseIssue = validateManagedToolchainDistributionLicense(tool, payload.license)
  if (licenseIssue) return licenseIssue
  if (!sameJson(payload.sources, await readExpectedManagedArtifactSources(tool))) return 'payload source pins do not match dependency metadata'
  if (!sameJson(payload.buildFlags, managedArtifactBuildFlags(tool))) return 'payload build flags do not match the source recipe'
  const expectedBinary = managedArtifactBinaryRelativePath(tool)
  if (payload.payload.length !== 1 || payload.payload[0]?.path !== expectedBinary || payload.payload[0]?.kind !== 'executable') return `payload manifest must contain only executable ${expectedBinary}`
  return undefined
}

export const validateManagedPrebuiltArtifact = async (
  tool: ManagedArtifactToolId,
  options: {
    toolDir?: string
    platform?: NodeJS.Platform
    architecture?: string
    macosVersion?: string
    expectedCandidate?: ManagedPrebuiltCandidate
    verifyCodeSignature?: typeof verifyManagedPrebuiltCodeSignature
    verifyArchitecture?: typeof verifyManagedPrebuiltArchitecture
  } = {}
): Promise<ManagedArtifactValidation> => {
  const toolDir = options.toolDir ?? MANAGED_TOOL_DIRS[tool]
  const candidate = options.expectedCandidate
  if (!candidate) return validationFailure('no pinned prebuilt candidate metadata is configured')
  let manifest: ManagedPrebuiltArtifactManifest
  let release: ManagedPrebuiltReleaseManifest
  let payload: ManagedPrebuiltPayloadManifest
  try {
    const installed = await readInstalledManifest(toolDir)
    if (installed.distribution !== 'prebuilt') return validationFailure(`manifest distribution is ${installed.distribution}, expected prebuilt`)
    manifest = installed
    release = readCandidateReleaseManifest(candidate)
    const releaseIssue = validateCandidateRelease(candidate, release)
    if (releaseIssue) return validationFailure(releaseIssue)
    const payloadManifestBytes = await Bun.file(managedPrebuiltPayloadManifestPath(toolDir)).text()
    if (sha256Bytes(payloadManifestBytes) !== release.payloadManifestSha256) return validationFailure('embedded payload manifest SHA-256 does not match the release manifest')
    payload = parseManagedPrebuiltPayloadManifest(JSON.parse(payloadManifestBytes) as unknown)
  } catch (error) {
    return validationFailure(error instanceof Error ? error.message : String(error))
  }
  try {
    const identityIssue = await validateCommonIdentity(tool, manifest, options)
    if (identityIssue) return validationFailure(identityIssue)
  } catch (error) {
    return validationFailure(error instanceof Error ? error.message : String(error))
  }
  const payloadIssue = await validatePayloadManifestAgainstCandidate(tool, payload, candidate, release)
  if (payloadIssue) return validationFailure(payloadIssue)
  if (manifest.macosDeploymentTarget !== payload.macosDeploymentTarget || !sameJson(manifest.sources, payload.sources) || !sameJson(manifest.buildFlags, payload.buildFlags) || !sameJson(manifest.producer, payload.producer) || !sameJson(manifest.payload, payload.payload)) return validationFailure('installed manifest does not match the embedded payload manifest')
  const expectedRelease = {
    revision: candidate.revision,
    url: candidate.url,
    archiveName: candidate.archiveName,
    archiveSha256: candidate.archiveSha256,
    releaseManifestIdentity: release.identity,
    releaseManifestSha256: candidate.releaseManifestSha256,
    payloadManifestSha256: release.payloadManifestSha256,
    signingIdentity: candidate.expectedSigningIdentity,
    teamId: candidate.expectedTeamId,
    notarizationSubmissionId: release.notarization.submissionId,
    notarizationStatus: release.notarization.status,
    sbomName: release.sbom.name,
    sbomSha256: release.sbom.sha256,
    provenanceSubjectDigest: release.provenance.subjectDigest,
    producerCommit: release.producerCommit,
    licenseReviewReferences: release.licenseReviewReferences
  } satisfies ManagedPrebuiltArtifactManifest['release']
  if (!sameJson(manifest.release, expectedRelease)) return validationFailure('installed release provenance does not match candidate metadata')
  let actualPaths: string[]
  try {
    actualPaths = await listRegularPackageFiles(toolDir)
  } catch (error) {
    return validationFailure(error instanceof Error ? error.message : String(error))
  }
  const expectedPaths = manifest.packageFiles.map(file => file.path).sort()
  if (new Set(expectedPaths).size !== expectedPaths.length || !sameJson(actualPaths, expectedPaths)) return validationFailure('installed package file inventory does not match the manifest')
  const embeddedExpectedPaths = [MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME, ...payload.payload.map(file => file.path), ...payload.license.noticePaths].sort()
  if (new Set(embeddedExpectedPaths).size !== embeddedExpectedPaths.length || !sameJson(expectedPaths, embeddedExpectedPaths)) return validationFailure('installed package inventory does not match the embedded manifest')
  try {
    for (const file of manifest.packageFiles) {
      if (await sha256File(join(toolDir, file.path)) !== file.sha256) return validationFailure(`package file hash mismatch for ${file.path}`)
    }
    const verifySignature = options.verifyCodeSignature ?? verifyManagedPrebuiltCodeSignature
    const verifyArchitecture = options.verifyArchitecture ?? verifyManagedPrebuiltArchitecture
    for (const file of payload.payload) {
      await verifyArchitecture(join(toolDir, file.path), manifest.architecture)
      await verifySignature(join(toolDir, file.path), payload.trust)
    }
  } catch (error) {
    return validationFailure(error instanceof Error ? error.message : String(error))
  }
  return {
    healthy: true,
    distribution: 'prebuilt',
    version: manifest.version,
    revision: manifest.release.revision,
    platform: manifest.platform,
    architecture: manifest.architecture
  }
}

export const validateManagedSourceArtifact = async (
  tool: ManagedArtifactToolId,
  options: { toolDir?: string, platform?: NodeJS.Platform, architecture?: string, macosVersion?: string } = {}
): Promise<ManagedSourceArtifactValidation> => {
  const toolDir = options.toolDir ?? MANAGED_TOOL_DIRS[tool]
  try {
    const manifest = await readInstalledManifest(toolDir)
    if (manifest.distribution !== 'source') return validationFailure(`manifest distribution is ${manifest.distribution}, expected source`)
    return await validateManagedSourceManifest(tool, toolDir, manifest, options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return validationFailure(`invalid or missing ${MANAGED_ARTIFACT_MANIFEST_NAME}: ${message}`)
  }
}

export const validateManagedArtifact = async (
  tool: ManagedArtifactToolId,
  options: {
    toolDir?: string
    platform?: NodeJS.Platform
    architecture?: string
    macosVersion?: string
    expectedPrebuiltCandidate?: ManagedPrebuiltCandidate
    verifyCodeSignature?: typeof verifyManagedPrebuiltCodeSignature
    verifyArchitecture?: typeof verifyManagedPrebuiltArchitecture
  } = {}
): Promise<ManagedArtifactValidation> => {
  const toolDir = options.toolDir ?? MANAGED_TOOL_DIRS[tool]
  let manifest: ManagedArtifactManifest
  try {
    manifest = await readInstalledManifest(toolDir)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return validationFailure(`invalid or missing ${MANAGED_ARTIFACT_MANIFEST_NAME}: ${message}`)
  }
  if (manifest.distribution === 'source') return await validateManagedSourceManifest(tool, toolDir, manifest, options)
  return await validateManagedPrebuiltArtifact(tool, {
    ...options,
    toolDir,
    ...(options.expectedPrebuiltCandidate ? { expectedCandidate: options.expectedPrebuiltCandidate } : {})
  })
}

export const createManagedToolStagingDirectory = async (toolDir: string): Promise<string> => {
  const stagingDir = join(dirname(toolDir), `.${basename(toolDir)}.staging-${randomUUID()}`)
  await mkdir(stagingDir, { recursive: false })
  return stagingDir
}

export const promoteManagedToolDirectory = async (options: {
  stagingDir: string
  destinationDir: string
  validateStaging: (path: string) => Promise<void>
  activate?: () => Promise<void>
  rollbackActivation?: (hadPreviousInstall: boolean) => Promise<void>
}): Promise<void> => {
  const backupDir = `${options.destinationDir}.backup-${randomUUID()}`
  const hadPreviousInstall = await pathExists(options.destinationDir)
  let previousMoved = false
  let stagingPromoted = false

  try {
    await options.validateStaging(options.stagingDir)
    if (hadPreviousInstall) {
      await rename(options.destinationDir, backupDir)
      previousMoved = true
    }
    await rename(options.stagingDir, options.destinationDir)
    stagingPromoted = true
    await options.activate?.()
    await options.validateStaging(options.destinationDir)
  } catch (error) {
    if (stagingPromoted) await rm(options.destinationDir, { recursive: true, force: true })
    if (previousMoved) await rename(backupDir, options.destinationDir)
    await options.rollbackActivation?.(hadPreviousInstall)
    throw error
  } finally {
    await rm(options.stagingDir, { recursive: true, force: true })
  }

  if (previousMoved) await rm(backupDir, { recursive: true, force: true })
}
