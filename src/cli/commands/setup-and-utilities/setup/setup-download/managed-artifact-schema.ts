import { join } from 'node:path'
import * as v from 'valibot'
import type {
  ManagedArtifactManifest,
  ManagedPrebuiltPayloadManifest,
  ManagedPrebuiltReleaseManifest,
  ManagedSourceArtifactManifest
} from '~/types'
import { ValidationError } from '~/utils/error-handler'

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

const ManagedSourceArtifactManifestSchema = v.strictObject({
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

const ManagedPrebuiltPayloadManifestSchema = v.strictObject({
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

const ManagedPrebuiltReleaseManifestSchema = v.strictObject({
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

const ManagedPrebuiltArtifactManifestSchema = v.strictObject({
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

const ManagedArtifactManifestSchema = v.union([
  ManagedSourceArtifactManifestSchema,
  ManagedPrebuiltArtifactManifestSchema
])

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

export const parseManagedArtifactManifest = (value: unknown): ManagedArtifactManifest =>
  parseSchema(ManagedArtifactManifestSchema, value, 'managed artifact manifest')
