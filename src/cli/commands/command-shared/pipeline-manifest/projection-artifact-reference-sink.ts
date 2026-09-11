import { posix } from 'node:path'
import type { ArtifactFileDescriptor, ProjectionArtifactReference, ProjectionArtifactReferences } from '~/types'
import { isSha256, isStrictArtifactRelativePath } from './guards'

export const resolveArtifactRelativePath = (
  baseDir: string | undefined,
  value: unknown
): string | undefined => {
  if (!isStrictArtifactRelativePath(value)) return undefined
  if (!baseDir) return value
  if (!isStrictArtifactRelativePath(baseDir)) return undefined
  const combined = posix.join(baseDir, value)
  return isStrictArtifactRelativePath(combined) ? combined : undefined
}

export const projectionArtifactReferenceKey = (reference: Pick<ProjectionArtifactReference, 'path' | 'scope'>): string =>
  `${reference.scope ?? 'provider-artifact'}\0${reference.path}`

export const createNestedArtifactReference = (
  record: Record<string, unknown>,
  pathKey: string,
  shaKey: string,
  kind: ProjectionArtifactReference['kind'],
  baseDir: string | undefined,
  expectedJsonFields?: Record<string, string | number> | undefined,
  context?: ProjectionArtifactReference['context']
): ProjectionArtifactReference | undefined => {
  const path = resolveArtifactRelativePath(baseDir, record[pathKey])
  const sha256 = record[shaKey]
  if (!path || !isSha256(sha256)) return undefined
  return { path, sha256, kind, ...(expectedJsonFields ? { expectedJsonFields } : {}), ...(context ? { context } : {}) }
}

export class ArtifactReferenceSink {
  private readonly files: ProjectionArtifactReference[] = []
  private readonly directories: string[] = []
  private readonly fileIdentities = new Set<string>()
  private readonly directoryPaths = new Set<string>()

  addFile(record: Record<string, unknown>, descriptor: ArtifactFileDescriptor): boolean {
    const path = resolveArtifactRelativePath(descriptor.baseDir, record[descriptor.pathKey])
    const sha256 = record[descriptor.shaKey]
    if (!path || !isSha256(sha256)) return false
    const reference: ProjectionArtifactReference = {
      path,
      sha256,
      scope: descriptor.scope ?? 'provider-artifact',
      kind: descriptor.kind,
      ...(descriptor.expectedJsonFields ? { expectedJsonFields: descriptor.expectedJsonFields } : {}),
      ...(descriptor.context ? { context: descriptor.context } : {})
    }
    const identity = JSON.stringify(reference)
    if (!this.fileIdentities.has(identity)) {
      this.fileIdentities.add(identity)
      this.files.push(reference)
    }
    return true
  }

  addDirectory(path: unknown): boolean {
    if (!isStrictArtifactRelativePath(path)) return false
    if (!this.directoryPaths.has(path)) {
      this.directoryPaths.add(path)
      this.directories.push(path)
    }
    return true
  }

  result(): ProjectionArtifactReferences {
    return { files: this.files, directories: this.directories }
  }
}
