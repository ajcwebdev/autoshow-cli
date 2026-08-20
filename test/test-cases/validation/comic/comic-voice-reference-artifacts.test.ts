import { afterEach, describe, expect, test } from 'bun:test'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { CharacterVoiceBrief, ProtectedAssetRef, VoiceAuditionManifest, VoiceRegistration } from '~/types'
import {
  approveVoiceRegistration,
  beginVoiceRegistrationDeletion,
  loadCurrentVoiceRegistrationIndex,
  loadVoiceRegistrationCatalog,
  recordVoiceAudition,
  requireCurrentVoiceRegistration,
  resolveCharacterVoiceRegistryPaths,
  transitionVoiceRegistrationLifecycle,
  writeCharacterVoiceBriefCatalog,
} from '~/cli/commands/process-steps/step-4-tts/voice-management/character-voice-registry'
import { buildReadyVoiceRegistrationDraft } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-registration-management'
import { computeVoiceAuditionId } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-management-contracts'
import { validateVoiceRegistration } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-management-contracts'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const roots: string[] = []
const makeRoot = async (): Promise<string> => {
  const root = await makeTempDir('autoshow-comic-voice-phase1-')
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

const brief: CharacterVoiceBrief = {
  subjectKey: 'hero', profileKey: 'default', language: 'en', locale: 'en-US',
  timbre: 'warm and grounded', mannerisms: ['measured pauses'], prohibitedCaricatures: ['exaggerated regional stereotype'],
  pronunciations: [{ term: 'Asterion', pronunciation: 'as-TEER-ee-on' }], allowedOrigins: ['provider-stock', 'saved-reference']
}

const protectedAudio: ProtectedAssetRef = {
  storeId: 'managed_voice_assets_v1', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64)
}

const auditionFor = (registration: VoiceRegistration): VoiceAuditionManifest => {
  if (registration.provisioning.state !== 'ready') throw new Error('Test registration must be ready.')
  const item = (itemId: string, category: VoiceAuditionManifest['items'][number]['category']) => ({
    itemId, category, canonicalText: `${category} text`, providerText: `${category} text`,
    takes: [{ takeId: `${itemId}-1`, protectedAudio, sha256: protectedAudio.sha256, cost: { amounts: [] }, warnings: [] }],
    selectedTakeId: `${itemId}-1`
  })
  const withoutId = {
    schemaVersion: 1 as const,
    registrationDraftId: registration.registrationId,
    provider: registration.provider,
    providerModel: registration.providerModel,
    providerVoice: registration.provisioning.providerVoice,
    capabilityFixtureHash: registration.capabilityFixtureHash,
    settingsSchema: registration.settingsSchema,
    synthesisSettings: registration.synthesisSettings,
    items: [item('neutral', 'neutral'), item('representative', 'representative'), item('pronunciation', 'pronunciation'), item('comparison', 'comparison')],
    plannedCost: { amounts: [] }, warnings: [], createdAt: '2026-08-11T00:00:00.000Z'
  }
  return { ...withoutId, auditionId: computeVoiceAuditionId(withoutId) }
}

describe('Phase 1 comic voice reference artifacts', () => {
  test('briefs remain separate from the visual catalog and approvals append generations atomically', async () => {
    const root = await makeRoot()
    await writeCharacterVoiceBriefCatalog(root, { schemaVersion: 1, briefs: [brief] })
    const providerVoice = {
      kind: 'remote-resource' as const, provider: 'openai' as const, resourceId: 'cedar', namespace: 'provider' as const,
      origin: 'provider-stock' as const, ownership: 'provider' as const,
      deletion: { state: 'provider-managed' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
    }
    const draft = buildReadyVoiceRegistrationDraft({
      subjectKey: 'hero', profileKey: 'default', provider: 'openai', providerModel: 'gpt-4o-mini-tts-2025-12-15',
      providerVoice, brief, provenanceRef: 'project:casting', capabilityFixtureHash: 'b'.repeat(64), createdAt: '2026-08-11T00:00:00.000Z'
    })
    const { appendVoiceRegistration } = await import('~/cli/commands/process-steps/step-4-tts/voice-management/character-voice-registry')
    await appendVoiceRegistration(root, draft)
    const audition = auditionFor(draft)
    const auditioned = await recordVoiceAudition({ charactersRoot: root, registrationId: draft.registrationId, generationId: draft.generationId, audition, recordedAt: '2026-08-11T00:01:00.000Z' })
    const approved = await approveVoiceRegistration({
      charactersRoot: root, registrationId: draft.registrationId, generationId: auditioned.generationId, audition,
      approvedBy: { namespace: 'local-user', actorId: 'casting_editor' }, expectedIndexRevision: 0, approvedAt: '2026-08-11T00:02:00.000Z'
    })

    const catalog = await loadVoiceRegistrationCatalog(root)
    expect(catalog.registrations.map(entry => entry.approval.state)).toEqual(['draft', 'auditioned', 'approved'])
    expect(catalog.registrations.map(entry => entry.generationId)).toEqual([draft.generationId, auditioned.generationId, approved.generationId])
    expect(new Set(catalog.registrations.map(entry => entry.generationId)).size).toBe(3)
    const current = await loadCurrentVoiceRegistrationIndex(root, catalog)
    expect(current.revision).toBe(1)
    expect(current.selections).toEqual([expect.objectContaining({ subjectKey: 'hero', provider: 'openai', profileKey: 'default', generationId: approved.generationId })])

    const paths = resolveCharacterVoiceRegistryPaths(root)
    const ordinaryBytes = [
      await readFile(paths.briefs, 'utf8'), await readFile(paths.registrations, 'utf8'), await readFile(paths.current, 'utf8')
    ].join('\n')
    expect(ordinaryBytes).not.toContain('/protected/')
    expect(ordinaryBytes).not.toContain('@')
    const auditionPath = join(paths.referencesRoot, 'hero', 'openai', approved.registrationId, approved.generationId, 'audition-manifest.json')
    expect(await Bun.file(auditionPath).exists()).toBe(true)
    expect(await readFile(auditionPath, 'utf8')).toContain(protectedAudio.assetId)
    expect(await Bun.file(join(paths.referencesRoot, 'hero', 'openai', approved.registrationId, approved.generationId, 'registration-snapshot.json')).exists()).toBe(true)
  })

  test('stale current-index approval cannot replace a newer approved generation', async () => {
    const root = await makeRoot()
    await writeCharacterVoiceBriefCatalog(root, { schemaVersion: 1, briefs: [brief] })
    const providerVoice = {
      kind: 'remote-resource' as const, provider: 'openai' as const, resourceId: 'cedar', namespace: 'provider' as const,
      origin: 'provider-stock' as const, ownership: 'provider' as const,
      deletion: { state: 'provider-managed' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
    }
    const draft = buildReadyVoiceRegistrationDraft({ subjectKey: 'hero', profileKey: 'default', provider: 'openai', providerModel: 'gpt-4o-mini-tts-2025-12-15', providerVoice, brief, provenanceRef: 'project:casting', capabilityFixtureHash: 'b'.repeat(64) })
    const { appendVoiceRegistration } = await import('~/cli/commands/process-steps/step-4-tts/voice-management/character-voice-registry')
    await appendVoiceRegistration(root, draft)
    const audition = auditionFor(draft)
    const auditioned = await recordVoiceAudition({ charactersRoot: root, registrationId: draft.registrationId, generationId: draft.generationId, audition })
    await approveVoiceRegistration({ charactersRoot: root, registrationId: draft.registrationId, generationId: auditioned.generationId, audition, approvedBy: { namespace: 'local-user', actorId: 'editor_one' }, expectedIndexRevision: 0 })
    await expect(approveVoiceRegistration({ charactersRoot: root, registrationId: draft.registrationId, generationId: auditioned.generationId, audition, approvedBy: { namespace: 'local-user', actorId: 'editor_two' }, expectedIndexRevision: 0 })).rejects.toThrow('expected revision 0, found 1')
  })

  test('model-qualified current selections coexist for one shared Hume resource and block unsafe deletion', async () => {
    const root = await makeRoot()
    const humeBrief: CharacterVoiceBrief = { ...brief, allowedOrigins: ['designed'] }
    await writeCharacterVoiceBriefCatalog(root, { schemaVersion: 1, briefs: [humeBrief] })
    const providerVoice = {
      kind: 'remote-resource' as const, provider: 'hume' as const, resourceId: 'shared-hume-voice', namespace: 'account' as const, accountScopeHash: 'c'.repeat(64),
      origin: 'designed' as const, ownership: 'project' as const,
      deletion: { state: 'eligible' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
    }
    const { appendVoiceRegistration } = await import('~/cli/commands/process-steps/step-4-tts/voice-management/character-voice-registry')
    let expectedIndexRevision = 0
    for (const providerModel of ['octave-1', 'octave-2']) {
      const draft = buildReadyVoiceRegistrationDraft({ subjectKey: 'hero', profileKey: 'default', provider: 'hume', providerModel, providerVoice, brief: humeBrief, provenanceRef: 'project:casting', capabilityFixtureHash: 'b'.repeat(64) })
      await appendVoiceRegistration(root, draft)
      const audition = auditionFor(draft)
      const auditioned = await recordVoiceAudition({ charactersRoot: root, registrationId: draft.registrationId, generationId: draft.generationId, audition })
      await approveVoiceRegistration({ charactersRoot: root, registrationId: draft.registrationId, generationId: auditioned.generationId, audition, approvedBy: { namespace: 'local-user', actorId: 'editor' }, expectedIndexRevision })
      expectedIndexRevision += 1
    }

    const catalog = await loadVoiceRegistrationCatalog(root)
    const current = await loadCurrentVoiceRegistrationIndex(root, catalog)
    expect(current.schemaVersion).toBe(2)
    expect(current.selections.map(selection => selection.providerModel).sort()).toEqual(['octave-1', 'octave-2'])
    const octave1 = await requireCurrentVoiceRegistration(root, 'hero', 'hume', 'octave-1', 'default')
    const octave2 = await requireCurrentVoiceRegistration(root, 'hero', 'hume', 'octave-2', 'default')
    expect(octave1.registrationId).not.toBe(octave2.registrationId)
    await expect(beginVoiceRegistrationDeletion({ charactersRoot: root, registrationId: octave1.registrationId, generationId: octave1.generationId })).rejects.toThrow('shares the same provider resource')
  })

  test('canonical audition validation rejects approval without required comparison coverage', async () => {
    const root = await makeRoot()
    const providerVoice = {
      kind: 'remote-resource' as const, provider: 'openai' as const, resourceId: 'cedar', namespace: 'provider' as const,
      origin: 'provider-stock' as const, ownership: 'provider' as const,
      deletion: { state: 'provider-managed' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
    }
    const draft = buildReadyVoiceRegistrationDraft({ subjectKey: 'hero', profileKey: 'default', provider: 'openai', providerModel: 'gpt-4o-mini-tts-2025-12-15', providerVoice, brief, provenanceRef: 'project:casting', capabilityFixtureHash: 'b'.repeat(64) })
    const incomplete = auditionFor(draft)
    incomplete.items = incomplete.items.filter(item => item.category !== 'comparison')
    await expect(recordVoiceAudition({ charactersRoot: root, registrationId: draft.registrationId, generationId: draft.generationId, audition: incomplete })).rejects.toThrow('invalid auditionId')
  })

  test('revocation appends a tombstone generation and removes the approved current selection', async () => {
    const root = await makeRoot()
    await writeCharacterVoiceBriefCatalog(root, { schemaVersion: 1, briefs: [brief] })
    const providerVoice = {
      kind: 'remote-resource' as const, provider: 'openai' as const, resourceId: 'cedar', namespace: 'provider' as const,
      origin: 'provider-stock' as const, ownership: 'provider' as const,
      deletion: { state: 'provider-managed' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
    }
    const draft = buildReadyVoiceRegistrationDraft({ subjectKey: 'hero', profileKey: 'default', provider: 'openai', providerModel: 'gpt-4o-mini-tts-2025-12-15', providerVoice, brief, provenanceRef: 'project:casting', capabilityFixtureHash: 'b'.repeat(64) })
    const { appendVoiceRegistration } = await import('~/cli/commands/process-steps/step-4-tts/voice-management/character-voice-registry')
    await appendVoiceRegistration(root, draft)
    const audition = auditionFor(draft)
    const auditioned = await recordVoiceAudition({ charactersRoot: root, registrationId: draft.registrationId, generationId: draft.generationId, audition })
    const approved = await approveVoiceRegistration({ charactersRoot: root, registrationId: draft.registrationId, generationId: auditioned.generationId, audition, approvedBy: { namespace: 'local-user', actorId: 'editor' }, expectedIndexRevision: 0 })
    const revoked = await transitionVoiceRegistrationLifecycle({ charactersRoot: root, registrationId: approved.registrationId, generationId: approved.generationId, action: 'revoke', reason: 'Authorization withdrawn', transitionedAt: '2026-08-11T02:00:00.000Z' })
    expect(revoked.approval.state).toBe('revoked')
    expect(revoked.cleanupState.state).toBe('deletion-required')
    const catalog = await loadVoiceRegistrationCatalog(root)
    expect(catalog.registrations).toHaveLength(4)
    expect((await loadCurrentVoiceRegistrationIndex(root, catalog)).selections).toEqual([])
  })

  test('registration generation identity rejects mutated lifecycle bytes', () => {
    const providerVoice = {
      kind: 'remote-resource' as const, provider: 'openai' as const, resourceId: 'cedar', namespace: 'provider' as const,
      origin: 'provider-stock' as const, ownership: 'provider' as const,
      deletion: { state: 'provider-managed' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
    }
    const draft = buildReadyVoiceRegistrationDraft({ subjectKey: 'hero', profileKey: 'default', provider: 'openai', providerModel: 'gpt-4o-mini-tts-2025-12-15', providerVoice, brief, provenanceRef: 'project:casting', capabilityFixtureHash: 'b'.repeat(64), createdAt: '2026-08-11T00:00:00.000Z' })
    expect(() => validateVoiceRegistration({ ...draft, updatedAt: '2026-08-11T03:00:00.000Z' })).toThrow('invalid generationId')
  })
})
