import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CharacterVoiceBrief, ProtectedAssetRef, VoiceAuditionManifest } from '~/types'
import {
  approveVoiceRegistration,
  loadCurrentVoiceRegistrationIndex,
  loadVoiceRegistrationCatalog,
  recordVoiceAudition,
  resolveCharacterVoiceRegistryPaths,
  transitionVoiceRegistrationLifecycle,
  writeCharacterVoiceBriefCatalog,
} from '~/cli/commands/process-steps/step-4-tts/voice-management/character-voice-registry'
import { buildReadyVoiceRegistrationDraft } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-registration-management'
import { computeVoiceAuditionId } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-management-contracts'
import { validateVoiceRegistration } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-management-contracts'

const roots: string[] = []
const makeRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-voice-phase1-'))
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

const auditionFor = (registrationId: string, providerVoice: VoiceAuditionManifest['providerVoice']): VoiceAuditionManifest => {
  const item = (itemId: string, category: VoiceAuditionManifest['items'][number]['category']) => ({
    itemId, category, canonicalText: `${category} text`, providerText: `${category} text`,
    takes: [{ takeId: `${itemId}-1`, protectedAudio, sha256: protectedAudio.sha256, cost: { amounts: [] }, warnings: [] }],
    selectedTakeId: `${itemId}-1`
  })
  const withoutId = {
    schemaVersion: 1 as const,
    registrationDraftId: registrationId,
    provider: 'openai' as const,
    providerModel: 'gpt-4o-mini-tts-2025-12-15',
    providerVoice,
    capabilityFixtureHash: 'b'.repeat(64),
    settingsSchema: 'openai.voice-defaults.v1',
    synthesisSettings: { schemaVersion: 1 as const, settingsSchema: 'openai.voice-defaults.v1', values: {} },
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
    const audition = auditionFor(draft.registrationId, providerVoice)
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
    const audition = auditionFor(draft.registrationId, providerVoice)
    const auditioned = await recordVoiceAudition({ charactersRoot: root, registrationId: draft.registrationId, generationId: draft.generationId, audition })
    await approveVoiceRegistration({ charactersRoot: root, registrationId: draft.registrationId, generationId: auditioned.generationId, audition, approvedBy: { namespace: 'local-user', actorId: 'editor_one' }, expectedIndexRevision: 0 })
    await expect(approveVoiceRegistration({ charactersRoot: root, registrationId: draft.registrationId, generationId: auditioned.generationId, audition, approvedBy: { namespace: 'local-user', actorId: 'editor_two' }, expectedIndexRevision: 0 })).rejects.toThrow('expected revision 0, found 1')
  })

  test('canonical audition validation rejects approval without required comparison coverage', async () => {
    const root = await makeRoot()
    const providerVoice = {
      kind: 'remote-resource' as const, provider: 'openai' as const, resourceId: 'cedar', namespace: 'provider' as const,
      origin: 'provider-stock' as const, ownership: 'provider' as const,
      deletion: { state: 'provider-managed' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
    }
    const draft = buildReadyVoiceRegistrationDraft({ subjectKey: 'hero', profileKey: 'default', provider: 'openai', providerModel: 'gpt-4o-mini-tts-2025-12-15', providerVoice, brief, provenanceRef: 'project:casting', capabilityFixtureHash: 'b'.repeat(64) })
    const incomplete = auditionFor(draft.registrationId, providerVoice)
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
    const audition = auditionFor(draft.registrationId, providerVoice)
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
