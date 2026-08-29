import { describe, expect, test } from 'bun:test'
import type { AdvancedProviderHttpRequest, ProviderVoiceRef } from '~/types'
import {
  createGrokAdvancedProvider,
  findGrokCustomVoiceByAttemptMarker,
  GROK_ADVANCED_CAPABILITY_FIXTURE,
  grokVoiceAttemptMarker,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-grok/grok-advanced-provider'

const CHECKED_AT = '2026-08-29T00:00:00.000Z'
const protectedSample = { storeId: 'voice_store', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64) }

describe('Grok advanced voice adapter', () => {
  test('declares Enterprise and United States except Illinois readiness requirements', () => {
    const clone = GROK_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'instant-clone')
    expect(clone).toMatchObject({ adapterSupport: 'implemented', channel: 'api' })
    expect(clone?.requirements).toEqual([
      { kind: 'plan', tier: 'Enterprise' },
      { kind: 'region', allowedRegionCodes: ['US'], excludedSubdivisionCodes: ['US-IL'] },
    ])
  })

  test('normalizes built-in voices and paginates the account catalog', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.path === '/v1/tts/voices') return { voices: [{ voice_id: 'eve', name: 'Eve', language: 'en' }] } as T
      if (input.query?.['pagination_token'] === 'page-2') return { voices: [{ voice_id: 'cd34ef56', name: 'Second', description: null }], pagination_token: null } as T
      return { voices: [{ voice_id: 'ab12cd34', name: 'First', description: 'Custom narrator' }], pagination_token: 'page-2' } as T
    }
    const adapter = createGrokAdvancedProvider({ apiKey: 'xai-key', request, now: () => CHECKED_AT })
    const builtIn = await adapter.catalog!.list({ source: 'provider-library' })
    const first = await adapter.catalog!.list({ source: 'account' })
    const second = await adapter.catalog!.list({ source: 'account', cursor: first.nextCursor })

    expect(builtIn.entries[0]).toMatchObject({ resourceId: 'eve', name: 'Eve', source: 'provider-library', origin: 'provider-stock', modelIds: ['grok-tts'] })
    expect(first).toMatchObject({ nextCursor: 'page-2', checkedAt: CHECKED_AT })
    expect(first.entries[0]).toMatchObject({ resourceId: 'ab12cd34', source: 'account', origin: 'instant-clone', description: 'Custom narrator' })
    expect(second.entries[0]).toMatchObject({ resourceId: 'cd34ef56' })
    expect(calls).toEqual([
      { method: 'GET', path: '/v1/tts/voices' },
      { method: 'GET', path: '/v1/custom-voices', query: { limit: '1000', pagination_token: undefined } },
      { method: 'GET', path: '/v1/custom-voices', query: { limit: '1000', pagination_token: 'page-2' } },
    ])
  })

  test('clones with multipart audio and supports exact inspect and delete lifecycle calls', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.method === 'POST') return { voice_id: 'ab12cd34', name: 'Hero', description: 'Grounded | autoshow-attempt:vp_clone1', created_at: CHECKED_AT } as T
      if (input.method === 'GET') return { voice_id: 'ab12cd34', name: 'Hero', description: 'Grounded | autoshow-attempt:vp_clone1', created_at: CHECKED_AT } as T
      return { deleted: true } as T
    }
    const adapter = createGrokAdvancedProvider({
      apiKey: 'xai-key', request, now: () => CHECKED_AT,
      resolveProtectedAsset: async () => ({ bytes: new Uint8Array([1, 2, 3]), fileName: 'sample.wav', mediaType: 'audio/wav', durationMs: 120_000 })
    })
    const cloned = await adapter.clone!.clone({
      cloneKind: 'instant', desiredName: 'Hero', localAttemptId: 'vp_clone1', protectedSamples: [protectedSample],
      consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:casting', description: 'Grounded'
    })
    const voice = cloned.providerVoice as ProviderVoiceRef
    expect(voice).toMatchObject({ provider: 'grok', resourceId: 'ab12cd34', namespace: 'account', origin: 'instant-clone', ownership: 'project' })
    expect(cloned.sanitizedMetadata).toMatchObject({ attemptMarker: 'autoshow-attempt:vp_clone1', sampleDurationMs: 120_000 })
    const form = calls[0]?.body
    expect(form).toBeInstanceOf(FormData)
    expect((form as FormData).get('name')).toBe('Hero')
    expect((form as FormData).get('description')).toBe('Grounded | autoshow-attempt:vp_clone1')
    expect((form as FormData).get('file')).toBeInstanceOf(Blob)

    const inspection = await adapter.lifecycle!.inspect(voice)
    expect(inspection).toMatchObject({ provider: 'grok', state: 'available', checkedAt: CHECKED_AT })
    await adapter.lifecycle!.delete({ providerVoice: voice, expectedResourceId: 'ab12cd34' })
    expect(calls.map(call => [call.method, call.path])).toEqual([
      ['POST', '/v1/custom-voices'],
      ['GET', '/v1/custom-voices/ab12cd34'],
      ['DELETE', '/v1/custom-voices/ab12cd34'],
    ])
  })

  test('rejects empty, unmeasured, overlong audio and malformed returned IDs', async () => {
    const cloneWith = async (bytes: Uint8Array, durationMs: number, voiceId = 'ab12cd34') => {
      const adapter = createGrokAdvancedProvider({
        apiKey: 'xai-key',
        request: async <T>() => ({ voice_id: voiceId } as T),
        resolveProtectedAsset: async () => ({ bytes, fileName: 'sample.wav', mediaType: 'audio/wav', durationMs })
      })
      return await adapter.clone!.clone({ cloneKind: 'instant', desiredName: 'Hero', localAttemptId: 'vp_validation', protectedSamples: [protectedSample], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:casting' })
    }
    await expect(cloneWith(new Uint8Array(), 1_000)).rejects.toThrow('cannot be empty')
    await expect(cloneWith(new Uint8Array([1]), 0)).rejects.toThrow('measured duration greater than 0')
    await expect(cloneWith(new Uint8Array([1]), 120_001)).rejects.toThrow('at most 120 seconds')
    await expect(cloneWith(new Uint8Array([1]), 1_000, 'INVALID-ID')).rejects.toThrow('8-character lowercase alphanumeric')
  })

  test('reconciles a deterministic attempt marker across every account page', async () => {
    const marker = grokVoiceAttemptMarker('vp_reconcile')
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.query?.['pagination_token'] === 'next') return { voices: [{ voice_id: 'ab12cd34', name: 'Recovered', description: `narrator | ${marker}` }], pagination_token: null } as T
      return { voices: [{ voice_id: 'cd34ef56', name: 'Unrelated', description: 'other attempt' }], pagination_token: 'next' } as T
    }
    const recovered = await findGrokCustomVoiceByAttemptMarker({ request, localAttemptId: 'vp_reconcile', now: () => CHECKED_AT })
    expect(recovered).toMatchObject({ resourceId: 'ab12cd34', name: 'Recovered', source: 'account' })
    expect(calls.map(call => call.query?.['pagination_token'])).toEqual([undefined, 'next'])
  })
})
