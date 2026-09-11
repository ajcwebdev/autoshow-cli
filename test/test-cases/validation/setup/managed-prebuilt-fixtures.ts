import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createManagedSourceArtifactManifest, managedArtifactManifestPath } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import { managedToolchainDistributionLicense } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import type { ManagedPrebuiltArtifactManifest, ManagedPrebuiltCandidate, ManagedPrebuiltPayloadManifest, ManagedPrebuiltReleaseManifest } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'

export const writeManagedPrebuiltFixture = async (
  toolDir: string,
  mutatePayload: (payload: ManagedPrebuiltPayloadManifest) => void = () => undefined
) => {
  await mkdir(join(toolDir, 'bin'), { recursive: true })
  await Bun.write(join(toolDir, 'bin/qpdf'), 'synthetic executable\n')
  const source = await createManagedSourceArtifactManifest({ tool: 'qpdf', toolDir, deploymentTarget: '15.0', platform: 'darwin', architecture: 'arm64' })
  const payload: ManagedPrebuiltPayloadManifest = {
    schemaVersion: 1, tool: 'qpdf', version: source.version, revision: 'r1', platform: 'darwin', architecture: 'arm64', macosDeploymentTarget: '15.0',
    sources: source.sources, buildFlags: source.buildFlags,
    producer: { repository: 'ajcwebdev/autoshow-cli', commit: 'a'.repeat(40), workflowName: 'fixture', workflowRunUrl: 'https://example.invalid/run', runnerLabel: 'macos-15', runnerImage: 'fixture', compilerVersion: 'fixture', sdkVersion: 'fixture', buildToolVersions: ['fixture'] },
    payload: source.payload.map(file => ({ ...file, kind: 'executable' })),
    trust: { signingIdentity: 'Synthetic signer', teamId: 'TESTTEAM01' },
    license: managedToolchainDistributionLicense('qpdf')
  }
  mutatePayload(payload)
  const payloadBytes = JSON.stringify(payload)
  const payloadPath = '.autoshow-payload-manifest.json'
  await Bun.write(join(toolDir, payloadPath), payloadBytes)
  for (const path of payload.license.noticePaths) {
    await mkdir(dirname(join(toolDir, path)), { recursive: true })
    await Bun.write(join(toolDir, path), 'synthetic notice\n')
  }
  const release: ManagedPrebuiltReleaseManifest = {
    schemaVersion: 1, identity: `qpdf-${source.version}-r1-darwin-arm64`, tool: 'qpdf', version: source.version, revision: 'r1', platform: 'darwin', architecture: 'arm64', minimumMacosVersion: '15.0', producerCommit: payload.producer.commit,
    archive: { name: 'fixture.tar.gz', sha256: 'b'.repeat(64) }, payloadManifestSha256: sha256Bytes(payloadBytes),
    notarization: { submissionId: 'synthetic-submission', status: 'Accepted' }, sbom: { name: 'fixture-sbom.json', sha256: 'c'.repeat(64) },
    provenance: { repository: 'ajcwebdev/autoshow-cli', subjectDigest: 'b'.repeat(64) },
    licenseReviewReferences: managedToolchainDistributionLicense('qpdf').reviewReferences
  }
  const releaseManifestJson = JSON.stringify(release)
  const candidate: ManagedPrebuiltCandidate = {
    tool: 'qpdf', version: source.version, revision: 'r1', platform: 'darwin', architecture: 'arm64', minimumMacosVersion: '15.0', url: 'https://example.invalid/fixture.tar.gz',
    archiveName: release.archive.name, archiveSha256: release.archive.sha256, releaseManifestJson, releaseManifestSha256: sha256Bytes(releaseManifestJson),
    expectedSigningIdentity: 'Synthetic signer', expectedTeamId: 'TESTTEAM01'
  }
  const manifest: ManagedPrebuiltArtifactManifest = {
    ...source, distribution: 'prebuilt', architecture: 'arm64', producer: payload.producer, payload: payload.payload,
    packageFiles: await Promise.all([payloadPath, ...payload.payload.map(file => file.path), ...payload.license.noticePaths].map(async path => ({ path, sha256: sha256Bytes(await Bun.file(join(toolDir, path)).bytes()) }))),
    release: {
      revision: candidate.revision, url: candidate.url, archiveName: candidate.archiveName, archiveSha256: candidate.archiveSha256,
      releaseManifestIdentity: release.identity, releaseManifestSha256: candidate.releaseManifestSha256, payloadManifestSha256: release.payloadManifestSha256,
      signingIdentity: candidate.expectedSigningIdentity, teamId: candidate.expectedTeamId, notarizationSubmissionId: release.notarization.submissionId, notarizationStatus: release.notarization.status,
      sbomName: release.sbom.name, sbomSha256: release.sbom.sha256, provenanceSubjectDigest: release.provenance.subjectDigest, producerCommit: release.producerCommit, licenseReviewReferences: release.licenseReviewReferences
    }
  }
  await Bun.write(managedArtifactManifestPath(toolDir), JSON.stringify(manifest))
  return { candidate, payload, manifest }
}
