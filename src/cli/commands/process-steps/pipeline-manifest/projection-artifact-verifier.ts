import { readFile, readdir, realpath, lstat } from 'node:fs/promises'
import { resolve, relative, isAbsolute, posix } from 'node:path'
import { createHash } from 'node:crypto'
import type {
  CheckedArtifact,
  PipelineProviderState,
  ProjectionArtifactReference,
  ProjectionArtifactReferences,
  ProjectionTraversalState,
  ProjectionVerificationRoots
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import {
  canonicalManifestJson,
  hasNoSymlinkBelowRoot,
  isSafeRelativePath,
  isStrictArtifactRelativePath
} from './guards'
import {
  collectNestedProjectionArtifactReferences,
  collectProjectionArtifactReferences,
  projectionArtifactReferenceKey
} from './projection-artifact-references'
import { validateProjectionArtifactJson } from './projection-artifact-json-validation'
import { validateProjectionArtifactGraphLinks } from './projection-artifact-graph-links'

export const discoverPreviousAdmissionJournalReference = async (
  artifactRoot: string,
  reference: ProjectionArtifactReference,
  snapshot: Record<string, unknown>
): Promise<ProjectionArtifactReference[]> => {
  const previousSnapshotId = snapshot['previousSnapshotId']
  if (previousSnapshotId === undefined) return []
  if (typeof previousSnapshotId !== 'string' || previousSnapshotId.length === 0) {
    throw CLIUsageError('Admission journal predecessor ID is invalid.')
  }
  const attemptDir = posix.dirname(reference.path)
  if (attemptDir === '.' || !isStrictArtifactRelativePath(attemptDir)) {
    throw CLIUsageError('Admission journal is not contained by a stable attempt directory.')
  }
  const absoluteAttemptDir = resolve(artifactRoot, attemptDir)
  if (!isSafeRelativePath(artifactRoot, attemptDir) || !await hasNoSymlinkBelowRoot(artifactRoot, absoluteAttemptDir)) {
    throw CLIUsageError('Admission journal attempt directory is unsafe.')
  }
  const matches: ProjectionArtifactReference[] = []
  for (const entry of await readdir(absoluteAttemptDir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.json')) continue
    const candidatePath = posix.join(attemptDir, entry.name)
    if (candidatePath === reference.path || !isStrictArtifactRelativePath(candidatePath)) continue
    const absoluteCandidate = resolve(artifactRoot, candidatePath)
    if (!await hasNoSymlinkBelowRoot(artifactRoot, absoluteCandidate)) continue
    const bytes = await readFile(absoluteCandidate)
    let candidate: unknown
    try {
      candidate = JSON.parse(bytes.toString('utf8')) as unknown
    } catch {
      continue
    }
    if (
      !isRecord(candidate)
      || candidate['snapshotId'] !== previousSnapshotId
      || candidate['journalId'] !== snapshot['journalId']
    ) continue
    matches.push({
      path: candidatePath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      kind: 'admission-journal',
      expectedJsonFields: {
        snapshotId: previousSnapshotId,
        journalId: snapshot['journalId'] as string,
        renderPlanId: snapshot['renderPlanId'] as string,
        renderIdentity: snapshot['renderIdentity'] as string
      },
      ...(reference.context ? { context: reference.context } : {})
    })
  }
  if (matches.length !== 1) {
    throw CLIUsageError('Admission journal predecessor must resolve exactly once inside the same attempt directory.')
  }
  return matches
}

const resolveProjectionVerificationRoots = async (
  rootDir: string,
  artifactDir: string
): Promise<ProjectionVerificationRoots | undefined> => {
  const root = resolve(rootDir)
  const artifactRoot = resolve(root, artifactDir)
  if (!await hasNoSymlinkBelowRoot(root, artifactRoot)) return undefined
  const artifactEntry = await lstat(artifactRoot)
  if (!artifactEntry.isDirectory() || artifactEntry.isSymbolicLink()) return undefined
  const canonicalRoot = await realpath(root)
  const canonicalArtifactRoot = await realpath(artifactRoot)
  const artifactFromRoot = relative(canonicalRoot, canonicalArtifactRoot)
  if (artifactFromRoot.startsWith('..') || isAbsolute(artifactFromRoot)) return undefined
  return { root, artifactRoot, canonicalRoot, canonicalArtifactRoot }
}

const verifyProjectionDirectories = async (
  roots: ProjectionVerificationRoots,
  directories: readonly string[]
): Promise<boolean> => {
  for (const directoryRef of directories) {
    const directory = resolve(roots.artifactRoot, directoryRef)
    if (!isSafeRelativePath(roots.artifactRoot, directoryRef) || !await hasNoSymlinkBelowRoot(roots.artifactRoot, directory)) return false
    const entry = await lstat(directory)
    if (!entry.isDirectory() || entry.isSymbolicLink()) return false
    const canonical = await realpath(directory)
    const fromArtifact = relative(roots.canonicalArtifactRoot, canonical)
    if (fromArtifact.startsWith('..') || isAbsolute(fromArtifact)) return false
  }
  return true
}

export const decodeProjectionArtifactBytes = (
  reference: ProjectionArtifactReference,
  bytes: Uint8Array
): Record<string, unknown> | undefined => {
  if (reference.kind === 'audio' || (reference.kind === 'strategy-text' && !reference.expectedJsonFields)) {
    return undefined
  }
  const text = Buffer.from(bytes).toString('utf8')
  const jsonText = reference.kind === 'admission-journal' && reference.path.endsWith('.jsonl')
    ? text.split('\n').filter((line) => line.length > 0).at(-1)
    : text
  if (!jsonText) throw CLIUsageError('Projection artifact JSON is empty.')
  const parsed = JSON.parse(jsonText) as unknown
  const value = reference.kind === 'admission-journal'
    && reference.path.endsWith('.jsonl')
    && isRecord(parsed)
    && isRecord(parsed['snapshot'])
    ? parsed['snapshot']
    : parsed
  if (!isRecord(value)) throw CLIUsageError('Projection artifact JSON must be an object.')
  return value
}

const loadProjectionArtifact = async (
  roots: ProjectionVerificationRoots,
  reference: ProjectionArtifactReference
): Promise<CheckedArtifact | undefined> => {
  const referenceRoot = reference.scope === 'run-root' ? roots.root : roots.artifactRoot
  const canonicalReferenceRoot = reference.scope === 'run-root' ? roots.canonicalRoot : roots.canonicalArtifactRoot
  const filePath = resolve(referenceRoot, reference.path)
  if (!isSafeRelativePath(referenceRoot, reference.path) || !await hasNoSymlinkBelowRoot(referenceRoot, filePath)) return undefined
  const entry = await lstat(filePath)
  if (!entry.isFile() || entry.isSymbolicLink()) return undefined
  const canonical = await realpath(filePath)
  const fromReferenceRoot = relative(canonicalReferenceRoot, canonical)
  if (fromReferenceRoot.startsWith('..') || isAbsolute(fromReferenceRoot)) return undefined
  const bytes = await readFile(canonical)
  const actualSha = createHash('sha256').update(bytes).digest('hex')
  if (actualSha !== reference.sha256) return undefined
  const json = decodeProjectionArtifactBytes(reference, bytes)
  return { sha256: reference.sha256, ...(json ? { json } : {}) }
}

const checkedArtifactForReference = async (
  roots: ProjectionVerificationRoots,
  reference: ProjectionArtifactReference,
  checked: Map<string, CheckedArtifact>
): Promise<CheckedArtifact | undefined> => {
  const referenceKey = projectionArtifactReferenceKey(reference)
  const prior = checked.get(referenceKey)
  if (prior) return prior.sha256 === reference.sha256 ? prior : undefined
  const loaded = await loadProjectionArtifact(roots, reference)
  if (loaded) checked.set(referenceKey, loaded)
  return loaded
}

const validateExpectedJsonFields = (
  reference: ProjectionArtifactReference,
  json: Record<string, unknown> | undefined
): boolean =>
  reference.expectedJsonFields === undefined
  || (json !== undefined && Object.entries(reference.expectedJsonFields).every(([key, expected]) => json[key] === expected))

const expansionIdentity = (reference: ProjectionArtifactReference): string =>
  canonicalManifestJson({
    path: reference.path,
    kind: reference.kind,
    context: reference.kind === 'admission-journal' ? undefined : reference.context
  })

const expandProjectionArtifactReference = async (
  roots: ProjectionVerificationRoots,
  reference: ProjectionArtifactReference,
  json: Record<string, unknown>,
  references: ProjectionArtifactReferences,
  expanded: Set<string>
): Promise<boolean> => {
  const identity = expansionIdentity(reference)
  if (expanded.has(identity)) return true
  expanded.add(identity)
  if (reference.kind === 'admission-journal') {
    references.files.push(...await discoverPreviousAdmissionJournalReference(roots.artifactRoot, reference, json))
  }
  const nested = collectNestedProjectionArtifactReferences(reference, json)
  if (!nested) return false
  references.files.push(...nested)
  return true
}

export const visitProjectionArtifactReference = (
  reference: ProjectionArtifactReference,
  visitedReferences: Set<string>
): 'new' | 'duplicate' | 'limit-exceeded' => {
  const identity = canonicalManifestJson(reference)
  if (visitedReferences.has(identity)) return 'duplicate'
  visitedReferences.add(identity)
  return visitedReferences.size > 10_000 ? 'limit-exceeded' : 'new'
}

const verifyProjectionReference = async (
  roots: ProjectionVerificationRoots,
  reference: ProjectionArtifactReference,
  references: ProjectionArtifactReferences,
  state: ProjectionTraversalState
): Promise<boolean> => {
  const checked = await checkedArtifactForReference(roots, reference, state.checked)
  if (!checked || !validateExpectedJsonFields(reference, checked.json)) return false
  if (reference.kind === 'audio' || reference.kind === 'strategy-text') return true
  if (!checked.json) return false
  validateProjectionArtifactJson(reference.kind, checked.json)
  return await expandProjectionArtifactReference(roots, reference, checked.json, references, state.expanded)
}

const verifyProjectionReferenceTraversal = async (
  roots: ProjectionVerificationRoots,
  references: ProjectionArtifactReferences
): Promise<Map<string, CheckedArtifact> | undefined> => {
  const state: ProjectionTraversalState = {
    checked: new Map(),
    expanded: new Set(),
    visitedReferences: new Set()
  }
  for (let referenceIndex = 0; referenceIndex < references.files.length; referenceIndex += 1) {
    const reference = references.files[referenceIndex]
    if (!reference) return undefined
    const visit = visitProjectionArtifactReference(reference, state.visitedReferences)
    if (visit === 'limit-exceeded') return undefined
    if (visit === 'duplicate') continue
    if (!await verifyProjectionReference(roots, reference, references, state)) return undefined
  }
  return state.checked
}

const verifyProjectionArtifactSet = async (
  roots: ProjectionVerificationRoots,
  references: ProjectionArtifactReferences
): Promise<boolean> => {
  if (!await verifyProjectionDirectories(roots, references.directories)) return false
  const checked = await verifyProjectionReferenceTraversal(roots, references)
  return checked !== undefined && validateProjectionArtifactGraphLinks(references.files, checked)
}

export const verifyProviderProjectionArtifacts = async (
  rootDir: string,
  provider: PipelineProviderState
): Promise<boolean> => {
  if (provider.legacyRenderIdentity?.startsWith('legacy:')) return true
  if (
    (provider.operation !== 'tts-synthesis' && provider.operation !== 'comic-audio')
    || !provider.targetKey
  ) return true
  const namespace = provider.operation === 'tts-synthesis' ? 'ttsAudio' : 'comicAudio'
  const projection = provider.result?.[namespace]
  if (!isRecord(projection)) return false
  const references = collectProjectionArtifactReferences(projection, provider.targetKey)
  if (!references) return false
  if (references.files.length === 0 && references.directories.length === 0) return true
  try {
    const roots = await resolveProjectionVerificationRoots(rootDir, provider.artifactDir)
    return roots !== undefined && await verifyProjectionArtifactSet(roots, references)
  } catch {
    return false
  }
}
