export type ManagedArtifactToolId = 'mupdf' | 'qpdf'

export type ManagedArtifactSource = {
  name: string
  version: string
  url: string
  sha256: string
}

type ManagedArtifactPayloadFile = {
  path: string
  sha256: string
}

export type ManagedSourcePayloadFile = ManagedArtifactPayloadFile & {
  kind?: 'file' | 'directory' | 'symlink' | undefined
  mode?: number | undefined
  size?: number | undefined
  target?: string | undefined
}

export type ManagedArtifactDependency = {
  name: string
  version: string
  manifestSha256: string
}

export type ManagedUnavailableSignedComponent = {
  image: string
  missingDependencies: string[]
}

export type ManagedDynamicLibraryClosureResult = {
  inertRunpaths: string[]
  unavailableComponents: ManagedUnavailableSignedComponent[]
  absentFrameworks: string[]
}

export type ManagedSourceArtifactManifest = {
  schemaVersion: 1
  tool: string
  version: string
  distribution: 'source'
  platform: 'darwin'
  architecture: string
  macosDeploymentTarget: string
  sources: ManagedArtifactSource[]
  buildFlags: string[]
  payload: ManagedSourcePayloadFile[]
  recipeRevision?: string | undefined
  dependencies?: ManagedArtifactDependency[] | undefined
}

type ManagedPrebuiltPayloadFile = ManagedArtifactPayloadFile & {
  kind: 'executable' | 'library'
}

type ManagedPrebuiltProducer = {
  repository: 'ajcwebdev/autoshow-cli'
  commit: string
  workflowName: string
  workflowRunUrl: string
  runnerLabel: 'macos-15' | 'macos-15-intel'
  runnerImage: string
  compilerVersion: string
  sdkVersion: string
  buildToolVersions: string[]
}

export type ManagedPrebuiltLicense = {
  primaryLicense: string
  noticePaths: string[]
  correspondingSourceAssets: string[]
  autoshowSourceArchive: string
  reviewStatus: 'approved'
  reviewReferences: string[]
  reviewedAt: string
  repositoryReviewer: string
  complianceReviewer: string
  writtenOfferRequired: false
  userNoticePath: string
}

export type ManagedPrebuiltPayloadManifest = {
  schemaVersion: 1
  tool: ManagedArtifactToolId
  version: string
  revision: string
  platform: 'darwin'
  architecture: 'arm64' | 'x64'
  macosDeploymentTarget: string
  sources: ManagedArtifactSource[]
  buildFlags: string[]
  producer: ManagedPrebuiltProducer
  payload: ManagedPrebuiltPayloadFile[]
  trust: {
    signingIdentity: string
    teamId: string
  }
  license: ManagedPrebuiltLicense
}

export type ManagedPrebuiltReleaseManifest = {
  schemaVersion: 1
  identity: string
  tool: ManagedArtifactToolId
  version: string
  revision: string
  platform: 'darwin'
  architecture: 'arm64' | 'x64'
  minimumMacosVersion: string
  producerCommit: string
  archive: {
    name: string
    sha256: string
  }
  payloadManifestSha256: string
  notarization: {
    submissionId: string
    status: 'Accepted'
  }
  sbom: {
    name: string
    sha256: string
  }
  provenance: {
    repository: 'ajcwebdev/autoshow-cli'
    subjectDigest: string
  }
  licenseReviewReferences: string[]
}

export type ManagedPrebuiltCandidate = {
  tool: ManagedArtifactToolId
  version: string
  revision: string
  platform: 'darwin'
  architecture: 'arm64' | 'x64'
  minimumMacosVersion: string
  url: string
  archiveName: string
  archiveSha256: string
  releaseManifestJson: string
  releaseManifestSha256: string
  expectedSigningIdentity: string
  expectedTeamId: string
}

type ManagedPrebuiltInstalledRelease = {
  revision: string
  url: string
  archiveName: string
  archiveSha256: string
  releaseManifestIdentity: string
  releaseManifestSha256: string
  payloadManifestSha256: string
  signingIdentity: string
  teamId: string
  notarizationSubmissionId: string
  notarizationStatus: 'Accepted'
  sbomName: string
  sbomSha256: string
  provenanceSubjectDigest: string
  producerCommit: string
  licenseReviewReferences: string[]
}

export type ManagedPrebuiltArtifactManifest = {
  schemaVersion: 1
  tool: ManagedArtifactToolId
  version: string
  distribution: 'prebuilt'
  platform: 'darwin'
  architecture: 'arm64' | 'x64'
  macosDeploymentTarget: string
  sources: ManagedArtifactSource[]
  buildFlags: string[]
  producer: ManagedPrebuiltProducer
  payload: ManagedPrebuiltPayloadFile[]
  packageFiles: ManagedArtifactPayloadFile[]
  release: ManagedPrebuiltInstalledRelease
}

export type ManagedArtifactManifest = ManagedSourceArtifactManifest | ManagedPrebuiltArtifactManifest

export type ManagedArtifactValidation =
  | {
      healthy: true
      distribution: 'source'
      version: string
      platform: 'darwin'
      architecture: string
    }
  | {
      healthy: true
      distribution: 'prebuilt'
      version: string
      revision: string
      platform: 'darwin'
      architecture: 'arm64' | 'x64'
    }
  | {
      healthy: false
      reason: string
    }

export type ManagedSourceArtifactValidation = Extract<ManagedArtifactValidation, { healthy: false } | { distribution: 'source' }>

export type ManagedSourceRecipe = {
  binaryRelativePath: string
  sourceNames: readonly string[]
  buildFlags: readonly string[]
  requiredPaths?: readonly string[]
}
