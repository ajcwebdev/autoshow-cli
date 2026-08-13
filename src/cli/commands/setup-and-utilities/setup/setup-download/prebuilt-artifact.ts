import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readdir, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { readDependencyVersion } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { pathExists, runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import {
  compareMacosVersions,
  managedArtifactBinaryRelativePath,
  managedArtifactManifestPath,
  MANAGED_ARTIFACT_SCHEMA_VERSION,
  MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME,
  managedPrebuiltPayloadManifestPath,
  parseManagedPrebuiltPayloadManifest,
  parseManagedPrebuiltReleaseManifest,
  promoteManagedToolDirectory,
  sha256Bytes,
  sha256File,
  validateManagedPrebuiltArtifact,
  verifyManagedPrebuiltArchitecture,
  verifyManagedPrebuiltCodeSignature
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import {
  managedToolchainDistributionLicense,
  validateManagedToolchainDistributionLicense
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import type {
  ManagedArtifactPayloadFile,
  ManagedArtifactToolId,
  ManagedPrebuiltArtifactManifest,
  ManagedPrebuiltCandidate,
  ManagedPrebuiltEligibility,
  ManagedPrebuiltFailureKind,
  ManagedPrebuiltInstallResult,
  ManagedPrebuiltPayloadManifest,
  ManagedPrebuiltReleaseManifest,
  RunResult
} from '~/types'
import { makeExecutable } from '~/utils/filesystem'
import { classifyFetchRetry, withRetry } from '~/utils/retries'

const PREBUILT_MINIMUM_MACOS_VERSION = '15.0'
const PREBUILT_PACKAGE_ROOTS: Record<ManagedArtifactToolId, string> = {
  mupdf: 'mupdf',
  qpdf: 'qpdf'
}

export class ManagedPrebuiltInstallError extends Error {
  readonly kind: ManagedPrebuiltFailureKind

  constructor(kind: ManagedPrebuiltFailureKind, message: string, options: { cause?: unknown } = {}) {
    super(message, options.cause instanceof Error ? { cause: options.cause } : undefined)
    this.name = 'ManagedPrebuiltInstallError'
    this.kind = kind
  }
}

export const managedPrebuiltAvailabilityError = (message: string, cause?: unknown): ManagedPrebuiltInstallError =>
  new ManagedPrebuiltInstallError('availability', message, { cause })

export const managedPrebuiltTrustError = (message: string, cause?: unknown): ManagedPrebuiltInstallError =>
  new ManagedPrebuiltInstallError('trust', message, { cause })

export const classifyManagedPrebuiltFailure = (error: unknown): ManagedPrebuiltFailureKind =>
  error instanceof ManagedPrebuiltInstallError ? error.kind : 'trust'

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)

export const resolveManagedPrebuiltEligibility = (options: {
  platform: NodeJS.Platform
  architecture: string
  macosVersion?: string
  overrideSatisfied?: boolean
}): ManagedPrebuiltEligibility => {
  if (options.overrideSatisfied) return { eligible: false, reason: 'explicit binary override is already healthy' }
  if (options.platform !== 'darwin') return { eligible: false, reason: `platform ${options.platform} is not darwin` }
  if (options.architecture !== 'arm64' && options.architecture !== 'x64') return { eligible: false, reason: `architecture ${options.architecture} is unsupported` }
  if (!options.macosVersion) return { eligible: false, reason: 'host macOS version is unavailable' }
  if (compareMacosVersions(options.macosVersion, PREBUILT_MINIMUM_MACOS_VERSION) < 0) return { eligible: false, reason: `macOS ${options.macosVersion} is older than ${PREBUILT_MINIMUM_MACOS_VERSION}` }
  return {
    eligible: true,
    platform: 'darwin',
    architecture: options.architecture,
    macosVersion: options.macosVersion
  }
}

const canonicalReleaseIdentity = (candidate: ManagedPrebuiltCandidate): string =>
  `${candidate.tool}-${candidate.version}-${candidate.revision}-${candidate.platform}-${candidate.architecture}`

const canonicalArchiveName = (candidate: ManagedPrebuiltCandidate): string =>
  `autoshow-${candidate.tool}-${candidate.version}-${candidate.revision}-darwin-${candidate.architecture}.zip`

const parseCandidateRelease = (candidate: ManagedPrebuiltCandidate): ManagedPrebuiltReleaseManifest => {
  if (sha256Bytes(candidate.releaseManifestJson) !== candidate.releaseManifestSha256) throw managedPrebuiltTrustError('release manifest SHA-256 does not match candidate metadata')
  let release: ManagedPrebuiltReleaseManifest
  try {
    release = parseManagedPrebuiltReleaseManifest(JSON.parse(candidate.releaseManifestJson) as unknown)
  } catch (error) {
    throw managedPrebuiltTrustError(`release manifest failed closed-schema validation: ${errorMessage(error)}`, error)
  }
  if (release.identity !== canonicalReleaseIdentity(candidate)) throw managedPrebuiltTrustError('release manifest identity is not canonical')
  if (release.tool !== candidate.tool || release.version !== candidate.version || release.revision !== candidate.revision || release.platform !== candidate.platform || release.architecture !== candidate.architecture || release.minimumMacosVersion !== candidate.minimumMacosVersion) throw managedPrebuiltTrustError('release manifest identity does not match candidate metadata')
  if (release.archive.name !== candidate.archiveName || release.archive.sha256 !== candidate.archiveSha256) throw managedPrebuiltTrustError('release manifest archive does not match candidate metadata')
  if (release.notarization.status !== 'Accepted') throw managedPrebuiltTrustError('release manifest notarization status is not Accepted')
  if (JSON.stringify(release.licenseReviewReferences) !== JSON.stringify(managedToolchainDistributionLicense(candidate.tool).reviewReferences)) throw managedPrebuiltTrustError('release manifest license reviews do not match the approved Phase 5 policy')
  return release
}

export const validateManagedPrebuiltCandidateMetadata = async (
  candidate: ManagedPrebuiltCandidate,
  host: { platform: 'darwin', architecture: 'arm64' | 'x64', macosVersion: string }
): Promise<ManagedPrebuiltReleaseManifest> => {
  const expectedVersion = await readDependencyVersion(candidate.tool)
  if (!expectedVersion || candidate.version !== expectedVersion) throw managedPrebuiltTrustError(`candidate version is ${candidate.version}, expected ${expectedVersion ?? 'a pinned version'}`)
  if (candidate.platform !== host.platform || candidate.architecture !== host.architecture) throw managedPrebuiltTrustError('candidate platform or architecture does not match the eligible host')
  if (candidate.minimumMacosVersion !== PREBUILT_MINIMUM_MACOS_VERSION) throw managedPrebuiltTrustError(`candidate minimum macOS must be ${PREBUILT_MINIMUM_MACOS_VERSION}`)
  if (compareMacosVersions(candidate.minimumMacosVersion, host.macosVersion) > 0) throw managedPrebuiltAvailabilityError(`candidate requires macOS ${candidate.minimumMacosVersion}, host is ${host.macosVersion}`)
  if (candidate.archiveName !== canonicalArchiveName(candidate)) throw managedPrebuiltTrustError('candidate archive name is not canonical')
  let urlName: string
  try {
    urlName = basename(new URL(candidate.url).pathname)
  } catch (error) {
    throw managedPrebuiltTrustError('candidate URL is invalid', error)
  }
  if (urlName !== candidate.archiveName) throw managedPrebuiltTrustError('candidate URL does not name the pinned archive')
  return parseCandidateRelease(candidate)
}

const SAFE_ARCHIVE_PATH = /^[A-Za-z0-9][A-Za-z0-9._+/-]*\/?$/

export const validateManagedPrebuiltArchiveEntries = (entries: string[], packageRoot: string): void => {
  if (entries.length === 0) throw managedPrebuiltTrustError('prebuilt archive is empty')
  const seen = new Set<string>()
  for (const entry of entries) {
    if (!SAFE_ARCHIVE_PATH.test(entry) || entry.includes('\\') || entry.startsWith('/') || entry.includes('//')) throw managedPrebuiltTrustError(`prebuilt archive contains unsafe path ${JSON.stringify(entry)}`)
    const trimmed = entry.endsWith('/') ? entry.slice(0, -1) : entry
    const segments = trimmed.split('/')
    if (segments.some(segment => segment === '.' || segment === '..' || segment.length === 0)) throw managedPrebuiltTrustError(`prebuilt archive contains traversal path ${JSON.stringify(entry)}`)
    if (segments[0] !== packageRoot) throw managedPrebuiltTrustError(`prebuilt archive entry is outside top-level ${packageRoot}: ${entry}`)
    if (seen.has(trimmed)) throw managedPrebuiltTrustError(`prebuilt archive contains duplicate path ${trimmed}`)
    seen.add(trimmed)
  }
}

const splitNonEmptyLines = (value: string): string[] => value.split('\n').map(line => line.trim()).filter(Boolean)

export const extractManagedPrebuiltZip = async (archivePath: string, destination: string, packageRoot: string): Promise<void> => {
  const listing = await runCapture('unzip', ['-Z1', archivePath], { allowFailure: true })
  if (listing.exitCode !== 0) throw managedPrebuiltTrustError(`could not list prebuilt ZIP: ${listing.stderr.trim() || listing.stdout.trim()}`)
  validateManagedPrebuiltArchiveEntries(splitNonEmptyLines(listing.stdout), packageRoot)
  const attributes = await runCapture('unzip', ['-Z', '-l', archivePath], { allowFailure: true })
  if (attributes.exitCode !== 0) throw managedPrebuiltTrustError('could not inspect prebuilt ZIP entry types')
  for (const line of attributes.stdout.split('\n')) {
    const mode = line.trimStart()[0]
    if (mode && ['b', 'c', 'l', 'p', 's'].includes(mode)) throw managedPrebuiltTrustError('prebuilt archive contains a link or special file')
  }
  await mkdir(destination, { recursive: true })
  const extracted = await runCapture('unzip', ['-q', archivePath, '-d', destination], { allowFailure: true })
  if (extracted.exitCode !== 0) throw managedPrebuiltTrustError(`could not extract prebuilt ZIP: ${extracted.stderr.trim() || extracted.stdout.trim()}`)
}

const collectRegularFiles = async (root: string, relativeDir = ''): Promise<string[]> => {
  const directory = relativeDir ? join(root, relativeDir) : root
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
    const entryStat = await lstat(join(root, relativePath))
    if (entryStat.isSymbolicLink()) throw managedPrebuiltTrustError(`prebuilt package contains symbolic link ${relativePath}`)
    if (entryStat.isDirectory()) files.push(...await collectRegularFiles(root, relativePath))
    else if (entryStat.isFile()) files.push(relativePath)
    else throw managedPrebuiltTrustError(`prebuilt package contains unsupported file type ${relativePath}`)
  }
  return files.sort()
}

const samePaths = (left: string[], right: string[]): boolean => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())

const validateExtractedPackage = async (
  toolDir: string,
  candidate: ManagedPrebuiltCandidate,
  release: ManagedPrebuiltReleaseManifest
): Promise<{ payload: ManagedPrebuiltPayloadManifest, packageFiles: ManagedArtifactPayloadFile[] }> => {
  let payloadBytes: string
  let payload: ManagedPrebuiltPayloadManifest
  try {
    payloadBytes = await Bun.file(managedPrebuiltPayloadManifestPath(toolDir)).text()
    if (sha256Bytes(payloadBytes) !== release.payloadManifestSha256) throw managedPrebuiltTrustError('embedded payload manifest SHA-256 does not match the release manifest')
    payload = parseManagedPrebuiltPayloadManifest(JSON.parse(payloadBytes) as unknown)
  } catch (error) {
    if (error instanceof ManagedPrebuiltInstallError) throw error
    throw managedPrebuiltTrustError(`embedded payload manifest failed closed-schema validation: ${errorMessage(error)}`, error)
  }
  if (payload.tool !== candidate.tool || payload.version !== candidate.version || payload.revision !== candidate.revision || payload.platform !== candidate.platform || payload.architecture !== candidate.architecture || payload.macosDeploymentTarget !== candidate.minimumMacosVersion) throw managedPrebuiltTrustError('embedded payload identity does not match candidate metadata')
  if (payload.producer.commit !== release.producerCommit) throw managedPrebuiltTrustError('embedded producer commit does not match release metadata')
  if (payload.trust.signingIdentity !== candidate.expectedSigningIdentity) throw managedPrebuiltTrustError('embedded signing identity does not match candidate metadata')
  if (payload.trust.teamId !== candidate.expectedTeamId) throw managedPrebuiltTrustError('embedded Team ID does not match candidate metadata')
  if (JSON.stringify(payload.license.reviewReferences) !== JSON.stringify(release.licenseReviewReferences)) throw managedPrebuiltTrustError('embedded license reviews do not match release metadata')
  const licenseIssue = validateManagedToolchainDistributionLicense(candidate.tool, payload.license)
  if (licenseIssue) throw managedPrebuiltTrustError(licenseIssue)
  const expectedBinary = managedArtifactBinaryRelativePath(candidate.tool)
  if (payload.payload.length !== 1 || payload.payload[0]?.path !== expectedBinary || payload.payload[0]?.kind !== 'executable') throw managedPrebuiltTrustError(`embedded payload must contain only executable ${expectedBinary}`)
  const expectedFiles = [MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME, ...payload.payload.map(file => file.path), ...payload.license.noticePaths]
  if (new Set(expectedFiles).size !== expectedFiles.length) throw managedPrebuiltTrustError('embedded package file inventory contains duplicates')
  const actualFiles = await collectRegularFiles(toolDir)
  if (!samePaths(actualFiles, expectedFiles)) throw managedPrebuiltTrustError('extracted package file inventory does not match the embedded manifest')
  const packageFiles = await Promise.all(actualFiles.map(async path => ({ path, sha256: await sha256File(join(toolDir, path)) })))
  for (const file of payload.payload) {
    const actual = packageFiles.find(candidateFile => candidateFile.path === file.path)?.sha256
    if (actual !== file.sha256) throw managedPrebuiltTrustError(`payload hash mismatch for ${file.path}`)
  }
  return { payload, packageFiles }
}

const createInstalledManifest = (
  candidate: ManagedPrebuiltCandidate,
  release: ManagedPrebuiltReleaseManifest,
  payload: ManagedPrebuiltPayloadManifest,
  packageFiles: ManagedArtifactPayloadFile[]
): ManagedPrebuiltArtifactManifest => ({
  schemaVersion: MANAGED_ARTIFACT_SCHEMA_VERSION,
  tool: payload.tool,
  version: payload.version,
  distribution: 'prebuilt',
  platform: payload.platform,
  architecture: payload.architecture,
  macosDeploymentTarget: payload.macosDeploymentTarget,
  sources: payload.sources,
  buildFlags: payload.buildFlags,
  producer: payload.producer,
  payload: payload.payload,
  packageFiles,
  release: {
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
  }
})

export type ManagedPrebuiltConsumerDependencies = {
  downloadArchive: (candidate: ManagedPrebuiltCandidate, destination: string) => Promise<void>
  extractArchive: (archivePath: string, destination: string, packageRoot: string) => Promise<void>
  verifyCodeSignature: typeof verifyManagedPrebuiltCodeSignature
  verifyArchitecture: typeof verifyManagedPrebuiltArchitecture
  runBinary: (command: string, args: string[]) => Promise<RunResult>
}

export const defaultManagedPrebuiltConsumerDependencies: ManagedPrebuiltConsumerDependencies = {
  downloadArchive: async (candidate, destination) => {
    const operationName = candidate.tool === 'mupdf' ? 'mupdf-prebuilt' : 'qpdf-prebuilt'
    await withRetry(
      { retryClass: 'setup_download', operationName },
      async () => {
        await downloadFile({
          url: candidate.url,
          sha256: candidate.archiveSha256,
          destination,
          flowId: operationName
        })
      },
      error => errorMessage(error).includes('SHA-256 mismatch')
        ? { shouldRetry: false, delayMs: 0, reason: 'archive checksum mismatch' }
        : classifyFetchRetry(error, 'setup_download')
    )
  },
  extractArchive: extractManagedPrebuiltZip,
  verifyCodeSignature: verifyManagedPrebuiltCodeSignature,
  verifyArchitecture: verifyManagedPrebuiltArchitecture,
  runBinary: async (command, args) => await runCapture(command, args, { allowFailure: true })
}

const assertPrebuiltInstallAt = async (options: {
  tool: ManagedArtifactToolId
  toolDir: string
  candidate: ManagedPrebuiltCandidate
  host: { platform: 'darwin', architecture: 'arm64' | 'x64', macosVersion: string }
  dependencies: ManagedPrebuiltConsumerDependencies
}): Promise<void> => {
  const validation = await validateManagedPrebuiltArtifact(options.tool, {
    toolDir: options.toolDir,
    platform: options.host.platform,
    architecture: options.host.architecture,
    macosVersion: options.host.macosVersion,
    expectedCandidate: options.candidate,
    verifyCodeSignature: options.dependencies.verifyCodeSignature,
    verifyArchitecture: options.dependencies.verifyArchitecture
  })
  if (!validation.healthy) throw managedPrebuiltTrustError(`prebuilt provenance validation failed: ${validation.reason}`)
  const binaryPath = join(options.toolDir, managedArtifactBinaryRelativePath(options.tool))
  const args = options.tool === 'mupdf' ? ['-v'] : ['--version']
  const okExitCodes = options.tool === 'mupdf' ? [0, 1] : [0]
  const result = await options.dependencies.runBinary(binaryPath, args)
  if (!okExitCodes.includes(result.exitCode) || !`${result.stdout}\n${result.stderr}`.includes(options.candidate.version)) throw managedPrebuiltTrustError(`prebuilt ${options.tool} failed its exact ${options.candidate.version} version check`)
}

export const installManagedPrebuiltCandidate = async (options: {
  tool: ManagedArtifactToolId
  candidate: ManagedPrebuiltCandidate
  destinationDir: string
  host: { platform: 'darwin', architecture: 'arm64' | 'x64', macosVersion: string }
  activate?: () => Promise<void>
  rollbackActivation?: (hadPreviousInstall: boolean) => Promise<void>
  dependencies?: Partial<ManagedPrebuiltConsumerDependencies>
}): Promise<void> => {
  const dependencies = { ...defaultManagedPrebuiltConsumerDependencies, ...options.dependencies }
  const release = await validateManagedPrebuiltCandidateMetadata(options.candidate, options.host)
  const workDir = join(dirname(options.destinationDir), `.${basename(options.destinationDir)}.prebuilt-${randomUUID()}`)
  const archivePath = join(workDir, options.candidate.archiveName)
  const extractionRoot = join(workDir, 'extracted')
  const packageRoot = PREBUILT_PACKAGE_ROOTS[options.tool]
  try {
    await mkdir(workDir, { recursive: false })
    try {
      await dependencies.downloadArchive(options.candidate, archivePath)
    } catch (error) {
      if (error instanceof ManagedPrebuiltInstallError) throw error
      const message = errorMessage(error)
      if (message.includes('SHA-256 mismatch')) throw managedPrebuiltTrustError(message, error)
      throw managedPrebuiltAvailabilityError(`prebuilt archive was unavailable after download retries: ${message}`, error)
    }
    if (!await pathExists(archivePath)) throw managedPrebuiltAvailabilityError('prebuilt archive download produced no file')
    if (await sha256File(archivePath) !== options.candidate.archiveSha256) throw managedPrebuiltTrustError('downloaded prebuilt archive SHA-256 does not match candidate metadata')
    try {
      await dependencies.extractArchive(archivePath, extractionRoot, packageRoot)
    } catch (error) {
      if (error instanceof ManagedPrebuiltInstallError) throw error
      throw managedPrebuiltTrustError(`prebuilt archive extraction failed: ${errorMessage(error)}`, error)
    }
    const stagingDir = join(extractionRoot, packageRoot)
    if (!await pathExists(stagingDir)) throw managedPrebuiltTrustError(`prebuilt archive is missing top-level ${packageRoot}`)
    const { payload, packageFiles } = await validateExtractedPackage(stagingDir, options.candidate, release)
    for (const file of payload.payload) {
      await makeExecutable(join(stagingDir, file.path))
      try {
        await dependencies.verifyArchitecture(join(stagingDir, file.path), payload.architecture)
      } catch (error) {
        throw managedPrebuiltTrustError(`architecture verification failed for ${file.path}: ${errorMessage(error)}`, error)
      }
      try {
        await dependencies.verifyCodeSignature(join(stagingDir, file.path), payload.trust)
      } catch (error) {
        throw managedPrebuiltTrustError(`code-signature verification failed for ${file.path}: ${errorMessage(error)}`, error)
      }
    }
    const installedManifest = createInstalledManifest(options.candidate, release, payload, packageFiles)
    await Bun.write(managedArtifactManifestPath(stagingDir), `${JSON.stringify(installedManifest, null, 2)}\n`)
    await promoteManagedToolDirectory({
      stagingDir,
      destinationDir: options.destinationDir,
      validateStaging: async toolDir => {
        await assertPrebuiltInstallAt({
          tool: options.tool,
          toolDir,
          candidate: options.candidate,
          host: options.host,
          dependencies
        })
      },
      ...(options.activate ? { activate: options.activate } : {}),
      ...(options.rollbackActivation ? { rollbackActivation: options.rollbackActivation } : {})
    })
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

export const installManagedPrebuiltOrSource = async (options: {
  tool: ManagedArtifactToolId
  platform: NodeJS.Platform
  architecture: string
  macosVersion?: string
  overrideSatisfied?: boolean
  resolveCandidate: (host: { platform: 'darwin', architecture: 'arm64' | 'x64', macosVersion: string }) => Promise<ManagedPrebuiltCandidate | undefined>
  installPrebuilt: (candidate: ManagedPrebuiltCandidate, host: { platform: 'darwin', architecture: 'arm64' | 'x64', macosVersion: string }) => Promise<void>
  installSource: () => Promise<void>
  warn: (message: string) => void
}): Promise<ManagedPrebuiltInstallResult> => {
  const eligibility = resolveManagedPrebuiltEligibility(options)
  if (!eligibility.eligible) {
    if (options.overrideSatisfied) return 'override'
    options.warn(`Managed ${options.tool} prebuilt is ineligible (${eligibility.reason}); falling back to the pinned source build.`)
    await options.installSource()
    return 'source'
  }
  let candidate: ManagedPrebuiltCandidate | undefined
  try {
    candidate = await options.resolveCandidate(eligibility)
  } catch (error) {
    if (classifyManagedPrebuiltFailure(error) !== 'availability') throw error
    options.warn(`Managed ${options.tool} prebuilt metadata is unavailable (${errorMessage(error)}); falling back to the pinned source build.`)
    await options.installSource()
    return 'source'
  }
  if (!candidate) {
    options.warn(`Managed ${options.tool} has no pinned prebuilt candidate; falling back to the pinned source build.`)
    await options.installSource()
    return 'source'
  }
  if (compareMacosVersions(candidate.minimumMacosVersion, eligibility.macosVersion) > 0) {
    options.warn(`Managed ${options.tool} prebuilt requires macOS ${candidate.minimumMacosVersion}; falling back to the pinned source build.`)
    await options.installSource()
    return 'source'
  }
  try {
    await options.installPrebuilt(candidate, eligibility)
    return 'prebuilt'
  } catch (error) {
    if (classifyManagedPrebuiltFailure(error) !== 'availability') throw error
    options.warn(`Managed ${options.tool} prebuilt is unavailable (${errorMessage(error)}); falling back to the pinned source build.`)
    await options.installSource()
    return 'source'
  }
}
