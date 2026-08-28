import { describe, expect, test } from 'bun:test'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { CharacterVoiceBrief, ProviderVoiceRef, TtsVoiceProvider } from '~/types'
import { planAdvancedClone, provisionAdvancedVoiceClone } from '~/cli/commands/process-steps/step-4-tts/voice-management/advanced-voice-management'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const checkedAt = '2026-08-13T00:00:00.000Z'
const protectedSample = { storeId: 'voice_store', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64) }
const consentRef = `protected-consent:v1:voice_store:sha256_${'f'.repeat(64)}:${'f'.repeat(64)}`
const brief: CharacterVoiceBrief = { subjectKey: 'hero', profileKey: 'default', mannerisms: [], prohibitedCaricatures: [], pronunciations: [], allowedOrigins: ['instant-clone', 'professional-clone'] }

describe('ADR-017 Phase 1 shared voice clone workflow', () => {
  test('plans without writes and provisions an ElevenLabs instant clone through one durable mutation', async () => {
    const root = await makeTempDir('autoshow-voice-clone-phase1-')
    try {
      const request = { cloneKind: 'instant' as const, desiredName: 'Hero Clone', localAttemptId: 'planning', protectedSamples: [protectedSample], consentRecordRef: consentRef, provenanceRef: 'project:casting' }
      const planned = planAdvancedClone(request)
      expect(planned).toMatchObject({ estimatedCostCents: 0, requestFingerprint: expect.any(String) })
      expect(await readdir(root)).toEqual([])
      const accountScopeHash = 'b'.repeat(64)
      const providerVoice: Extract<ProviderVoiceRef, { kind: 'remote-resource' }> = { kind: 'remote-resource', provider: 'elevenlabs', resourceId: 'voice-clone-1', namespace: 'account', accountScopeHash, origin: 'instant-clone', ownership: 'project', deletion: { state: 'eligible', checkedAt } }
      let calls = 0
      const provider: Pick<TtsVoiceProvider, 'provider' | 'clone'> & { accountScopeHash: string } = {
        provider: 'elevenlabs', accountScopeHash,
        clone: { clone: async () => { calls++; return { schemaVersion: 1, provider: 'elevenlabs', state: 'ready', providerVoice, sanitizedMetadata: { cloneKind: 'instant' }, checkedAt } } },
      }
      const provision = async () => await provisionAdvancedVoiceClone({
        charactersRoot: join(root, 'characters'), journalRoot: join(root, 'journals'), provider, providerModel: 'eleven_v3', subjectKey: 'hero', profileKey: 'default', brief,
        request: { cloneKind: request.cloneKind, desiredName: request.desiredName, protectedSamples: request.protectedSamples, consentRecordRef: request.consentRecordRef, provenanceRef: request.provenanceRef }, capabilityFixtureHash: 'c'.repeat(64), now: () => checkedAt,
      })
      const first = await provision()
      const resumed = await provision()
      expect(first.registration.provisioning).toMatchObject({ state: 'ready', providerVoice: { resourceId: 'voice-clone-1' } })
      expect(resumed.registration.generationId).toBe(first.registration.generationId)
      expect(first.attempt?.transitions.map(transition => transition.phase)).toEqual(['prepared', 'request-sent', 'response-received', 'terminal'])
      expect(calls).toBe(1)
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  test('records professional cloning as a truthful verification-gated external state without samples', async () => {
    const root = await makeTempDir('autoshow-voice-clone-professional-')
    try {
      let calls = 0
      const provider: Pick<TtsVoiceProvider, 'provider' | 'clone'> & { accountScopeHash: string } = {
        provider: 'elevenlabs', accountScopeHash: 'd'.repeat(64),
        clone: { clone: async () => { calls++; return { schemaVersion: 1, provider: 'elevenlabs', state: 'verification-required', providerOperationId: 'professional-clone', action: 'Complete provider voice verification.', sanitizedMetadata: { cloneKind: 'professional' }, checkedAt } } },
      }
      const result = await provisionAdvancedVoiceClone({
        charactersRoot: join(root, 'characters'), journalRoot: join(root, 'journals'), provider, providerModel: 'eleven_v3', subjectKey: 'hero', profileKey: 'default', brief,
        request: { cloneKind: 'professional', desiredName: 'Hero Pro', protectedSamples: [], consentRecordRef: consentRef, provenanceRef: 'project:casting' }, capabilityFixtureHash: 'e'.repeat(64), now: () => checkedAt,
      })
      expect(result.registration.provisioning).toMatchObject({ state: 'verification-required', operationId: 'professional-clone' })
      expect(result.attempt).toBeUndefined()
      expect(calls).toBe(1)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
