import { describe, expect, test } from 'bun:test'
import type { ProtectedAssetRef } from '~/types'
import { createFishAdvancedProvider } from '~/cli/commands/process-steps/step-4-tts/tts-services/fish/fish-advanced-provider'
import { createFishClient } from '~/utils/fish-client/fish-client'
import { AppError } from '~/utils/error-handler'
import { expectProviderHttpError } from '../../../test-utils/rest-contract-helpers'

describe('Fish Audio adapter contracts', () => {
  test('returns structured provider failures instead of usage errors or raw bodies', async () => {
    const client = createFishClient({
      apiKey: 'test-fish-key',
      fetchImpl: (async () => new Response(JSON.stringify({ error: { message: 'temporary outage' } }), {
        status: 503,
        headers: { 'content-type': 'application/json', 'x-request-id': 'fish-503' }
      })) as unknown as typeof fetch
    })

    await expectProviderHttpError(
      () => client.synthesizeTts({ text: 'hello', reference_id: 'voice-id' }),
      {
        instanceOf: AppError,
        kind: 'provider_http',
        status: 503,
        stage: 'fish:TTS create',
        retryable: true,
        headers: { 'x-request-id': 'fish-503' },
        messageContains: 'temporary outage'
      }
    )
  })

  test('materializes a design candidate with its protected preview audio', async () => {
    const protectedPreview: ProtectedAssetRef = {
      storeId: 'test_voice_store',
      assetId: `sha256_${'a'.repeat(64)}`,
      sha256: 'a'.repeat(64)
    }
    let uploadedVoiceCount = 0
    const provider = createFishAdvancedProvider({
      apiKey: 'test-fish-key',
      resolveProtectedAsset: async (asset) => {
        expect(asset).toEqual(protectedPreview)
        return { bytes: new Uint8Array([1, 2, 3, 4]), fileName: 'preview.wav', mediaType: 'audio/wav' }
      },
      fetchImpl: (async (_input: string | URL | Request, init?: RequestInit) => {
        expect(init?.method).toBe('POST')
        expect(init?.body).toBeInstanceOf(FormData)
        uploadedVoiceCount = (init?.body as FormData).getAll('voices').length
        return new Response(JSON.stringify({ _id: 'fish-designed-voice', title: 'Designed voice', state: 'ready' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }) as unknown as typeof fetch
    })

    const result = await provider.design!.materializeCandidate({
      providerCandidateId: 'fish-candidate-0',
      desiredName: 'Designed voice',
      localAttemptId: 'attempt-fish-design',
      protectedPreview
    })

    expect(uploadedVoiceCount).toBe(1)
    expect(result).toMatchObject({
      state: 'ready',
      providerVoice: { provider: 'fish', resourceId: 'fish-designed-voice', origin: 'designed' }
    })
  })
})
