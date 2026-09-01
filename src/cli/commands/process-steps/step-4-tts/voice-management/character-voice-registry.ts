import { existsSync } from 'node:fs'
import { link, mkdir, readFile } from 'node:fs/promises'
import { unlinkPath as unlink } from '~/utils/bun-file-io'
import { dirname, join, resolve } from 'node:path'
import type {
  CharacterVoiceBrief,
  CharacterVoiceBriefCatalog,
  CurrentVoiceRegistrationIndex,
  VoiceAuditionManifest,
  VoiceProvisioningState,
  VoiceRegistration,
  VoiceRegistrationCatalog,
  ApproveVoiceRegistrationInput,
  CharacterVoiceRegistryPaths,
} from '~/types'
import { withProcessLock } from '~/utils/process-lock'
import { UsageError, hasErrorCode, InfraError, ValidationError } from '~/utils/error-handler'
import { canonicalTtsJson, encodeArtifactKey, hashCanonicalRecordWithout, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import {
  validateAuditActorRef,
  assertVoiceConsentAllows,
  validateCurrentVoiceRegistrationIndex,
  validateVoiceAuditionManifest,
  validateVoiceRegistration,
  validateVoiceRegistrationCatalog,
} from './voice-management-contracts'
import { isRecord } from '~/utils/value-helpers'
import { atomicWriteJson } from '~/utils/filesystem'

const CHARACTER_VOICES_FILENAME = 'character-voices.json'
const CHARACTER_VOICE_REGISTRATIONS_FILENAME = 'character-voice-registrations.json'
const CHARACTER_VOICE_CURRENT_FILENAME = 'character-voice-current.json'

const SAFE_KEY = /^[a-z0-9][a-z0-9_-]{0,127}$/
const LOGICAL_SUBJECT_KEY = /^(?:[a-z0-9][a-z0-9_-]{0,127}|(?:role|voice):[a-z0-9][a-z0-9_-]{0,127})$/
const VOICE_ORIGINS = new Set([
  'provider-stock', 'community-library', 'designed', 'remixed', 'instant-clone', 'professional-clone',
  'imported-custom', 'saved-reference', 'request-reference-audio', 'local-model-voice'
])
const TTS_PROVIDERS = new Set(['elevenlabs', 'minimax', 'grok', 'mistral', 'openai', 'speechify', 'hume', 'cartesia', 'inworld'])

const assertSafeKey = (value: string, label: string): void => {
  if (!SAFE_KEY.test(value)) throw UsageError(`${label} must be a safe lowercase key.`)
}

const assertSubjectKey = (value: string, label: string): void => {
  if (!LOGICAL_SUBJECT_KEY.test(value)) throw UsageError(`${label} must be a safe character key or an explicit role:/voice: logical key.`)
}

const voiceSubjectArtifactKey = (subjectKey: string): string => {
  assertSubjectKey(subjectKey, 'Voice subject key')
  return SAFE_KEY.test(subjectKey) ? subjectKey : encodeArtifactKey(subjectKey)
}

const assertAllowedKeys = (value: Record<string, unknown>, allowed: readonly string[], label: string): void => {
  const allowedSet = new Set(allowed)
  const unknown = Object.keys(value).filter(key => !allowedSet.has(key))
  if (unknown.length > 0) throw ValidationError(`${label} contains unsupported field(s): ${unknown.join(', ')}.`, { stage: 'comic:voice-registry' })
}

export const resolveCharacterVoiceRegistryPaths = (charactersRoot: string): CharacterVoiceRegistryPaths => {
  const root = resolve(charactersRoot)
  return {
    charactersRoot: root,
    briefs: join(root, CHARACTER_VOICES_FILENAME),
    registrations: join(root, CHARACTER_VOICE_REGISTRATIONS_FILENAME),
    current: join(root, CHARACTER_VOICE_CURRENT_FILENAME),
    referencesRoot: join(root, 'voice-references')
  }
}

export const writeCreateOnlyJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  const bytes = `${JSON.stringify(value, null, 2)}\n`
  if (existsSync(path)) {
    if (await readFile(path, 'utf8') !== bytes) throw ValidationError(`Create-only voice artifact conflicts with existing bytes at ${path}.`, { stage: 'comic:voice-registry' })
    return
  }
  const temporary = `${path}.tmp-${crypto.randomUUID()}`
  await Bun.write(temporary, bytes)
  try {
    await link(temporary, path)
  } catch (error) {
    if (hasErrorCode(error, 'EEXIST') && await readFile(path, 'utf8') === bytes) return
    throw error
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
}

const readJson = async (path: string, missingValue?: unknown): Promise<unknown> => {
  if (!existsSync(path)) {
    if (missingValue !== undefined) return missingValue
    throw InfraError(`Voice artifact not found at ${path}.`, { stage: 'comic:voice-registry' })
  }
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch (error) {
    throw ValidationError(`Voice artifact contains invalid JSON at ${path}.`, { stage: 'comic:voice-registry', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

const validateCharacterVoiceBrief = (brief: CharacterVoiceBrief): CharacterVoiceBrief => {
  if (!isRecord(brief)) throw UsageError('Character voice brief must be an object.')
  assertAllowedKeys(brief, [
    'subjectKey', 'profileKey', 'language', 'locale', 'accent', 'apparentAgeRange', 'genderPresentation',
    'pitchRegister', 'timbre', 'resonance', 'pace', 'energy', 'texture', 'mannerisms', 'defaultDelivery',
    'prohibitedCaricatures', 'pronunciations', 'allowedOrigins', 'preferredProviders'
  ], 'Character voice brief')
  assertSubjectKey(brief.subjectKey, 'Voice brief subject key')
  assertSafeKey(brief.profileKey, 'Voice brief profile key')
  if (brief.accent) {
    assertAllowedKeys(brief.accent, ['description', 'strength'], 'Voice brief accent')
    if (!brief.accent.description.trim() || (brief.accent.strength !== undefined && !['light', 'moderate', 'strong'].includes(brief.accent.strength))) throw UsageError('Voice brief accent requires a description and supported strength.')
  }
  if (brief.apparentAgeRange && (
    !Number.isInteger(brief.apparentAgeRange.minimum)
    || !Number.isInteger(brief.apparentAgeRange.maximum)
    || brief.apparentAgeRange.minimum < 0
    || brief.apparentAgeRange.maximum < brief.apparentAgeRange.minimum
  )) throw UsageError('Voice brief apparent age range must be ordered non-negative integers.')
  if (brief.apparentAgeRange) assertAllowedKeys(brief.apparentAgeRange, ['minimum', 'maximum'], 'Voice brief apparent age range')
  if (!Array.isArray(brief.mannerisms) || !Array.isArray(brief.prohibitedCaricatures) || !Array.isArray(brief.pronunciations) || !Array.isArray(brief.allowedOrigins)) throw UsageError('Voice brief list fields must be arrays.')
  if (brief.allowedOrigins.length === 0 || brief.allowedOrigins.some(origin => !VOICE_ORIGINS.has(origin))) throw UsageError('Voice brief requires at least one supported allowed origin.')
  if (brief.preferredProviders && (!Array.isArray(brief.preferredProviders) || brief.preferredProviders.some(provider => !TTS_PROVIDERS.has(provider)))) throw UsageError('Voice brief preferred providers contain an unsupported TTS provider.')
  for (const pronunciation of brief.pronunciations) assertAllowedKeys(pronunciation, ['term', 'pronunciation'], 'Voice brief pronunciation')
  if (brief.pronunciations.some(entry => !entry.term.trim() || !entry.pronunciation.trim())) throw UsageError('Voice brief pronunciations require a term and pronunciation.')
  const pronunciationTerms = brief.pronunciations.map(entry => entry.term.normalize('NFKC').toLocaleLowerCase('en-US'))
  if (new Set(pronunciationTerms).size !== pronunciationTerms.length) throw UsageError('Voice brief contains duplicate pronunciation terms.')
  return brief
}

export const hashCharacterVoiceBrief = (brief: CharacterVoiceBrief): string => {
  validateCharacterVoiceBrief(brief)
  return hashCanonicalTtsValue(brief)
}

export const loadCharacterVoiceBriefCatalog = async (charactersRoot: string): Promise<CharacterVoiceBriefCatalog> => {
  const path = resolveCharacterVoiceRegistryPaths(charactersRoot).briefs
  const value = await readJson(path)
  if (!isRecord(value)) throw ValidationError(`Invalid character voice brief catalog at ${path}.`, { stage: 'comic:voice-registry' })
  assertAllowedKeys(value, ['schemaVersion', 'briefs'], 'Character voice brief catalog')
  if (value['schemaVersion'] !== 1 || !Array.isArray(value['briefs'])) throw ValidationError(`Character voice brief catalog at ${path} requires schemaVersion 1 and briefs.`, { stage: 'comic:voice-registry' })
  const catalog = value as CharacterVoiceBriefCatalog
  const keys = catalog.briefs.map(brief => `${brief.subjectKey}\0${brief.profileKey}`)
  if (new Set(keys).size !== keys.length) throw ValidationError('Character voice brief catalog contains duplicate subject/profile entries.', { stage: 'comic:voice-registry' })
  for (const brief of catalog.briefs) validateCharacterVoiceBrief(brief)
  return catalog
}

export const writeCharacterVoiceBriefCatalog = async (
  charactersRoot: string,
  catalog: CharacterVoiceBriefCatalog
): Promise<void> => {
  if (catalog.schemaVersion !== 1) throw UsageError('Character voice brief catalog requires schemaVersion 1.')
  const keys = catalog.briefs.map(brief => `${brief.subjectKey}\0${brief.profileKey}`)
  if (new Set(keys).size !== keys.length) throw UsageError('Character voice brief catalog contains duplicate subject/profile entries.')
  for (const brief of catalog.briefs) validateCharacterVoiceBrief(brief)
  await atomicWriteJson(resolveCharacterVoiceRegistryPaths(charactersRoot).briefs, catalog)
}

export const loadVoiceRegistrationCatalog = async (charactersRoot: string): Promise<VoiceRegistrationCatalog> => {
  const path = resolveCharacterVoiceRegistryPaths(charactersRoot).registrations
  const value = await readJson(path, { schemaVersion: 1, registrations: [] })
  if (!isRecord(value)) throw ValidationError(`Invalid voice registration catalog at ${path}.`, { stage: 'comic:voice-registry' })
  assertAllowedKeys(value, ['schemaVersion', 'registrations'], 'Voice registration catalog')
  try {
    return validateVoiceRegistrationCatalog(value as VoiceRegistrationCatalog)
  } catch (error) {
    throw ValidationError(`Invalid voice registration catalog at ${path}: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:voice-registry', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

export const loadCurrentVoiceRegistrationIndex = async (
  charactersRoot: string,
  catalog?: VoiceRegistrationCatalog | undefined
): Promise<CurrentVoiceRegistrationIndex> => {
  const path = resolveCharacterVoiceRegistryPaths(charactersRoot).current
  const value = await readJson(path, { schemaVersion: 2, revision: 0, selections: [] })
  if (!isRecord(value)) throw ValidationError(`Invalid current voice index at ${path}.`, { stage: 'comic:voice-registry' })
  assertAllowedKeys(value, ['schemaVersion', 'revision', 'selections'], 'Current voice index')
  try {
    return validateCurrentVoiceRegistrationIndex(value as CurrentVoiceRegistrationIndex, catalog)
  } catch (error) {
    throw ValidationError(`Invalid current voice index at ${path}: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:voice-registry', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

export const loadApprovedVoiceAudition = async (
  charactersRoot: string,
  registration: VoiceRegistration
): Promise<VoiceAuditionManifest> => {
  if (registration.approval.state !== 'approved' || !registration.approvedAuditionId) {
    throw UsageError('Approved audition lookup requires an approved voice registration.')
  }
  const paths = resolveCharacterVoiceRegistryPaths(charactersRoot)
  const path = join(
    paths.referencesRoot,
    voiceSubjectArtifactKey(registration.subjectKey),
    registration.provider,
    registration.registrationId,
    registration.generationId,
    'audition-manifest.json'
  )
  const value = await readJson(path)
  try {
    const audition = validateVoiceAuditionManifest(value as VoiceAuditionManifest)
    if (audition.auditionId !== registration.approvedAuditionId || audition.providerVoice.provider !== registration.provider) {
      throw UsageError('Approved audition does not bind the exact registration generation.')
    }
    return audition
  } catch (error) {
    throw ValidationError(`Invalid approved voice audition at ${path}: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:voice-registry', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

const registryLockName = (charactersRoot: string): string =>
  `comic-voice-registry-${new Bun.CryptoHasher('sha256').update(resolve(charactersRoot)).digest('hex').slice(0, 24)}`

const withCharacterVoiceRegistryLock = async <T>(charactersRoot: string, run: () => Promise<T>): Promise<T> =>
  await withProcessLock(registryLockName(charactersRoot), run)

const appendRegistrationUnlocked = async (
  paths: CharacterVoiceRegistryPaths,
  catalog: VoiceRegistrationCatalog,
  registration: VoiceRegistration
): Promise<VoiceRegistrationCatalog> => {
  validateVoiceRegistration(registration)
  const existing = catalog.registrations.find(candidate =>
    candidate.registrationId === registration.registrationId
    && candidate.generationId === registration.generationId
  )
  if (existing) {
    if (canonicalTtsJson(existing) !== canonicalTtsJson(registration)) throw ValidationError('Voice registration generation conflicts with existing append-preserved bytes.', { stage: 'comic:voice-registry' })
    return catalog
  }
  const next = { schemaVersion: 1 as const, registrations: [...catalog.registrations, registration] }
  validateVoiceRegistrationCatalog(next)
  await writeRegistrationArtifacts(paths, registration)
  await atomicWriteJson(paths.registrations, next)
  return next
}

export const appendVoiceRegistration = async (
  charactersRoot: string,
  registration: VoiceRegistration
): Promise<VoiceRegistrationCatalog> => await withCharacterVoiceRegistryLock(charactersRoot, async () => {
  const paths = resolveCharacterVoiceRegistryPaths(charactersRoot)
  const catalog = await loadVoiceRegistrationCatalog(charactersRoot)
  return await appendRegistrationUnlocked(paths, catalog, registration)
})

const referenceGenerationRoot = (paths: CharacterVoiceRegistryPaths, registration: VoiceRegistration): string => {
  assertSubjectKey(registration.subjectKey, 'Voice reference subject key')
  assertSafeKey(registration.provider, 'Voice reference provider key')
  assertSafeKey(registration.registrationId, 'Voice reference registration ID')
  if (!/^[a-f0-9]{64}$/.test(registration.generationId)) throw UsageError('Voice reference generation ID must be a SHA-256 digest.')
  return join(paths.referencesRoot, voiceSubjectArtifactKey(registration.subjectKey), registration.provider, registration.registrationId, registration.generationId)
}

const writeRegistrationArtifacts = async (
  paths: CharacterVoiceRegistryPaths,
  registration: VoiceRegistration,
  audition?: VoiceAuditionManifest | undefined
): Promise<void> => {
  const root = referenceGenerationRoot(paths, registration)
  if (audition) await writeCreateOnlyJson(join(root, 'audition-manifest.json'), audition)
  await writeCreateOnlyJson(join(root, 'registration-snapshot.json'), registration)
}

const registrationWithComputedGeneration = (registration: VoiceRegistration): VoiceRegistration => ({
  ...registration,
  generationId: hashCanonicalRecordWithout(registration as unknown as Record<string, unknown>, ['generationId'])
} as VoiceRegistration)

const priorAuditionId = (registration: VoiceRegistration): string | undefined => {
  if (registration.approval.state === 'approved' || registration.approval.state === 'auditioned') return registration.approval.auditionId
  if (registration.approval.state === 'retired' || registration.approval.state === 'revoked') return registration.approval.priorAuditionId
  return undefined
}

const withoutApprovedAudition = (registration: VoiceRegistration): Omit<VoiceRegistration, 'approvedAuditionId'> => {
  const { approvedAuditionId: _approvedAuditionId, ...rest } = registration
  return rest
}

const removeCurrentSelectionUnlocked = async (
  paths: CharacterVoiceRegistryPaths,
  current: CurrentVoiceRegistrationIndex,
  registration: VoiceRegistration,
  at: string
): Promise<CurrentVoiceRegistrationIndex> => {
  const selections = current.selections.filter(selection => !(
    selection.subjectKey === registration.subjectKey
    && selection.provider === registration.provider
    && selection.providerModel === registration.providerModel
    && selection.profileKey === registration.profileKey
    && selection.registrationId === registration.registrationId
    && selection.generationId === registration.generationId
  ))
  if (selections.length === current.selections.length) return current
  const next: CurrentVoiceRegistrationIndex = { schemaVersion: 2, revision: current.revision + 1, selections }
  validateCurrentVoiceRegistrationIndex(next)
  await atomicWriteJson(paths.current, next)
  void at
  return next
}

export const recordVoiceProvisioningOutcome = async (input: {
  charactersRoot: string
  registrationId: string
  generationId: string
  provisioning: VoiceProvisioningState
  sanitizedProviderMetadata?: VoiceRegistration['sanitizedProviderMetadata'] | undefined
  recordedAt?: string | undefined
}): Promise<VoiceRegistration> => await withCharacterVoiceRegistryLock(input.charactersRoot, async () => {
  const paths = resolveCharacterVoiceRegistryPaths(input.charactersRoot)
  let catalog = await loadVoiceRegistrationCatalog(input.charactersRoot)
  const source = catalog.registrations.find(registration => registration.registrationId === input.registrationId && registration.generationId === input.generationId)
  if (!source) throw UsageError('Voice provisioning source registration generation was not found.')
  const existingSuccessor = catalog.registrations.find(registration => registration.registrationId === source.registrationId && registration.priorGenerationId === source.generationId)
  if (existingSuccessor) {
    if (canonicalTtsJson(existingSuccessor.provisioning) === canonicalTtsJson(input.provisioning)) return existingSuccessor
    throw UsageError('Voice provisioning generation already has a different append-preserved successor.')
  }
  const recordedAt = input.recordedAt ?? new Date().toISOString()
  const approval = source.approval.state === 'approved' && input.provisioning.state !== 'ready'
    ? { state: 'retired' as const, priorAuditionId: source.approval.auditionId, retiredAt: recordedAt }
    : source.approval
  const base = approval.state === 'approved' ? source : withoutApprovedAudition(source)
  const next = registrationWithComputedGeneration({
    ...base,
    generationId: source.generationId,
    priorGenerationId: source.generationId,
    approval,
    ...(approval.state === 'approved' ? { approvedAuditionId: approval.auditionId } : {}),
    provisioning: input.provisioning,
    sanitizedProviderMetadata: { ...source.sanitizedProviderMetadata, ...(input.sanitizedProviderMetadata ?? {}) },
    updatedAt: recordedAt
  } as VoiceRegistration)
  if (source.approval.state === 'approved' && input.provisioning.state !== 'ready') {
    const current = await loadCurrentVoiceRegistrationIndex(input.charactersRoot, catalog)
    await removeCurrentSelectionUnlocked(paths, current, source, recordedAt)
  }
  catalog = await appendRegistrationUnlocked(paths, catalog, next)
  return next
})

export const transitionVoiceRegistrationLifecycle = async (input: {
  charactersRoot: string
  registrationId: string
  generationId: string
  action: 'retire' | 'revoke' | 'delete'
  reason?: string | undefined
  transitionedAt?: string | undefined
}): Promise<VoiceRegistration> => await withCharacterVoiceRegistryLock(input.charactersRoot, async () => {
  const paths = resolveCharacterVoiceRegistryPaths(input.charactersRoot)
  let catalog = await loadVoiceRegistrationCatalog(input.charactersRoot)
  const source = catalog.registrations.find(registration => registration.registrationId === input.registrationId && registration.generationId === input.generationId)
  if (!source) throw UsageError('Voice lifecycle source registration generation was not found.')
  if (input.action === 'revoke' && !input.reason?.trim()) throw UsageError('Voice revocation requires a reason.')
  if (input.action === 'delete' && source.provisioning.state !== 'ready') throw UsageError('Voice deletion requires a ready provider resource generation.')
  const at = input.transitionedAt ?? new Date().toISOString()
  const auditionId = priorAuditionId(source)
  const approval = input.action === 'revoke'
    ? { state: 'revoked' as const, ...(auditionId ? { priorAuditionId: auditionId } : {}), revokedAt: at, reason: input.reason!.trim() }
    : { state: 'retired' as const, ...(auditionId ? { priorAuditionId: auditionId } : {}), retiredAt: at }
  const provisioning: VoiceProvisioningState = input.action === 'delete' && source.provisioning.state === 'ready'
    ? { state: 'deleted', providerVoice: source.provisioning.providerVoice, deletedAt: at }
    : source.provisioning
  const cleanupState = input.action === 'delete'
    ? { state: 'deleted' as const, deletedAt: at }
    : input.action === 'revoke' && source.retention.protectedAssets === 'delete-on-revocation'
      ? { state: 'deletion-required' as const, reason: 'Voice registration or consent was revoked.', requiredAt: at }
      : source.cleanupState
  const next = registrationWithComputedGeneration({
    ...withoutApprovedAudition(source),
    generationId: source.generationId,
    priorGenerationId: source.generationId,
    approval,
    provisioning,
    cleanupState,
    updatedAt: at
  } as VoiceRegistration)
  const current = await loadCurrentVoiceRegistrationIndex(input.charactersRoot, catalog)
  await removeCurrentSelectionUnlocked(paths, current, source, at)
  catalog = await appendRegistrationUnlocked(paths, catalog, next)
  return next
})

export const beginVoiceRegistrationDeletion = async (input: {
  charactersRoot: string
  registrationId: string
  generationId: string
  requestedAt?: string | undefined
}): Promise<VoiceRegistration> => await withCharacterVoiceRegistryLock(input.charactersRoot, async () => {
  const paths = resolveCharacterVoiceRegistryPaths(input.charactersRoot)
  let catalog = await loadVoiceRegistrationCatalog(input.charactersRoot)
  const source = catalog.registrations.find(registration => registration.registrationId === input.registrationId && registration.generationId === input.generationId)
  if (!source) throw UsageError('Voice deletion source registration generation was not found.')
  if (source.provisioning.state !== 'ready' || source.provisioning.providerVoice.kind !== 'remote-resource') throw UsageError('Voice deletion requires a ready remote provider resource.')
  if (source.provisioning.providerVoice.ownership !== 'project' || source.provisioning.providerVoice.deletion.state !== 'eligible') {
    throw UsageError('Voice deletion is allowed only for an eligibility-checked project-owned resource.')
  }
  const sourceVoice = source.provisioning.providerVoice
  const current = await loadCurrentVoiceRegistrationIndex(input.charactersRoot, catalog)
  const sharedCurrent = current.selections
    .filter(selection => selection.registrationId !== source.registrationId || selection.generationId !== source.generationId)
    .map(selection => catalog.registrations.find(registration => registration.registrationId === selection.registrationId && registration.generationId === selection.generationId))
    .find((registration) => registration?.provisioning.state === 'ready'
      && registration.provisioning.providerVoice.kind === 'remote-resource'
      && registration.provisioning.providerVoice.provider === sourceVoice.provider
      && registration.provisioning.providerVoice.resourceId === sourceVoice.resourceId)
  if (sharedCurrent) throw UsageError(`Voice deletion is blocked because current registration ${sharedCurrent.registrationId} shares the same provider resource.`)
  const at = input.requestedAt ?? new Date().toISOString()
  const auditionId = priorAuditionId(source)
  const pending = registrationWithComputedGeneration({
    ...withoutApprovedAudition(source),
    generationId: source.generationId,
    priorGenerationId: source.generationId,
    approval: { state: 'retired', ...(auditionId ? { priorAuditionId: auditionId } : {}), retiredAt: at },
    cleanupState: { state: 'deletion-pending', requestedAt: at },
    updatedAt: at
  } as VoiceRegistration)
  await removeCurrentSelectionUnlocked(paths, current, source, at)
  catalog = await appendRegistrationUnlocked(paths, catalog, pending)
  return pending
})

export const recordVoiceAudition = async (input: {
  charactersRoot: string
  registrationId: string
  generationId: string
  audition: VoiceAuditionManifest
  recordedAt?: string | undefined
}): Promise<VoiceRegistration> => await withCharacterVoiceRegistryLock(input.charactersRoot, async () => {
  validateVoiceAuditionManifest(input.audition)
  const paths = resolveCharacterVoiceRegistryPaths(input.charactersRoot)
  let catalog = await loadVoiceRegistrationCatalog(input.charactersRoot)
  const source = catalog.registrations.find(registration => registration.registrationId === input.registrationId && registration.generationId === input.generationId)
  if (!source) throw UsageError('Voice audition source registration generation was not found.')
  if (source.provisioning.state !== 'ready') throw UsageError('Voice audition requires a ready provisioned registration.')
  if (source.approval.state !== 'draft') throw UsageError('Voice audition can be recorded only from a draft registration generation.')
  if (input.audition.registrationDraftId !== source.registrationId
    || input.audition.provider !== source.provider
    || input.audition.providerModel !== source.providerModel
    || input.audition.capabilityFixtureHash !== source.capabilityFixtureHash
    || input.audition.settingsSchema !== source.settingsSchema
    || canonicalTtsJson(input.audition.synthesisSettings) !== canonicalTtsJson(source.synthesisSettings)
    || canonicalTtsJson(input.audition.providerVoice) !== canonicalTtsJson(source.provisioning.providerVoice)) {
    throw UsageError('Voice audition does not bind the exact draft registration, provider target, settings, capability fixture, and provider voice.')
  }
  const next = registrationWithComputedGeneration({
    ...source,
    generationId: source.generationId,
    priorGenerationId: source.generationId,
    approval: { state: 'auditioned', auditionId: input.audition.auditionId },
    updatedAt: input.recordedAt ?? new Date().toISOString()
  })
  catalog = await appendRegistrationUnlocked(paths, catalog, next)
  await writeRegistrationArtifacts(paths, next, input.audition)
  return next
})

export const approveVoiceRegistration = async (
  input: ApproveVoiceRegistrationInput
): Promise<VoiceRegistration> => await withCharacterVoiceRegistryLock(input.charactersRoot, async () => {
  validateVoiceAuditionManifest(input.audition)
  validateAuditActorRef(input.approvedBy)
  const paths = resolveCharacterVoiceRegistryPaths(input.charactersRoot)
  let catalog = await loadVoiceRegistrationCatalog(input.charactersRoot)
  const current = await loadCurrentVoiceRegistrationIndex(input.charactersRoot, catalog)
  if (current.revision !== input.expectedIndexRevision) throw UsageError(`Current voice index changed; expected revision ${input.expectedIndexRevision}, found ${current.revision}.`)
  const source = catalog.registrations.find(registration => registration.registrationId === input.registrationId && registration.generationId === input.generationId)
  if (!source) throw UsageError('Voice approval source registration generation was not found.')
  if (source.provisioning.state !== 'ready' || source.approval.state !== 'auditioned') throw UsageError('Voice approval requires a ready, auditioned registration generation.')
  if (source.consentRecordRef) {
    if (!input.consent || input.consent.subjectKey !== source.subjectKey) throw UsageError('Consent-bound voice approval requires the current protected consent record for the same subject.')
    assertVoiceConsentAllows(input.consent, 'new-synthesis')
  }
  if (source.approval.auditionId !== input.audition.auditionId || input.audition.registrationDraftId !== source.registrationId) throw UsageError('Voice approval audition does not match the exact registration generation.')
  const selectionKey = `${source.subjectKey}\0${source.provider}\0${source.providerModel}\0${source.profileKey}`
  const priorSelection = current.selections.find(selection => `${selection.subjectKey}\0${selection.provider}\0${selection.providerModel}\0${selection.profileKey}` === selectionKey)
  if (input.expectedCurrentGenerationId !== priorSelection?.generationId) throw UsageError('Current voice generation changed during approval.')
  const approvedAt = input.approvedAt ?? new Date().toISOString()
  const approvedInput: VoiceRegistration = {
    ...source,
    generationId: source.generationId,
    priorGenerationId: source.generationId,
    provisioning: { state: 'ready', providerVoice: source.provisioning.providerVoice },
    approval: { state: 'approved', auditionId: input.audition.auditionId, approvedAt, approvedBy: input.approvedBy },
    approvedAuditionId: input.audition.auditionId,
    updatedAt: approvedAt
  }
  const approved = registrationWithComputedGeneration(approvedInput)
  validateVoiceRegistration(approved)

  await writeRegistrationArtifacts(paths, approved, input.audition)
  catalog = await appendRegistrationUnlocked(paths, catalog, approved)
  const nextSelection = {
    subjectKey: approved.subjectKey,
    provider: approved.provider,
    providerModel: approved.providerModel,
    profileKey: approved.profileKey,
    registrationId: approved.registrationId,
    generationId: approved.generationId,
    updatedAt: approvedAt
  }
  const nextIndex: CurrentVoiceRegistrationIndex = {
    schemaVersion: 2,
    revision: current.revision + 1,
    selections: [...current.selections.filter(selection => `${selection.subjectKey}\0${selection.provider}\0${selection.providerModel}\0${selection.profileKey}` !== selectionKey), nextSelection]
  }
  validateCurrentVoiceRegistrationIndex(nextIndex, catalog)
  await atomicWriteJson(paths.current, nextIndex)
  return approved
})

export const resolveRegistrationGeneration = async (
  charactersRoot: string,
  registrationId: string,
  requestedGenerationId?: string
): Promise<VoiceRegistration> => {
  const catalog = await loadVoiceRegistrationCatalog(charactersRoot)
  if (requestedGenerationId) {
    const registration = catalog.registrations.find(entry => entry.registrationId === registrationId && entry.generationId === requestedGenerationId)
    if (!registration) throw UsageError('Voice registration generation was not found.')
    return registration
  }
  const matches = catalog.registrations.filter(entry => entry.registrationId === registrationId)
  if (matches.length === 0) throw UsageError('Voice registration generation was not found.')
  const current = await loadCurrentVoiceRegistrationIndex(charactersRoot, catalog)
  const currentGenerationIds = [...new Set(current.selections.filter(entry => entry.registrationId === registrationId).map(entry => entry.generationId))]
  if (currentGenerationIds.length === 1) {
    const currentMatch = matches.find(entry => entry.generationId === currentGenerationIds[0])
    if (currentMatch) return currentMatch
  }
  if (currentGenerationIds.length > 1) {
    throw UsageError(`Voice registration ${registrationId} has multiple matching generations: ${[...currentGenerationIds].sort().join(', ')}. Pass --generation-id.`)
  }
  const [sole] = matches
  if (matches.length === 1 && sole) return sole
  const successorIds = new Set(matches.flatMap(entry => entry.priorGenerationId ? [entry.priorGenerationId] : []))
  const tips = matches.filter(entry => !successorIds.has(entry.generationId))
  const [tip] = tips
  if (tips.length === 1 && tip) return tip
  throw UsageError(`Voice registration ${registrationId} has multiple matching generations: ${matches.map(entry => entry.generationId).sort().join(', ')}. Pass --generation-id.`)
}

export const requireCurrentVoiceRegistration = async (
  charactersRoot: string,
  subjectKey: string,
  provider: VoiceRegistration['provider'],
  providerModel: string,
  profileKey: string
): Promise<VoiceRegistration> => {
  const catalog = await loadVoiceRegistrationCatalog(charactersRoot)
  const current = await loadCurrentVoiceRegistrationIndex(charactersRoot, catalog)
  const selection = current.selections.find(entry => entry.subjectKey === subjectKey && entry.provider === provider && entry.providerModel === providerModel && entry.profileKey === profileKey)
  if (!selection) throw InfraError(`No approved current ${provider}/${providerModel}/${profileKey} voice is registered for ${subjectKey}.`, { stage: 'comic:voice-registry' })
  const registration = catalog.registrations.find(entry => entry.registrationId === selection.registrationId && entry.generationId === selection.generationId)
  if (!registration || registration.approval.state !== 'approved' || registration.provisioning.state !== 'ready') {
    throw ValidationError('Current voice index does not resolve to an approved ready registration.', { stage: 'comic:voice-registry' })
  }
  return registration
}

export const loadVoiceAuditionManifestForRegistration = async (
  charactersRoot: string,
  registrationId: string,
  generationId: string
): Promise<VoiceAuditionManifest> => {
  const catalog = await loadVoiceRegistrationCatalog(charactersRoot)
  const registration = catalog.registrations.find(entry => entry.registrationId === registrationId && entry.generationId === generationId)
  if (!registration) throw InfraError('Voice registration generation was not found for its audition manifest.', { stage: 'comic:voice-registry' })
  const path = join(referenceGenerationRoot(resolveCharacterVoiceRegistryPaths(charactersRoot), registration), 'audition-manifest.json')
  const value = await readJson(path)
  try {
    return validateVoiceAuditionManifest(value as VoiceAuditionManifest)
  } catch (error) {
    throw ValidationError(`Invalid voice audition manifest at ${path}: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:voice-registry', ...(error instanceof Error ? { cause: error } : {}) })
  }
}
