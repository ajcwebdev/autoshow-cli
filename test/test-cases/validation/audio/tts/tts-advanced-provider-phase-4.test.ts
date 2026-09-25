import { describe, expect, test } from 'bun:test'
import type { AdvancedProviderHttpRequest } from '~/types'
import {
  createSpeechifyAdvancedProvider,
  SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE,
} from '~/cli/commands/audio/tts/tts-services/speechify/speechify-advanced-provider'
import { advancedProvider } from '~/cli/commands/audio/voice/voice-command-support'

const CHECKED_AT = '2026-08-11T00:00:00.000Z'

describe('Phase 4 capability fixtures', () => {
  test('declare implemented management facets without inventing native dialogue or design support', () => {
    for (const fixture of [ SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE]) {
      expect(fixture.capabilityFixtureHash).toHaveLength(64)
      expect(fixture.records.find(record => record.scope.feature === 'voice-catalog')).toEqual(expect.objectContaining({ adapterSupport: 'implemented' }))
      expect(fixture.records.find(record => record.scope.feature === 'native-dialogue')).toEqual(expect.objectContaining({ maturity: 'not-applicable', channel: 'unsupported', adapterSupport: 'unsupported' }))
    }
    expect(SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'voice-design')).toEqual(expect.objectContaining({ adapterSupport: 'unsupported' }))
    expect(SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'instant-clone')).toEqual(expect.objectContaining({ adapterSupport: 'planned' }))
    expect(SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'word-timing')).toEqual(expect.objectContaining({ adapterSupport: 'planned' }))
  })

  test('public routing exposes Grok and Mistral without provider calls', () => {
    const credentials = {
      XAI_API_KEY: 'xai-key',
      MISTRAL_API_KEY: 'mistral-key',
    } as const
    const prior = Object.fromEntries(Object.keys(credentials).map(key => [key, process.env[key]]))
    Object.assign(process.env, credentials)
    try {
      for (const provider of ['grok', 'mistral'] as const) {
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

describe('Speechify advanced voice adapters', () => {

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
