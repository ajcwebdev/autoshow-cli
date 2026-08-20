import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type {
  ApprovedVoiceSnapshotEntry,
  ComicDialoguePlan,
  ComicVoiceSnapshotTarget,
  VoiceReferenceManifest,
  VoiceReferenceSnapshotIndex,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { withProcessLock } from '~/utils/process-lock'
import { managedVoiceAssetStore } from '../../step-4-tts/voice-management/managed-voice-store'
import { loadVoiceConsentRecord } from '../../step-4-tts/voice-management/voice-consent-store'
import { assertVoiceConsentAllows } from '../../step-4-tts/voice-management/voice-management-contracts'
import {
  loadApprovedVoiceAudition,
  loadCharacterVoiceBriefCatalog,
  loadCurrentVoiceRegistrationIndex,
  loadVoiceRegistrationCatalog,
} from '../../step-4-tts/voice-management/character-voice-registry'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '../../step-4-tts/script-to-audio/contract-identity'
import { writeImmutableArtifactFile } from '../../step-4-tts/script-to-audio/safe-artifact-store'
import {
  createApprovedVoiceSnapshotEntry,
  validateVoiceReferenceManifest,
  validateVoiceReferenceSnapshotIndex,
} from './comic-audio-contracts'

const snapshotLockName = (sceneRunDir: string): string =>
  `comic-voice-snapshots-${createHash('sha256').update(resolve(sceneRunDir)).digest('hex').slice(0, 24)}`

const selectedAuditionAsset = (audition: Awaited<ReturnType<typeof loadApprovedVoiceAudition>>) => {
  for (const item of audition.items) {
    const take = item.takes.find(candidate => candidate.takeId === item.selectedTakeId)
    if (take) return take.protectedAudio
  }
  throw CLIUsageError('Approved audition does not retain an explicitly selected protected take.')
}

const providerRevision = (metadata: Record<string, string | number | boolean | null | string[]>): string | undefined => {
  for (const key of ['providerRevision', 'provider_revision', 'revision', 'version']) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

const referenceAsset = (entry: ApprovedVoiceSnapshotEntry['providerVoice']) =>
  entry.kind === 'reference-asset' ? entry.protectedAsset : undefined

export const buildVoiceReferenceManifest = async (input: {
  charactersRoot: string
  dialoguePlan: ComicDialoguePlan
  targets: readonly ComicVoiceSnapshotTarget[]
  profileKey: string
  createdAt: string
}): Promise<VoiceReferenceManifest> => {
  const briefs = await loadCharacterVoiceBriefCatalog(input.charactersRoot)
  const registrations = await loadVoiceRegistrationCatalog(input.charactersRoot)
  const current = await loadCurrentVoiceRegistrationIndex(input.charactersRoot, registrations)
  const subjects = [...new Set(input.dialoguePlan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn.subjectKey] : node.turns.map(turn => turn.subjectKey)))].sort()
  const uniqueTargets = [...new Map(input.targets.map(target => [`${target.provider}\0${target.model}`, target] as const)).values()]
  const entries: ApprovedVoiceSnapshotEntry[] = []

  for (const target of uniqueTargets) {
    for (const subjectKey of subjects) {
      const selection = current.selections.find(candidate =>
        candidate.subjectKey === subjectKey
        && candidate.provider === target.provider
        && candidate.providerModel === target.model
        && candidate.profileKey === input.profileKey
      )
      if (!selection) throw CLIUsageError(`No approved current ${target.provider}/${input.profileKey} voice registration exists for ${subjectKey}.`)
      const registration = registrations.registrations.find(candidate =>
        candidate.registrationId === selection.registrationId
        && candidate.generationId === selection.generationId
      )
      if (!registration || registration.approval.state !== 'approved' || registration.provisioning.state !== 'ready') {
        throw CLIUsageError(`Current voice registration for ${subjectKey}/${target.provider} is not approved and ready.`)
      }
      if (registration.providerModel !== target.model) {
        throw CLIUsageError(`Approved ${target.provider} voice for ${subjectKey} targets ${registration.providerModel}, not selected model ${target.model}.`)
      }
      const brief = briefs.briefs.find(candidate => candidate.subjectKey === subjectKey && candidate.profileKey === input.profileKey)
      if (!brief || hashCanonicalTtsValue(brief) !== registration.briefHash) throw CLIUsageError(`Approved voice registration for ${subjectKey} no longer matches its authored brief.`)
      if (registration.consentRecordRef) {
        const consent = await loadVoiceConsentRecord(managedVoiceAssetStore, registration.consentRecordRef)
        if (consent.subjectKey !== subjectKey) throw CLIUsageError(`Voice consent subject does not match ${subjectKey}.`)
        assertVoiceConsentAllows(consent, 'new-synthesis')
      }
      const audition = await loadApprovedVoiceAudition(input.charactersRoot, registration)
      const revision = providerRevision(registration.sanitizedProviderMetadata)
      entries.push(createApprovedVoiceSnapshotEntry({
        registrationId: registration.registrationId,
        generationId: registration.generationId,
        subjectKey,
        profileKey: registration.profileKey,
        provider: registration.provider,
        providerVoice: registration.provisioning.providerVoice,
        providerModel: registration.providerModel,
        ...(registration.creationModel ? { creationModel: registration.creationModel } : {}),
        settingsSchema: registration.settingsSchema,
        synthesisSettings: registration.synthesisSettings,
        sanitizedProviderMetadata: registration.sanitizedProviderMetadata,
        briefHash: registration.briefHash,
        auditionManifestHash: audition.auditionId,
        approvedAudition: selectedAuditionAsset(audition),
        ...(referenceAsset(registration.provisioning.providerVoice) ? { referenceAsset: referenceAsset(registration.provisioning.providerVoice) } : {}),
        provenanceRef: registration.provenanceRef,
        ...(registration.consentRecordRef ? { consentRecordRef: registration.consentRecordRef } : {}),
        capabilityFixtureHash: registration.capabilityFixtureHash,
        registrationStateAtSnapshot: 'approved-ready',
        ...(revision ? { providerRevision: revision } : {}),
        externallyMutable: registration.provisioning.providerVoice.kind === 'remote-resource',
        registrationApprovedAt: registration.approval.approvedAt,
      }))
    }
  }

  entries.sort((left, right) => [left.provider, left.providerModel, left.profileKey, left.subjectKey, left.registrationId, left.generationId, left.entryId].join('\0').localeCompare([right.provider, right.providerModel, right.profileKey, right.subjectKey, right.registrationId, right.generationId, right.entryId].join('\0')))
  const base = {
    schemaVersion: 1 as const,
    sceneRunIdentity: input.dialoguePlan.sceneRunIdentity,
    dialoguePlanId: input.dialoguePlan.dialoguePlanId,
    catalogHash: hashCanonicalTtsValue(registrations),
    briefSetHash: hashCanonicalTtsValue(briefs),
    createdAt: input.createdAt,
    entries,
  }
  return validateVoiceReferenceManifest({ ...base, snapshotId: hashCanonicalTtsValue(base) })
}

const atomicWriteIndex = async (path: string, value: VoiceReferenceSnapshotIndex): Promise<void> => {
  const temporary = `${path}.tmp-${randomUUID()}`
  await mkdir(dirname(path), { recursive: true })
  try {
    await Bun.write(temporary, `${JSON.stringify(value, null, 2)}\n`)
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined)
  }
}

export const writeVoiceReferenceManifest = async (
  sceneRunDir: string,
  manifest: VoiceReferenceManifest
): Promise<{ path: string, sha256: string }> => await withProcessLock(snapshotLockName(sceneRunDir), async () => {
  validateVoiceReferenceManifest(manifest)
  const relativePath = `assets/voice-references/${manifest.snapshotId}/voice-reference-snapshot.json`
  const bytes = `${canonicalTtsJson(manifest)}\n`
  const written = await writeImmutableArtifactFile(sceneRunDir, relativePath, bytes)
  const indexPath = join(sceneRunDir, 'assets/voice-reference-snapshots.json')
  const index = await Bun.file(indexPath).exists()
    ? validateVoiceReferenceSnapshotIndex(await Bun.file(indexPath).json() as VoiceReferenceSnapshotIndex)
    : { schemaVersion: 1 as const, entries: [] }
  const nextEntry = {
    sceneRunIdentity: manifest.sceneRunIdentity,
    dialoguePlanId: manifest.dialoguePlanId,
    snapshotId: manifest.snapshotId,
    renderIdentities: [],
    createdAt: manifest.createdAt,
  }
  const prior = index.entries.find(entry => entry.snapshotId === manifest.snapshotId)
  if (prior && (prior.sceneRunIdentity !== nextEntry.sceneRunIdentity || prior.dialoguePlanId !== nextEntry.dialoguePlanId || prior.createdAt !== nextEntry.createdAt)) throw CLIUsageError('Append-only voice snapshot index contains a conflicting snapshot identity.')
  if (!prior) await atomicWriteIndex(indexPath, validateVoiceReferenceSnapshotIndex({ schemaVersion: 1, entries: [...index.entries, nextEntry] }))
  return { path: relativePath, sha256: written.sha256 }
})

export const loadVoiceReferenceManifest = async (input: {
  sceneRunDir: string
  sceneRunIdentity: string
  dialoguePlanId: string
  snapshotId?: string | undefined
}): Promise<{ manifest: VoiceReferenceManifest, ref: { path: string, sha256: string } } | undefined> => {
  const indexPath = join(input.sceneRunDir, 'assets/voice-reference-snapshots.json')
  if (!await Bun.file(indexPath).exists()) return undefined
  const index = validateVoiceReferenceSnapshotIndex(await Bun.file(indexPath).json() as VoiceReferenceSnapshotIndex)
  const matchingEntries = index.entries.filter(candidate =>
    candidate.sceneRunIdentity === input.sceneRunIdentity
    && candidate.dialoguePlanId === input.dialoguePlanId
    && (input.snapshotId === undefined || candidate.snapshotId === input.snapshotId)
  )
  if (input.snapshotId === undefined && matchingEntries.length > 1) throw CLIUsageError('Multiple retained voice snapshots exist for this scene/dialogue; select one exact snapshot identity.')
  const entry = matchingEntries[0]
  if (!entry) return undefined
  const relativePath = `assets/voice-references/${entry.snapshotId}/voice-reference-snapshot.json`
  const bytes = new Uint8Array(await readFile(join(input.sceneRunDir, relativePath)))
  let parsed: VoiceReferenceManifest
  try {
    parsed = validateVoiceReferenceManifest(JSON.parse(new TextDecoder().decode(bytes)) as VoiceReferenceManifest)
  } catch (error) {
    throw CLIUsageError(`Retained voice snapshot is invalid: ${error instanceof Error ? error.message : String(error)}`, undefined, error instanceof Error ? { cause: error } : {})
  }
  if (parsed.snapshotId !== entry.snapshotId || parsed.sceneRunIdentity !== input.sceneRunIdentity || parsed.dialoguePlanId !== input.dialoguePlanId || parsed.createdAt !== entry.createdAt) throw CLIUsageError('Retained voice snapshot does not bind its append-only scene/dialogue index entry.')
  return { manifest: parsed, ref: { path: relativePath, sha256: sha256Bytes(bytes) } }
}

export const bindSnapshotRenderIdentities = async (
  sceneRunDir: string,
  snapshotId: string,
  renderIdentities: readonly string[]
): Promise<void> => await withProcessLock(snapshotLockName(sceneRunDir), async () => {
  const indexPath = join(sceneRunDir, 'assets/voice-reference-snapshots.json')
  if (!await Bun.file(indexPath).exists()) throw CLIUsageError('Voice snapshot index is missing during render binding.')
  const index = validateVoiceReferenceSnapshotIndex(await Bun.file(indexPath).json() as VoiceReferenceSnapshotIndex)
  const entryIndex = index.entries.findIndex(entry => entry.snapshotId === snapshotId)
  const entry = index.entries[entryIndex]
  if (!entry) throw CLIUsageError('Voice snapshot index does not contain the selected snapshot.')
  const merged = [...new Set([...entry.renderIdentities, ...renderIdentities])].sort()
  const entries = index.entries.slice()
  entries[entryIndex] = { ...entry, renderIdentities: merged }
  await atomicWriteIndex(indexPath, validateVoiceReferenceSnapshotIndex({ schemaVersion: 1, entries }))
})
