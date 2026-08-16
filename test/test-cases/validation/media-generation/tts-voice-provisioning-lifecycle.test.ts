import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CharacterVoiceBrief, ProtectedAssetRef, ProviderVoiceRef, VoiceConsentRecord, VoiceProvisioningAttempt } from '~/types'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import { assertProtectedStoreOutputDisjoint } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-output-boundary'
import { computeConsentRecordId, assertVoiceConsentAllows, computeVoiceCandidateId, validateVoiceCandidate } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-management-contracts'
import { runCrashSafeVoiceProvisioning, loadVoiceProvisioningAttempt, reconcileVoiceProvisioningAttempt } from '~/cli/commands/process-steps/step-4-tts/voice-management/provisioning-journal'
import { createMistralSavedVoice, deleteMistralSavedVoice } from '~/cli/commands/process-steps/step-4-tts/voice-management/mistral-voice-management'
import type { MistralVoiceManagementRequest } from '~/cli/commands/process-steps/step-4-tts/voice-management/mistral-voice-management'
import { loadVoiceConsentRecord, revokeVoiceConsentRecord, storeVoiceConsentRecord } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-consent-store'
import { provisionMistralSavedReferenceRegistration } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-registration-management'
import { loadVoiceRegistrationCatalog } from '~/cli/commands/process-steps/step-4-tts/voice-management/character-voice-registry'
import { ProviderError } from '~/utils/error-handler'

const roots: string[] = []
const makeRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-voice-phase1-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

const asset = (letter: string): ProtectedAssetRef => ({
  storeId: 'test_voice_store', assetId: `sha256_${letter.repeat(64)}`, sha256: letter.repeat(64)
})

const providerVoice = (id: string): Extract<ProviderVoiceRef, { kind: 'remote-resource' }> => ({
  kind: 'remote-resource', provider: 'mistral', resourceId: id, namespace: 'account', accountScopeHash: 'c'.repeat(64),
  origin: 'saved-reference', ownership: 'project', deletion: { state: 'eligible', checkedAt: '2026-08-11T00:00:00.000Z' }
})

const attempt = (attemptId: string, draftId = 'vr_test'): VoiceProvisioningAttempt => ({
  schemaVersion: 1,
  attemptId,
  registrationDraftId: draftId,
  operation: 'save-reference',
  accountScopeHash: 'c'.repeat(64),
  lockLeaseId: `lease_${attemptId}`,
  requestFingerprint: 'd'.repeat(64),
  protectedRequestEvidence: asset('a'),
  reconciliation: { strategy: 'provider-search', providerHandle: attemptId, protectedLookupEvidence: asset('b') },
  transitions: [{ sequence: 1, phase: 'prepared', at: '2026-08-11T00:00:00.000Z' }],
  issuedResources: [],
  compareAndSwapVersion: 0
})

describe('Phase 1 protected voice assets and consent', () => {
  test('managed assets retain purpose policy, owner-only permissions, and disposable workspaces', async () => {
    const root = await makeRoot()
    const source = join(root, 'private-sample.wav')
    const storeRoot = join(root, 'protected')
    await Bun.write(source, new Uint8Array([1, 2, 3, 4]))
    const store = createProtectedVoiceAssetStore({ storeId: 'test_voice_store', root: storeRoot })
    const materialized = await store.ingestManaged!({ sourcePath: source, authorizationRef: 'project:performer-release' }, {
      schemaVersion: 1,
      purpose: 'reference-audio',
      authorizationRef: 'project:performer-release',
      retention: { mode: 'retain-until-revoked', obligationRef: 'policy:voice-retention' },
      createdAt: '2026-08-11T00:00:00.000Z'
    })

    expect(JSON.stringify(materialized)).not.toContain(source)
    expect(await store.readPolicies!(materialized.protectedAsset)).toEqual([{
      schemaVersion: 1,
      purpose: 'reference-audio',
      authorizationRef: 'project:performer-release',
      retention: { mode: 'retain-until-revoked', obligationRef: 'policy:voice-retention' },
      createdAt: '2026-08-11T00:00:00.000Z'
    }])
    expect((await stat(await store.resolve(materialized.protectedAsset))).mode & 0o777).toBe(0o600)
    const workspaceValue = await store.withWorkspace!('attempt_one', async workspace => {
      await Bun.write(join(workspace, 'temporary.raw'), 'sensitive')
      return workspace
    })
    expect(await Bun.file(workspaceValue).exists()).toBe(false)
    await expect(assertProtectedStoreOutputDisjoint(join(storeRoot, 'published'), storeRoot)).rejects.toThrow('disjoint')
  })

  test('consent defaults to deny and independently gates synthesis, cache, export, and retention', () => {
    const withoutId = {
      schemaVersion: 1 as const,
      subjectKey: 'hero',
      provenanceRef: 'project:release-7',
      status: 'active' as const,
      grants: [
        { action: 'new-synthesis' as const, allowed: true },
        { action: 'cache-reuse' as const, allowed: false },
        { action: 'export' as const, allowed: false }
      ],
      recordedAt: '2026-08-11T00:00:00.000Z',
      recordedBy: { namespace: 'local-user' as const, actorId: 'casting_editor' }
    }
    const record: VoiceConsentRecord = { ...withoutId, consentRecordId: computeConsentRecordId(withoutId) }
    expect(() => assertVoiceConsentAllows(record, 'new-synthesis')).not.toThrow()
    expect(() => assertVoiceConsentAllows(record, 'cache-reuse')).toThrow('does not permit')
    expect(() => assertVoiceConsentAllows(record, 'retention')).toThrow('does not permit')
    expect(() => assertVoiceConsentAllows(undefined, 'export')).toThrow('defaults to deny')
    const revokedWithoutId = { ...withoutId, status: 'revoked' as const, revokedAt: '2026-08-11T01:00:00.000Z', revocationReason: 'Authorization withdrawn' }
    const revoked: VoiceConsentRecord = { ...revokedWithoutId, consentRecordId: computeConsentRecordId(revokedWithoutId) }
    expect(() => assertVoiceConsentAllows(revoked, 'new-synthesis')).toThrow('revoked')
  })

  test('protected consent revocation blocks the original immutable locator', async () => {
    const root = await makeRoot()
    const store = createProtectedVoiceAssetStore({ storeId: 'test_voice_store', root: join(root, 'protected') })
    const withoutId = {
      schemaVersion: 1 as const,
      subjectKey: 'hero',
      provenanceRef: 'project:release-8',
      status: 'active' as const,
      grants: [{ action: 'new-synthesis' as const, allowed: true }],
      recordedAt: '2026-08-11T00:00:00.000Z',
      recordedBy: { namespace: 'local-user' as const, actorId: 'casting_editor' }
    }
    const record: VoiceConsentRecord = { ...withoutId, consentRecordId: computeConsentRecordId(withoutId) }
    const reference = await storeVoiceConsentRecord(store, record)
    expect((await loadVoiceConsentRecord(store, reference)).consentRecordId).toBe(record.consentRecordId)
    const revocation = await revokeVoiceConsentRecord({
      store,
      reference,
      reason: 'Authorization withdrawn',
      revokedBy: { namespace: 'local-user', actorId: 'casting_editor' },
      revokedAt: '2026-08-11T01:00:00.000Z'
    })
    expect(revocation.consentRecordId).toBe(record.consentRecordId)
    await expect(loadVoiceConsentRecord(store, reference)).rejects.toThrow('all consent-gated actions are denied')
  })

  test('candidate previews and materialization state are content-identified protected primitives', () => {
    const withoutId = {
      schemaVersion: 1 as const,
      registrationDraftId: 'vr_candidate', provider: 'elevenlabs' as const, providerModel: 'eleven_v3',
      operation: 'design' as const, sourceIdentityHash: '3'.repeat(64), previewAssets: [asset('4')],
      plannedCost: { amounts: [{ amount: 0.25, currency: 'USD' }] }, expiryState: 'not-exposed' as const,
      createdAt: '2026-08-11T00:00:00.000Z', materialization: { state: 'not-materialized' as const }
    }
    const candidate = { ...withoutId, candidateId: computeVoiceCandidateId(withoutId) }
    expect(validateVoiceCandidate(candidate)).toEqual(candidate)
    expect(() => validateVoiceCandidate({ ...candidate, providerModel: 'changed-model' })).toThrow('invalid candidateId')
  })
})

describe('Phase 1 provisioning journal', () => {
  test('a definite provider rejection is terminal failed rather than reconciliation-required', async () => {
    const root = await makeRoot()
    let calls = 0
    const run = () => runCrashSafeVoiceProvisioning({
      journalRoot: root,
      attempt: attempt('attempt_rejected'),
      mutate: async () => {
        calls += 1
        throw ProviderError('Provider rejected the voice name.', {
          status: 400,
          headers: new Headers({ 'x-request-id': 'voice-reject-1' }),
          stage: 'voice:create'
        })
      }
    })

    await expect(run()).rejects.toThrow('Provider rejected the voice name.')
    const rejected = await loadVoiceProvisioningAttempt(root, 'vr_test', 'attempt_rejected')
    expect(rejected.outcome).toEqual({ state: 'failed', code: 'HTTP_400', message: 'Provider rejected the voice name.' })
    expect(rejected.transitions.map(entry => entry.phase)).toEqual(['prepared', 'request-sent', 'response-received', 'terminal'])

    const replay = await run()
    expect(replay.outcome?.state).toBe('failed')
    expect(calls).toBe(1)
  })

  test('concurrent jobs share one durable provisioning result and issue one resource', async () => {
    const root = await makeRoot()
    let calls = 0
    const run = () => runCrashSafeVoiceProvisioning({
      journalRoot: root,
      attempt: attempt('attempt_one'),
      mutate: async () => {
        calls++
        await Bun.sleep(10)
        return {
          state: { state: 'ready', providerVoice: providerVoice('voice-one') },
          issuedResources: [{ providerVoice: providerVoice('voice-one'), observedAt: '2026-08-11T00:01:00.000Z', sanitizedResponseHash: 'e'.repeat(64) }],
          evidenceHash: 'e'.repeat(64)
        }
      }
    })
    const [first, second] = await Promise.all([run(), run()])
    expect(calls).toBe(1)
    expect(first.outcome?.state).toBe('ready')
    expect(second.outcome?.state).toBe('ready')
    expect(first.issuedResources).toHaveLength(1)
    expect(second.issuedResources).toHaveLength(1)
  })

  test('a crash after the response preserves the issued resource and requires reconciliation', async () => {
    const root = await makeRoot()
    await expect(runCrashSafeVoiceProvisioning({
      journalRoot: root,
      attempt: attempt('attempt_crash'),
      mutate: async () => ({
        state: { state: 'ready', providerVoice: providerVoice('voice-crash') },
        issuedResources: [{ providerVoice: providerVoice('voice-crash'), observedAt: '2026-08-11T00:01:00.000Z', sanitizedResponseHash: 'f'.repeat(64) }],
        evidenceHash: 'f'.repeat(64)
      }),
      faultInjection: { afterResponseRecorded: () => { throw new Error('simulated crash') } }
    })).rejects.toThrow('simulated crash')

    const recovered = await loadVoiceProvisioningAttempt(root, 'vr_test', 'attempt_crash')
    expect(recovered.issuedResources.map(resource => resource.providerVoice)).toContainEqual(providerVoice('voice-crash'))
    expect(recovered.outcome?.state).toBe('reconciliation-required')
    expect(recovered.transitions.map(entry => entry.phase)).toEqual(['prepared', 'request-sent', 'response-received', 'ambiguous', 'terminal'])
    expect(await readFile(join(root, 'vr_test', 'attempt_crash', 'voice-provisioning-attempt.json'), 'utf8')).not.toContain('private-sample')
  })

  test('a prepared attempt resumes the same durable identity and creates exactly once', async () => {
    const root = await makeRoot()
    await expect(runCrashSafeVoiceProvisioning({
      journalRoot: root,
      attempt: attempt('attempt_prepared'),
      mutate: async () => { throw new Error('must not run') },
      faultInjection: { afterPrepared: () => { throw new Error('before provider creation') } }
    })).rejects.toThrow('before provider creation')
    const prepared = await loadVoiceProvisioningAttempt(root, 'vr_test', 'attempt_prepared')
    expect(prepared.transitions.map(entry => entry.phase)).toEqual(['prepared'])
    expect(prepared.issuedResources).toEqual([])
    let calls = 0
    const resumed = await runCrashSafeVoiceProvisioning({
      journalRoot: root,
      attempt: attempt('attempt_prepared'),
      mutate: async () => {
        calls++
        return {
          state: { state: 'ready', providerVoice: providerVoice('voice-resumed') },
          issuedResources: [{ providerVoice: providerVoice('voice-resumed'), observedAt: '2026-08-11T00:02:00.000Z', sanitizedResponseHash: '1'.repeat(64) }],
          evidenceHash: '1'.repeat(64)
        }
      }
    })
    expect(calls).toBe(1)
    expect(resumed.outcome?.state).toBe('ready')
    expect(resumed.transitions.map(entry => entry.phase)).toEqual(['prepared', 'request-sent', 'response-received', 'terminal'])
  })

  test('an ambiguous attempt reconciles from issued-resource evidence without another create', async () => {
    const root = await makeRoot()
    await expect(runCrashSafeVoiceProvisioning({
      journalRoot: root,
      attempt: attempt('attempt_reconcile'),
      mutate: async () => ({
        state: { state: 'ready', providerVoice: providerVoice('voice-reconciled') },
        issuedResources: [{ providerVoice: providerVoice('voice-reconciled'), observedAt: '2026-08-11T00:01:00.000Z', sanitizedResponseHash: '2'.repeat(64) }],
        evidenceHash: '2'.repeat(64)
      }),
      faultInjection: { afterResponseRecorded: () => { throw new Error('interrupt before outcome') } }
    })).rejects.toThrow('interrupt before outcome')
    const reconciled = await reconcileVoiceProvisioningAttempt({
      journalRoot: root,
      registrationDraftId: 'vr_test',
      attemptId: 'attempt_reconcile',
      outcome: { state: 'ready', providerVoice: providerVoice('voice-reconciled') },
      evidenceHash: '2'.repeat(64)
    })
    expect(reconciled.outcome?.state).toBe('ready')
    expect(reconciled.transitions.map(entry => entry.phase)).toEqual(['prepared', 'request-sent', 'response-received', 'ambiguous', 'terminal', 'reconciled', 'terminal'])
  })
})

describe('Phase 1 Mistral saved-reference management', () => {
  test('creation serializes the saved-voice API contract only through the management adapter', async () => {
    const root = await makeRoot()
    const samplePath = join(root, 'authorized-reference.wav')
    await Bun.write(samplePath, new Uint8Array([1, 2, 3, 4]))
    let observed: Record<string, unknown> | undefined
    const request: MistralVoiceManagementRequest = async <T>(options: Parameters<MistralVoiceManagementRequest>[0]): Promise<T> => {
      observed = options as unknown as Record<string, unknown>
      return { id: 'voice-managed', name: 'Hero reference', slug: 'autoshow-hero-reference', languages: ['en'] } as T
    }
    const created = await createMistralSavedVoice({
      apiKey: 'test-management-key',
      protectedSamplePath: samplePath,
      name: 'Hero reference',
      slug: 'autoshow-hero-reference',
      languages: ['en'],
      request
    })
    expect(observed).toMatchObject({ path: '/audio/voices', method: 'POST' })
    expect(observed?.['body']).toEqual({
      name: 'Hero reference',
      slug: 'autoshow-hero-reference',
      sample_audio: Buffer.from([1, 2, 3, 4]).toString('base64'),
      sample_filename: 'authorized-reference.wav',
      languages: ['en']
    })
    expect(created.providerVoice).toMatchObject({ provider: 'mistral', resourceId: 'voice-managed', origin: 'saved-reference', ownership: 'project' })
    expect(JSON.stringify(created)).not.toContain(samplePath)
    let deletionRequest: Record<string, unknown> | undefined
    const deletion = await deleteMistralSavedVoice({
      apiKey: 'test-management-key',
      providerVoice: created.providerVoice,
      confirmResourceId: 'voice-managed',
      request: async <T>(options: Parameters<MistralVoiceManagementRequest>[0]): Promise<T> => {
        deletionRequest = options as unknown as Record<string, unknown>
        return { id: 'voice-managed', name: 'Hero reference' } as T
      }
    })
    expect(deletionRequest).toMatchObject({ path: '/audio/voices/voice-managed', method: 'DELETE' })
    expect(deletion.providerVoice).toEqual(created.providerVoice)
  })

  test('concurrent saved-reference registrations share one provider creation and one generation chain', async () => {
    const root = await makeRoot()
    const charactersRoot = join(root, 'characters')
    const samplePath = join(root, 'authorized-reference.wav')
    await Bun.write(samplePath, new Uint8Array([9, 8, 7, 6]))
    const store = createProtectedVoiceAssetStore({ storeId: 'test_voice_store', root: join(root, 'protected') })
    const consentWithoutId = {
      schemaVersion: 1 as const,
      subjectKey: 'hero', provenanceRef: 'project:release-9', status: 'active' as const,
      grants: [{ action: 'upload' as const, allowed: true }, { action: 'new-synthesis' as const, allowed: true }],
      recordedAt: '2026-08-11T00:00:00.000Z', recordedBy: { namespace: 'local-user' as const, actorId: 'casting_editor' }
    }
    const consent: VoiceConsentRecord = { ...consentWithoutId, consentRecordId: computeConsentRecordId(consentWithoutId) }
    const consentRecordRef = await storeVoiceConsentRecord(store, consent)
    const brief: CharacterVoiceBrief = {
      subjectKey: 'hero', profileKey: 'default', mannerisms: [], prohibitedCaricatures: [], pronunciations: [], allowedOrigins: ['saved-reference']
    }
    let calls = 0
    const request: MistralVoiceManagementRequest = async <T>(options: Parameters<MistralVoiceManagementRequest>[0]): Promise<T> => {
      calls++
      await Bun.sleep(8)
      const body = options.body as { name: string, slug: string }
      return { id: 'voice-shared', name: body.name, slug: body.slug, created_at: '2026-08-11T00:01:00.000Z', languages: [] } as T
    }
    const run = () => provisionMistralSavedReferenceRegistration({
      charactersRoot, protectedStore: store, subjectKey: 'hero', profileKey: 'default', providerModel: 'voxtral-mini-tts-2603',
      voiceName: 'Hero reference', sourcePath: samplePath, authorizationRef: 'release:hero-v1', brief,
      provenanceRef: 'project:casting', consent, consentRecordRef, capabilityFixtureHash: 'a'.repeat(64), apiKey: 'test-management-key', request
    })
    const [first, second] = await Promise.all([run(), run()])
    expect(calls).toBe(1)
    expect(first.generationId).toBe(second.generationId)
    const catalog = await loadVoiceRegistrationCatalog(charactersRoot)
    expect(catalog.registrations).toHaveLength(2)
    expect(catalog.registrations.map(entry => entry.provisioning.state)).toEqual(['pending', 'ready'])
  })
})
