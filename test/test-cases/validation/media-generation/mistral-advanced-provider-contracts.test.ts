import { describe, expect, test } from 'bun:test'
import type { MistralVoiceManagementRequest, ProviderVoiceRef } from '~/types'
import { createMistralAdvancedProvider } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-mistral/mistral-advanced-provider'

const CHECKED_AT = '2026-08-29T00:00:00.000Z'
const protectedSample = { storeId: 'voice_store', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64) }

describe('Mistral advanced voice adapter', () => {
  test('exposes preset and custom catalogs with offset pagination', async () => {
    const calls: Parameters<MistralVoiceManagementRequest>[0][] = []
    const request: MistralVoiceManagementRequest = async <T>(input: Parameters<MistralVoiceManagementRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.path.includes('type=preset')) return { items: [{ id: 'preset-1', name: 'Preset' }], total: 1 } as T
      return { items: [{ id: 'custom-101', name: 'Custom' }], total: 202 } as T
    }
    const adapter = createMistralAdvancedProvider({ apiKey: 'mistral-key', request, now: () => CHECKED_AT })
    const presets = await adapter.catalog!.list({ source: 'provider-library' })
    const custom = await adapter.catalog!.list({ source: 'account', cursor: '100' })

    expect(presets.entries[0]).toMatchObject({ resourceId: 'preset-1', source: 'provider-library', origin: 'provider-stock' })
    expect(custom.entries[0]).toMatchObject({ resourceId: 'custom-101', source: 'account', origin: 'saved-reference' })
    expect(custom.nextCursor).toBe('101')
    expect(calls.map(call => call.path)).toEqual([
      '/audio/voices?limit=100&offset=0&type=preset',
      '/audio/voices?limit=100&offset=100&type=custom',
    ])
  })

  test('clones one saved reference and preserves inspect/delete identity', async () => {
    const calls: Parameters<MistralVoiceManagementRequest>[0][] = []
    const request: MistralVoiceManagementRequest = async <T>(input: Parameters<MistralVoiceManagementRequest>[0]): Promise<T> => {
      calls.push(input)
      return { id: 'voice-saved-1', name: 'Hero', slug: 'autoshow-vp-clone' } as T
    }
    const adapter = createMistralAdvancedProvider({
      apiKey: 'mistral-key', request, now: () => CHECKED_AT,
      resolveProtectedAsset: async () => ({ bytes: new Uint8Array([1, 2, 3]), fileName: 'sample.wav', mediaType: 'audio/wav' })
    })
    const cloned = await adapter.clone!.clone({
      cloneKind: 'instant', desiredName: 'Hero', localAttemptId: 'vp_clone', protectedSamples: [protectedSample],
      consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:casting'
    })
    const voice = cloned.providerVoice as ProviderVoiceRef
    expect(voice).toMatchObject({ provider: 'mistral', resourceId: 'voice-saved-1', origin: 'saved-reference', ownership: 'project' })
    expect(calls[0]?.body).toMatchObject({ name: 'Hero', slug: 'autoshow-vp-clone', sample_audio: 'AQID', sample_filename: 'sample.wav' })
    const inspection = await adapter.lifecycle!.inspect(voice)
    expect(inspection).toMatchObject({ provider: 'mistral', state: 'available' })
    await adapter.lifecycle!.delete({ providerVoice: voice, expectedResourceId: 'voice-saved-1' })
    expect(calls.map(call => [call.method, call.path])).toEqual([
      ['POST', '/audio/voices'],
      ['GET', '/audio/voices/voice-saved-1'],
      ['DELETE', '/audio/voices/voice-saved-1'],
    ])
  })
})
