import { describe, expect, test } from 'bun:test'
import type { AdvancedProviderHttpRequest } from '~/types'
import {
  CARTESIA_ADVANCED_CAPABILITY_FIXTURE,
  createCartesiaAdvancedProvider,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/cartesia/cartesia-advanced-provider'
import {
  createSpeechifyAdvancedProvider,
  SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-advanced-provider'
import { advancedProvider } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-command-support'

const CHECKED_AT = '2026-08-11T00:00:00.000Z'
const protectedSample = { storeId: 'voice_store', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64) }

describe('Phase 4 capability fixtures', () => {
  test('declare implemented management facets without inventing native dialogue or design support', () => {
    for (const fixture of [CARTESIA_ADVANCED_CAPABILITY_FIXTURE, SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE]) {
      expect(fixture.capabilityFixtureHash).toHaveLength(64)
      expect(fixture.records.find(record => record.scope.feature === 'voice-catalog')).toEqual(expect.objectContaining({ adapterSupport: 'implemented' }))
      expect(fixture.records.find(record => record.scope.feature === 'native-dialogue')).toEqual(expect.objectContaining({ maturity: 'not-applicable', channel: 'unsupported', adapterSupport: 'unsupported' }))
    }
    expect(CARTESIA_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'voice-design')).toEqual(expect.objectContaining({ adapterSupport: 'unsupported' }))
    expect(SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'voice-design')).toEqual(expect.objectContaining({ adapterSupport: 'unsupported' }))
    expect(SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'instant-clone')).toEqual(expect.objectContaining({ adapterSupport: 'planned' }))
  })

  test('public routing exposes Grok, Mistral, and Hume without provider calls', () => {
    const credentials = {
      XAI_API_KEY: 'xai-key',
      MISTRAL_API_KEY: 'mistral-key',
      HUME_API_KEY: 'hume-key',
    } as const
    const prior = Object.fromEntries(Object.keys(credentials).map(key => [key, process.env[key]]))
    Object.assign(process.env, credentials)
    try {
      for (const provider of ['grok', 'mistral', 'hume'] as const) {
        const routed = advancedProvider(provider)
        expect(routed.provider).toBe(provider)
        expect(routed.catalog).toBeDefined()
        expect(routed.lifecycle).toBeDefined()
      }
    } finally {
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })
})

describe('Cartesia and Speechify advanced voice adapters', () => {
  test('Cartesia preserves pagination and keeps professional cloning external', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.method === 'GET') return { data: [{ id: 'voice-1', name: 'Guide', is_owner: true, language: 'en' }], has_more: true, next_page: 'voice-1' } as T
      return { id: 'clone-1', name: 'Clone', is_owner: true, language: 'en' } as T
    }
    const adapter = createCartesiaAdvancedProvider({
      apiKey: 'cartesia-key', request, now: () => CHECKED_AT,
      resolveProtectedAsset: async () => ({ bytes: new Uint8Array([1]), fileName: 'sample.wav', mediaType: 'audio/wav' })
    })
    const page = await adapter.catalog!.list({ source: 'account', cursor: 'prior' })
    expect(page.nextCursor).toBe('voice-1')
    expect(calls[0]?.query).toEqual(expect.objectContaining({ starting_after: 'prior', is_owner: 'true' }))
    const cloned = await adapter.clone!.clone({ cloneKind: 'instant', desiredName: 'Clone', localAttemptId: 'attempt-cartesia', protectedSamples: [protectedSample], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:casting' })
    expect(cloned.providerVoice).toEqual(expect.objectContaining({ resourceId: 'clone-1', origin: 'instant-clone' }))
    const callsBeforeProfessional = calls.length
    const professional = await adapter.clone!.clone({ cloneKind: 'professional', desiredName: 'Pro Clone', localAttemptId: 'attempt-pro', protectedSamples: [], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:casting' })
    expect(professional).toEqual(expect.objectContaining({ state: 'external-action-required', action: expect.stringContaining('dashboard') }))
    expect(calls).toHaveLength(callsBeforeProfessional)
  })

  test('Speechify exposes catalog and lifecycle without the obsolete clone contract', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      return { voices: [{ id: 'shared-1', display_name: 'Narrator', type: 'shared', models: [{ name: 'simba-3.2' }] }], has_more: false } as T
    }
    const adapter = createSpeechifyAdvancedProvider({
      apiKey: 'speechify-key', request, now: () => CHECKED_AT,
    })
    const catalog = await adapter.catalog!.list({ source: 'provider-library' })
    expect(catalog.entries[0]).toEqual(expect.objectContaining({ resourceId: 'shared-1', modelIds: ['simba-3.2'], source: 'provider-library' }))
    expect('clone' in adapter).toBe(false)
    expect(calls).toHaveLength(1)
  })
})
