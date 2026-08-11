import { realpath } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import type {
  ApprovedVoiceSnapshotEntry,
  ComicDialoguePlan,
  ComicSourceIdentity,
  StructuredScriptData,
  StructuredScriptArtifactRef,
  VoiceReferenceManifest,
  VoiceReferenceSnapshotIndex,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { toPosixPath, toProjectDisplayPath } from '~/utils/runtime-paths'
import {
  assertContentIdentity,
  canonicalTtsJson,
  hashCanonicalRecordWithout,
  hashCanonicalTtsValue,
  sha256Bytes,
} from '../../step-4-tts/script-to-audio/contract-identity'

const SHA256 = /^[a-f0-9]{64}$/

const assertIsoDate = (value: string, label: string): void => {
  if (!value || Number.isNaN(Date.parse(value))) throw CLIUsageError(`${label} must be an ISO date-time.`)
}

export const createComicSourceIdentity = async (
  scriptPath: string,
  sourceBytes: string | Uint8Array
): Promise<ComicSourceIdentity> => {
  const resolved = await realpath(resolve(scriptPath))
  const canonicalPath = toPosixPath(toProjectDisplayPath(resolved))
  const base = {
    schemaVersion: 1 as const,
    canonicalPath,
    scriptSlug: basename(resolved, extname(resolved)),
    contentSha256: sha256Bytes(sourceBytes),
  }
  return { ...base, identityHash: hashCanonicalTtsValue(base) }
}

export const validateComicSourceIdentity = (value: ComicSourceIdentity): ComicSourceIdentity => {
  if (value.schemaVersion !== 1 || !value.canonicalPath || !value.scriptSlug || !SHA256.test(value.contentSha256)) {
    throw CLIUsageError('Comic source identity requires schemaVersion 1, a canonical path/slug, and an exact source checksum.')
  }
  if (value.canonicalPath.includes('\\') || value.canonicalPath.split('/').some(part => part === '..')) {
    throw CLIUsageError('Comic source identity canonicalPath must be normalized POSIX form without traversal.')
  }
  assertContentIdentity(value as unknown as Record<string, unknown>, 'identityHash', 'Comic source identity')
  return value
}

export const createStructuredScriptArtifactRef = (bytes: string | Uint8Array): StructuredScriptArtifactRef => ({
  path: 'metadata/structured-script.json',
  artifactSchemaVersion: 4,
  sha256: sha256Bytes(bytes),
})

export const validateStructuredScriptSourceSpans = (
  structuredScript: StructuredScriptData,
  exactSourceText: string
): StructuredScriptData => {
  if (structuredScript.schemaVersion !== 4) throw CLIUsageError('Structured source-span validation requires schemaVersion 4.')
  const scalars = [...exactSourceText]
  const validate = (spans: StructuredScriptData['sourceSegments'][number]['sourceSpans'], label: string): void => {
    if (!spans || spans.length === 0) throw CLIUsageError(`${label} requires at least one exact source span.`)
    let priorStart = -1
    let priorEnd = -1
    for (const span of spans) {
      if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < 0 || span.end <= span.start || span.end > scalars.length) throw CLIUsageError(`${label} contains an invalid zero-based half-open Unicode source span.`)
      if (span.start < priorStart || (span.start === priorStart && span.end < priorEnd)) throw CLIUsageError(`${label} source spans are not canonically ordered.`)
      if (scalars.slice(span.start, span.end).join('') !== span.text) throw CLIUsageError(`${label} source span text does not match the exact source identity bytes.`)
      priorStart = span.start
      priorEnd = span.end
    }
  }
  structuredScript.beats.forEach(beat => validate(beat.sourceSpans, `Structured beat ${beat.index}`))
  structuredScript.sourceSegments.forEach(segment => validate(segment.sourceSpans, `Structured source segment ${segment.id}`))
  return structuredScript
}

export const computeSceneRunIdentity = (
  sourceIdentity: ComicSourceIdentity,
  structuredScript: StructuredScriptArtifactRef
): string => {
  validateComicSourceIdentity(sourceIdentity)
  if (structuredScript.path !== 'metadata/structured-script.json' || structuredScript.artifactSchemaVersion !== 4 || !SHA256.test(structuredScript.sha256)) {
    throw CLIUsageError('Structured script artifact reference must bind strict schemaVersion 4 bytes.')
  }
  return hashCanonicalTtsValue({ sourceIdentity, structuredScript })
}

export const validateComicDialoguePlan = (plan: ComicDialoguePlan): ComicDialoguePlan => {
  if (plan.schemaVersion !== 1 || !SHA256.test(plan.sceneRunIdentity)) throw CLIUsageError('Comic dialogue plan requires schemaVersion 1 and a scene-run identity.')
  validateComicSourceIdentity(plan.sourceIdentity)
  if (computeSceneRunIdentity(plan.sourceIdentity, plan.structuredScript) !== plan.sceneRunIdentity) {
    throw CLIUsageError('Comic dialogue plan sceneRunIdentity does not bind its source and structured script.')
  }
  assertIsoDate(plan.createdAt, 'Comic dialogue plan createdAt')
  const turns = plan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns)
  const turnIds = turns.map(turn => turn.turnId)
  if (new Set(turnIds).size !== turnIds.length) throw CLIUsageError('Comic dialogue plan contains duplicate turn IDs.')
  const sourceIdsByNode = plan.nodes.map(node => {
    const sourceIds = node.kind === 'turn' ? [node.turn.sourceSegmentId] : [...new Set(node.turns.map(turn => turn.sourceSegmentId))]
    if (sourceIds.length !== 1) throw CLIUsageError('One comic overlap node must derive from one source segment.')
    return sourceIds[0] as string
  })
  if (new Set(sourceIdsByNode).size !== sourceIdsByNode.length) throw CLIUsageError('Comic dialogue plan speaks one source segment in more than one node.')
  for (const turn of turns) {
    if (!turn.turnId || !turn.sourceSegmentId || !turn.subjectKey || !turn.originalSpeakerLabel || !turn.canonicalText.trim()) {
      throw CLIUsageError('Comic dialogue turns require stable source, subject, speaker, and non-empty text identity.')
    }
    if (!turn.sourceSpans?.length || turn.sourceSpans.some(span => !Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < 0 || span.end <= span.start || span.indexUnit !== 'unicode-scalar-value' || !span.text)) {
      throw CLIUsageError(`Comic dialogue turn ${turn.turnId} requires exact zero-based half-open Unicode source spans.`)
    }
  }
  for (const node of plan.nodes) {
    if (node.kind === 'overlap' && (node.turns.length < 2 || !node.groupId.trim())) {
      throw CLIUsageError('Comic overlap nodes require a stable group ID and at least two child turns.')
    }
  }
  assertContentIdentity(plan as unknown as Record<string, unknown>, 'dialoguePlanId', 'Comic dialogue plan')
  return plan
}

const snapshotEntrySortKey = (entry: ApprovedVoiceSnapshotEntry): string => [
  entry.provider,
  entry.providerModel,
  entry.profileKey,
  entry.subjectKey,
  entry.registrationId,
  entry.generationId,
  entry.entryId,
].join('\0')

export const validateApprovedVoiceSnapshotEntry = (entry: ApprovedVoiceSnapshotEntry): ApprovedVoiceSnapshotEntry => {
  if (entry.registrationStateAtSnapshot !== 'approved-ready' || entry.providerVoice.provider !== entry.provider || !entry.subjectKey || !entry.profileKey) {
    throw CLIUsageError('Voice snapshot entry must retain one approved-ready provider-qualified registration.')
  }
  if (!SHA256.test(entry.generationId) || !SHA256.test(entry.briefHash) || !SHA256.test(entry.auditionManifestHash) || !SHA256.test(entry.capabilityFixtureHash)) {
    throw CLIUsageError('Voice snapshot entry requires immutable registration, brief, audition, and capability identities.')
  }
  if (entry.settingsSchema !== entry.synthesisSettings.settingsSchema) throw CLIUsageError('Voice snapshot entry settings schema does not match its synthesis settings.')
  const expectedEntryHash = hashCanonicalRecordWithout(entry as unknown as Record<string, unknown>, ['entryId', 'entryHash'])
  const { entryId: _entryId, ...withoutEntryId } = entry
  const expectedEntryId = hashCanonicalTtsValue(withoutEntryId)
  if (entry.entryHash !== expectedEntryHash || entry.entryId !== expectedEntryId) {
    throw CLIUsageError('Voice snapshot entry has invalid content identity.')
  }
  return entry
}

export const createApprovedVoiceSnapshotEntry = (
  value: Omit<ApprovedVoiceSnapshotEntry, 'entryId' | 'entryHash'>
): ApprovedVoiceSnapshotEntry => {
  const entryHash = hashCanonicalTtsValue(value)
  const entryId = hashCanonicalTtsValue({ ...value, entryHash })
  return { ...value, entryHash, entryId }
}

export const validateVoiceReferenceManifest = (manifest: VoiceReferenceManifest): VoiceReferenceManifest => {
  if (manifest.schemaVersion !== 1 || !SHA256.test(manifest.sceneRunIdentity) || !SHA256.test(manifest.dialoguePlanId) || !SHA256.test(manifest.catalogHash) || !SHA256.test(manifest.briefSetHash)) {
    throw CLIUsageError('Voice reference manifest requires strict scene, dialogue, catalog, and brief identities.')
  }
  assertIsoDate(manifest.createdAt, 'Voice reference manifest createdAt')
  manifest.entries.forEach(validateApprovedVoiceSnapshotEntry)
  if (new Set(manifest.entries.map(entry => entry.entryId)).size !== manifest.entries.length) throw CLIUsageError('Voice reference manifest contains duplicate entries.')
  const bindingKeys = manifest.entries.map(entry => `${entry.provider}\0${entry.providerModel}\0${entry.profileKey}\0${entry.subjectKey}`)
  if (new Set(bindingKeys).size !== bindingKeys.length) throw CLIUsageError('Voice reference manifest contains duplicate provider/model/profile/subject bindings.')
  const sorted = [...manifest.entries].sort((left, right) => snapshotEntrySortKey(left).localeCompare(snapshotEntrySortKey(right)))
  if (canonicalTtsJson(sorted) !== canonicalTtsJson(manifest.entries)) throw CLIUsageError('Voice reference manifest entries must use canonical lexical order.')
  assertContentIdentity(manifest as unknown as Record<string, unknown>, 'snapshotId', 'Voice reference manifest')
  return manifest
}

export const validateVoiceReferenceSnapshotIndex = (index: VoiceReferenceSnapshotIndex): VoiceReferenceSnapshotIndex => {
  if (index.schemaVersion !== 1 || !Array.isArray(index.entries)) throw CLIUsageError('Voice snapshot index requires schemaVersion 1.')
  const keys = new Set<string>()
  const renderIds = new Map<string, string>()
  for (const entry of index.entries) {
    if (!SHA256.test(entry.sceneRunIdentity) || !SHA256.test(entry.dialoguePlanId) || !SHA256.test(entry.snapshotId) || !Array.isArray(entry.renderIdentities) || entry.renderIdentities.some(renderIdentity => !SHA256.test(renderIdentity))) throw CLIUsageError('Voice snapshot index contains an invalid content identity.')
    if (new Set(entry.renderIdentities).size !== entry.renderIdentities.length) throw CLIUsageError('Voice snapshot index contains duplicate render identities.')
    assertIsoDate(entry.createdAt, 'Voice snapshot index createdAt')
    const key = `${entry.sceneRunIdentity}\0${entry.dialoguePlanId}`
    if (keys.has(key)) throw CLIUsageError('Voice snapshot index contains duplicate scene/dialogue entries.')
    keys.add(key)
    for (const renderIdentity of entry.renderIdentities) {
      const prior = renderIds.get(renderIdentity)
      if (prior && prior !== entry.snapshotId) throw CLIUsageError('One render identity cannot map to multiple voice snapshots.')
      renderIds.set(renderIdentity, entry.snapshotId)
    }
  }
  return index
}
