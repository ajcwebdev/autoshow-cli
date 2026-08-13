import { randomUUID } from 'node:crypto'
import { chmod, cp, mkdir, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { readDependencyVersion } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import {
  managedArtifactBinaryRelativePath,
  managedArtifactBuildFlags,
  MANAGED_ARTIFACT_SCHEMA_VERSION,
  MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME,
  parseManagedPrebuiltPayloadManifest,
  parseManagedPrebuiltReleaseManifest,
  readExpectedManagedArtifactSources,
  sha256Bytes,
  sha256File,
  verifyManagedPrebuiltCodeSignature
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import {
  managedToolchainDistributionLicense,
  validateManagedToolchainDistributionLicense
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import {
  createManagedToolchainSpdx,
  type ManagedToolchainSourceDirectories,
  writeManagedToolchainPackageNotices
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-package'
import { managedPrebuiltTrustError } from '~/cli/commands/setup-and-utilities/setup/setup-download/prebuilt-artifact'
import type {
  ManagedArtifactToolId,
  ManagedPrebuiltPayloadManifest,
  ManagedPrebuiltProducer,
  ManagedPrebuiltReleaseManifest
} from '~/types'

export const MANAGED_SIGNED_REVISION = 'r1'
export const MANAGED_SIGNED_DEPLOYMENT_TARGET = '15.0'

const VERSION_BY_TOOL: Record<ManagedArtifactToolId, string> = {
  mupdf: '1.27.2',
  qpdf: '12.3.2'
}

export type ManagedNotarizationResult = {
  submissionId: string
  status: 'Accepted'
  log: unknown
}

export type ManagedSignedCandidateBundle = {
  archivePath: string
  releaseManifestPath: string
  sbomPath: string
  notarizationLogPath: string
  archiveSha256: string
  releaseManifestSha256: string
  sbomSha256: string
}

export const managedSignedBaseName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `autoshow-${tool}-${VERSION_BY_TOOL[tool]}-${MANAGED_SIGNED_REVISION}-darwin-${architecture}`

export const managedSignedArchiveName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `${managedSignedBaseName(tool, architecture)}.zip`

export const managedSignedReleaseManifestName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `${managedSignedBaseName(tool, architecture)}.release.json`

export const managedSignedSbomName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `${managedSignedBaseName(tool, architecture)}.spdx.json`

export const managedSignedNotarizationLogName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `${managedSignedBaseName(tool, architecture)}.notarization.json`

export const managedSignedProvenanceBundleName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `${managedSignedBaseName(tool, architecture)}.provenance.intoto.jsonl`

export const managedSignedSbomAttestationBundleName = (
  tool: ManagedArtifactToolId,
  architecture: 'arm64' | 'x64'
): string => `${managedSignedBaseName(tool, architecture)}.sbom.intoto.jsonl`

export const managedToolchainReleaseTag = (tool: ManagedArtifactToolId): string =>
  `toolchain-${tool}-${VERSION_BY_TOOL[tool]}-${MANAGED_SIGNED_REVISION}`

export const assertManagedProtectedReleaseInputs = async (options: {
  ref: string
  defaultBranch: string
  checkedOutCommit: string
  dispatchCommit: string
  requestedCommit: string
  revision: string
  mupdfVersion: string
  qpdfVersion: string
}): Promise<void> => {
  const expectedRef = `refs/heads/${options.defaultBranch}`
  if (options.ref !== expectedRef) throw new Error(`protected toolchain release must run from ${expectedRef}`)
  if (!/^[a-f0-9]{40}$/.test(options.requestedCommit) || options.requestedCommit !== options.checkedOutCommit || options.requestedCommit !== options.dispatchCommit) throw new Error('requested producer commit must be the exact workflow-dispatch and checked-out default-branch commit')
  if (options.revision !== MANAGED_SIGNED_REVISION) throw new Error(`release revision must be ${MANAGED_SIGNED_REVISION}`)
  const expectedMupdf = await readDependencyVersion('mupdf')
  const expectedQpdf = await readDependencyVersion('qpdf')
  if (expectedMupdf !== VERSION_BY_TOOL.mupdf || options.mupdfVersion !== expectedMupdf) throw new Error(`MuPDF release input must match pinned version ${VERSION_BY_TOOL.mupdf}`)
  if (expectedQpdf !== VERSION_BY_TOOL.qpdf || options.qpdfVersion !== expectedQpdf) throw new Error(`qpdf release input must match pinned version ${VERSION_BY_TOOL.qpdf}`)
}

const commandFailure = (command: string, args: string[], stderr: string, stdout: string): Error =>
  new Error(`${command} ${args.join(' ')} failed: ${stderr.trim() || stdout.trim()}`)

export const signManagedToolBinary = async (options: {
  tool: ManagedArtifactToolId
  binaryPath: string
  signingIdentity: string
}): Promise<void> => {
  const args = [
    '--force',
    '--options', 'runtime',
    '--timestamp',
    '--identifier', `dev.autoshow.toolchain.${options.tool}`,
    '--sign', options.signingIdentity,
    options.binaryPath
  ]
  const result = await runCapture('codesign', args, { allowFailure: true })
  if (result.exitCode !== 0) throw commandFailure('codesign', args, result.stderr, result.stdout)
}

export const assertManagedSignedCodeSignature = async (
  binaryPath: string,
  expected: { signingIdentity: string, teamId: string }
): Promise<void> => {
  await verifyManagedPrebuiltCodeSignature(binaryPath, expected)
  const details = await runCapture('codesign', ['-d', '--verbose=4', binaryPath], { allowFailure: true })
  const output = `${details.stdout}\n${details.stderr}`
  if (details.exitCode !== 0) throw managedPrebuiltTrustError(`could not inspect signed code at ${binaryPath}`)
  if (!/^flags=.*\bruntime\b/m.test(output)) throw managedPrebuiltTrustError(`signed code at ${binaryPath} does not enable the hardened runtime`)
  if (!/^Timestamp=.+$/m.test(output)) throw managedPrebuiltTrustError(`signed code at ${binaryPath} does not carry a secure timestamp`)
  if (/^Signature=adhoc$/m.test(output)) throw managedPrebuiltTrustError(`signed code at ${binaryPath} is ad hoc signed`)
}

const parseNotaryJson = (value: string, label: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    return parsed as Record<string, unknown>
  } catch (error) {
    throw managedPrebuiltTrustError(`${label} is not valid JSON`, error)
  }
}

export const submitManagedToolForNotarization = async (options: {
  archivePath: string
  keyPath: string
  keyId: string
  issuerId: string
}): Promise<ManagedNotarizationResult> => {
  const credentialArgs = ['--key', options.keyPath, '--key-id', options.keyId, '--issuer', options.issuerId]
  const submitArgs = ['notarytool', 'submit', options.archivePath, ...credentialArgs, '--wait', '--output-format', 'json']
  const submitted = await runCapture('xcrun', submitArgs, { allowFailure: true })
  if (submitted.exitCode !== 0) throw commandFailure('xcrun', submitArgs, submitted.stderr, submitted.stdout)
  const submission = parseNotaryJson(submitted.stdout, 'notarization submission response')
  const submissionId = submission['id']
  const status = submission['status']
  if (typeof submissionId !== 'string' || submissionId.length === 0) throw managedPrebuiltTrustError('notarization response is missing its submission ID')
  if (status !== 'Accepted') throw managedPrebuiltTrustError(`notarization status is ${String(status)}, expected Accepted`)
  const logArgs = ['notarytool', 'log', submissionId, ...credentialArgs, '--output-format', 'json']
  const logged = await runCapture('xcrun', logArgs, { allowFailure: true })
  if (logged.exitCode !== 0) throw commandFailure('xcrun', logArgs, logged.stderr, logged.stdout)
  return { submissionId, status, log: parseNotaryJson(logged.stdout, 'notarization log') }
}

export const createManagedSignedSpdx = (
  payload: ManagedPrebuiltPayloadManifest,
  created = new Date().toISOString()
): Record<string, unknown> => createManagedToolchainSpdx({
  documentName: `${managedSignedBaseName(payload.tool, payload.architecture)}-sbom`,
  tool: payload.tool,
  architecture: payload.architecture,
  producer: payload.producer,
  sources: payload.sources,
  payload: payload.payload,
  created
})

const validateSignedSbom = (value: unknown, payload: ManagedPrebuiltPayloadManifest): void => {
  if (!value || typeof value !== 'object') throw managedPrebuiltTrustError('signed SPDX SBOM is not an object')
  const creationInfo = (value as Record<string, unknown>)['creationInfo']
  const created = creationInfo && typeof creationInfo === 'object' ? (creationInfo as Record<string, unknown>)['created'] : undefined
  if (typeof created !== 'string' || JSON.stringify(value) !== JSON.stringify(createManagedSignedSpdx(payload, created))) throw managedPrebuiltTrustError('signed SPDX SBOM does not match the approved payload')
}

export const packageManagedSignedCandidate = async (options: {
  tool: ManagedArtifactToolId
  architecture: 'arm64' | 'x64'
  binaryPath: string
  sourceDirectories: ManagedToolchainSourceDirectories
  outputDir: string
  producer: ManagedPrebuiltProducer
  signingIdentity: string
  teamId: string
  notarize: (archivePath: string) => Promise<ManagedNotarizationResult>
  verifySignature?: typeof assertManagedSignedCodeSignature
}): Promise<ManagedSignedCandidateBundle> => {
  if (!/^[A-Z0-9]{10}$/.test(options.teamId)) throw new Error('Apple Team ID must contain exactly 10 uppercase letters or digits')
  const workDir = join(options.outputDir, `.signed-package-${options.tool}-${randomUUID()}`)
  const packageDir = join(workDir, options.tool)
  const binaryRelativePath = managedArtifactBinaryRelativePath(options.tool)
  const archivePath = join(options.outputDir, managedSignedArchiveName(options.tool, options.architecture))
  const releaseManifestPath = join(options.outputDir, managedSignedReleaseManifestName(options.tool, options.architecture))
  const sbomPath = join(options.outputDir, managedSignedSbomName(options.tool, options.architecture))
  const notarizationLogPath = join(options.outputDir, managedSignedNotarizationLogName(options.tool, options.architecture))
  await mkdir(options.outputDir, { recursive: true })
  await Promise.all([archivePath, releaseManifestPath, sbomPath, notarizationLogPath].map(async path => await rm(path, { force: true })))
  try {
    const packagedBinaryPath = join(packageDir, binaryRelativePath)
    await mkdir(dirname(packagedBinaryPath), { recursive: true })
    await cp(options.binaryPath, packagedBinaryPath)
    await chmod(packagedBinaryPath, 0o755)
    await (options.verifySignature ?? assertManagedSignedCodeSignature)(packagedBinaryPath, {
      signingIdentity: options.signingIdentity,
      teamId: options.teamId
    })
    await writeManagedToolchainPackageNotices({
      tool: options.tool,
      packageDir,
      sourceDirectories: options.sourceDirectories
    })
    const payload: ManagedPrebuiltPayloadManifest = {
      schemaVersion: MANAGED_ARTIFACT_SCHEMA_VERSION,
      tool: options.tool,
      version: VERSION_BY_TOOL[options.tool],
      revision: MANAGED_SIGNED_REVISION,
      platform: 'darwin',
      architecture: options.architecture,
      macosDeploymentTarget: MANAGED_SIGNED_DEPLOYMENT_TARGET,
      sources: await readExpectedManagedArtifactSources(options.tool),
      buildFlags: managedArtifactBuildFlags(options.tool),
      producer: options.producer,
      payload: [{ path: binaryRelativePath, sha256: await sha256File(packagedBinaryPath), kind: 'executable' }],
      trust: { signingIdentity: options.signingIdentity, teamId: options.teamId },
      license: managedToolchainDistributionLicense(options.tool)
    }
    parseManagedPrebuiltPayloadManifest(payload)
    const licenseIssue = validateManagedToolchainDistributionLicense(options.tool, payload.license)
    if (licenseIssue) throw managedPrebuiltTrustError(licenseIssue)
    const payloadBytes = `${JSON.stringify(payload, null, 2)}\n`
    await Bun.write(join(packageDir, MANAGED_PREBUILT_PAYLOAD_MANIFEST_NAME), payloadBytes)
    const zipped = await runCapture('zip', ['-X', '-q', '-r', archivePath, options.tool], { allowFailure: true, cwd: workDir })
    if (zipped.exitCode !== 0) throw commandFailure('zip', ['-X', '-q', '-r', archivePath, options.tool], zipped.stderr, zipped.stdout)
    const archiveSha256 = await sha256File(archivePath)
    const sbomBytes = `${JSON.stringify(createManagedSignedSpdx(payload), null, 2)}\n`
    await Bun.write(sbomPath, sbomBytes)
    validateSignedSbom(JSON.parse(sbomBytes) as unknown, payload)
    const notarization = await options.notarize(archivePath)
    if (notarization.status !== 'Accepted' || !notarization.submissionId) throw managedPrebuiltTrustError('notarization did not return an Accepted submission')
    if (await sha256File(archivePath) !== archiveSha256) throw managedPrebuiltTrustError('notarization changed the final ZIP bytes')
    await Bun.write(notarizationLogPath, `${JSON.stringify({
      submissionId: notarization.submissionId,
      status: notarization.status,
      log: notarization.log
    }, null, 2)}\n`)
    const sbomSha256 = sha256Bytes(sbomBytes)
    const releaseManifest: ManagedPrebuiltReleaseManifest = {
      schemaVersion: MANAGED_ARTIFACT_SCHEMA_VERSION,
      identity: `${options.tool}-${payload.version}-${MANAGED_SIGNED_REVISION}-darwin-${options.architecture}`,
      tool: options.tool,
      version: payload.version,
      revision: MANAGED_SIGNED_REVISION,
      platform: 'darwin',
      architecture: options.architecture,
      minimumMacosVersion: MANAGED_SIGNED_DEPLOYMENT_TARGET,
      producerCommit: options.producer.commit,
      archive: { name: basename(archivePath), sha256: archiveSha256 },
      payloadManifestSha256: sha256Bytes(payloadBytes),
      notarization: { submissionId: notarization.submissionId, status: notarization.status },
      sbom: { name: basename(sbomPath), sha256: sbomSha256 },
      provenance: { repository: 'ajcwebdev/autoshow-cli', subjectDigest: archiveSha256 },
      licenseReviewReferences: payload.license.reviewReferences
    }
    parseManagedPrebuiltReleaseManifest(releaseManifest)
    const releaseManifestBytes = `${JSON.stringify(releaseManifest, null, 2)}\n`
    await Bun.write(releaseManifestPath, releaseManifestBytes)
    return {
      archivePath,
      releaseManifestPath,
      sbomPath,
      notarizationLogPath,
      archiveSha256,
      releaseManifestSha256: sha256Bytes(releaseManifestBytes),
      sbomSha256
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
