import { describe, expect, test } from 'bun:test'
import { collectDeepinfraTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-tts-targets'
import { DEEPINFRA_TTS_RETRY_POLICY, runDeepinfraTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/run-deepinfra-tts'
import { createDeepinfraAdvancedProvider, DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-advanced-provider'
import { prepareDeepinfraChatterboxText } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-text-preparation'
import { buildDeepinfraTtsRequestBody, DEEPINFRA_TTS_SERIALIZER_VERSION, DEEPINFRA_VOICE_DESIGN_MODELS, isDeepinfraVoiceDesignModel, prepareDeepinfraTtsText, resolveDeepinfraTtsDefaultVoice, resolveDeepinfraTtsVoiceField } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-tts-request'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'
import { prepareComicSegmentedProviderTexts } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { validatePreparedProviderText } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-validation'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import type { AdvancedProviderHttpRequest } from '~/types'

const CHECKED_AT = '2026-08-14T00:00:00.000Z'
const protectedSample = { storeId: 'voice_store', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64) }
const tempDirs = setupContractSuiteLifecycle({ envKeys: ['DEEPINFRA_API_KEY'], tempPrefix: 'autoshow-deepinfra-adapter-' })

describe('DeepInfra Phase 4 Contracts', () => {
  test('collects DeepInfra TTS targets with correct provider and model', () => {
    const selection = createTtsTargetSelection({ deepinfraTtsModel: 'ResembleAI/chatterbox-turbo', deepinfraTtsVoice: 'standard' })
    const targets = collectDeepinfraTtsTargets(selection)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.service).toBe('deepinfra')
    expect(targets[0]?.model).toBe('ResembleAI/chatterbox-turbo')
    expect(targets[0]?.voice).toBe('standard')
    expect(DEEPINFRA_TTS_RETRY_POLICY).toMatchObject({ maxAttempts: 8, baseDelayMs: 3_000, maxDelayMs: 30_000, jitter: true, exponential: true })
  })

  test('rejects missing credentials instead of fabricating offline audio', async () => {
    await expect(runDeepinfraTts('Hello from DeepInfra Chatterbox test', 'test-out', {
      model: 'ResembleAI/chatterbox-turbo',
      apiKey: '',
    })).rejects.toThrow('DeepInfra API key is required')
  })

  test('normalizes Chatterbox ellipses to provider-safe comma pauses without changing canonical text', () => {
    const prepared = prepareDeepinfraChatterboxText('Teeth... more teeth. Then… wait.')
    expect(prepared.canonicalText).toBe('Teeth... more teeth. Then… wait.')
    expect(prepared.providerText).toBe('Teeth, more teeth. Then, wait.')
    expect(validatePreparedProviderText(prepared)).toBe(prepared)
    expect(prepareDeepinfraChatterboxText('Power.').preparationVersion).toBe('generic-tts-v1')

    const [target] = collectDeepinfraTtsTargets(createTtsTargetSelection({ deepinfraTtsModel: 'ResembleAI/chatterbox-turbo' }))
    expect(prepareComicSegmentedProviderTexts({
      turnId: 'dialogue-turn-009',
      sourceSegmentId: 'dialogue-turn-009',
      subjectKey: 'seamus',
      originalSpeakerLabel: 'SEAMUS',
      canonicalText: 'Teeth... more teeth.'
    }, target!).providerTexts).toEqual(['Teeth, more teeth.'])
  })

  test('serializes each hosted model with its current DeepInfra request schema', () => {
    expect(DEEPINFRA_TTS_SERIALIZER_VERSION).toBe('deepinfra.tts.phase-4-v2')
    expect(prepareDeepinfraTtsText('ResembleAI/chatterbox-turbo', 'Wait... now.')).toBe('Wait, now.')
    expect(buildDeepinfraTtsRequestBody({ model: 'ResembleAI/chatterbox-turbo', text: 'Hello', voice: 'provider-default' })).toEqual({ text: 'Hello', response_format: 'wav' })
    expect(buildDeepinfraTtsRequestBody({ model: 'ResembleAI/chatterbox-turbo', text: 'Hello', voice: 'custom-voice' })).toEqual({ text: 'Hello', response_format: 'wav', voice_id: 'custom-voice' })
    expect(buildDeepinfraTtsRequestBody({ model: 'XiaomiMiMo/MiMo-V2.5-tts', text: 'Hello', voice: 'mimo_default', promptInstructions: 'Bright delivery' })).toEqual({ text: 'Hello', voice: 'mimo_default', output_format: 'wav', stream: false, instruct: 'Bright delivery' })
    expect(buildDeepinfraTtsRequestBody({ model: 'XiaomiMiMo/MiMo-V2.5-tts-voicedesign', text: 'Hello', voice: 'Warm narrator' })).toEqual({ text: 'Hello', voice: 'Warm narrator', output_format: 'wav', stream: false })
    expect(buildDeepinfraTtsRequestBody({ model: 'Qwen/Qwen3-TTS', text: 'Hello', voice: 'Vivian' })).toEqual({ input: 'Hello', voice: 'Vivian', language: 'Auto', response_format: 'wav' })
    expect(buildDeepinfraTtsRequestBody({ model: 'Qwen/Qwen3-TTS-VoiceDesign', text: 'Hello', voice: 'Warm narrator' })).toEqual({ input: 'Hello', voice: 'Warm narrator', language: 'Auto', response_format: 'wav' })
    expect(resolveDeepinfraTtsDefaultVoice('Qwen/Qwen3-TTS')).toBe('Vivian')
    expect(resolveDeepinfraTtsVoiceField('ResembleAI/chatterbox-turbo')).toBe('voice_id')
    expect(resolveDeepinfraTtsVoiceField('Qwen/Qwen3-TTS')).toBe('voice')
    expect(DEEPINFRA_VOICE_DESIGN_MODELS).toEqual(['XiaomiMiMo/MiMo-V2.5-tts-voicedesign', 'Qwen/Qwen3-TTS-VoiceDesign'])
    expect(isDeepinfraVoiceDesignModel('Qwen/Qwen3-TTS')).toBe(false)
  })

  test('uses the provider-advertised per-model input limits for planning and dispatch', () => {
    expect(resolveTtsChunkCharacterLimit('deepinfra', 'ResembleAI/chatterbox-turbo')).toBe(5000)
    expect(resolveTtsChunkCharacterLimit('deepinfra', 'XiaomiMiMo/MiMo-V2.5-tts')).toBe(1000)
    expect(resolveTtsChunkCharacterLimit('deepinfra', 'Qwen/Qwen3-TTS')).toBe(4000)
  })

  test('mocked Chatterbox synthesis records admission evidence and decodes binary WAV', async () => {
    const root = await tempDirs.make()
    const wav = createMockWavBytes({ samples: 2400 })
    const calls = installMockFetch(call => {
      if (!call.url.endsWith('/v1/inference/ResembleAI/chatterbox-turbo')) throw new Error(`Unexpected network call: ${call.method} ${call.url}`)
      expect(call.bodyJson).toEqual({ text: 'Ready?', response_format: 'wav' })
      return new Response(wav, { status: 200, headers: { 'content-type': 'audio/wav', 'x-request-id': 'deepinfra-fixture' } })
    })
    const admissions: Array<Record<string, unknown>> = []
    const result = await runDeepinfraTts('Ready?', root, {
      model: 'ResembleAI/chatterbox-turbo',
      apiKey: 'fixture-key',
      requestEvidence: {
        dispatch: async (_observation, _attempt, operation) => await operation({
          accepted: async evidence => { admissions.push(evidence as Record<string, unknown>) }
        }),
        recordOutput: async () => {},
        complete: async () => {},
      }
    })
    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toHaveLength(1)
    expect(admissions[0]).toMatchObject({ providerRequestId: 'deepinfra-fixture', fields: { httpStatus: 200 } })
  })

  test('classifies HTTP 500 as retryable instead of fabricating audio', async () => {
    installMockFetch(() => new Response(JSON.stringify({ error: 'upstream failed' }), { status: 500, headers: { 'content-type': 'application/json' } }))
    try {
      await runDeepinfraTts('Ready?', await tempDirs.make(), { model: 'ResembleAI/chatterbox-turbo', apiKey: 'fixture-key' })
      throw new Error('expected DeepInfra 500 to fail')
    } catch (error) {
      expect(error).toMatchObject({ retryable: true })
      expect(String(error)).toContain('DeepInfra TTS failed (500)')
    }
  })

  test('advanced provider lists account voices and declares implemented management facets', async () => {
    expect(DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createDeepinfraAdvancedProvider({
      apiKey: 'test-key-deepinfra',
      now: () => CHECKED_AT,
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        expect(input).toEqual({ method: 'GET', path: '/v1/voices' })
        return { voices: [
          { user_id: 'gh:1', voice_id: 'abcd1234abcd1234abcd', name: 'Guide', description: 'A clear guide.', created_at: 1723851387, updated_at: 1723851387 }
        ] } as T
      }
    })
    const catalog = await provider.catalog!.list({ source: 'account' })
    expect(catalog.entries).toEqual([
      expect.objectContaining({ resourceId: 'abcd1234abcd1234abcd', name: 'Guide', source: 'account', origin: 'imported-custom', modelIds: ['ResembleAI/chatterbox-turbo', 'Qwen/Qwen3-TTS'] })
    ])
    expect((await provider.catalog!.list({ source: 'provider-library' })).entries).toEqual([])
    await expect(provider.catalog!.list({ cursor: 'next' })).rejects.toThrow('not paginated')
    for (const feature of ['voice-catalog', 'voice-design', 'instant-clone', 'voice-import', 'voice-delete']) {
      expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === feature)).toMatchObject({ adapterSupport: 'implemented' })
    }
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'native-dialogue')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'voice-design')).toMatchObject({ constraints: { createsRemoteResource: false } })
  })

  test('designs a VoiceDesign preview and materializes it through POST /v1/voices/add', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const preview = createMockWavBytes({ samples: 1200 })
    const provider = createDeepinfraAdvancedProvider({
      apiKey: 'test-key-deepinfra',
      now: () => CHECKED_AT,
      synthesizeDesign: async ({ model, body }) => {
        expect(model).toBe('XiaomiMiMo/MiMo-V2.5-tts-voicedesign')
        expect(body).toEqual({ text: 'A bounded preview.', voice: 'Warm documentary narrator', output_format: 'wav', stream: false })
        return new Uint8Array(preview)
      },
      resolveProtectedAsset: async () => ({ bytes: new Uint8Array(preview), fileName: 'preview.wav', mediaType: 'audio/wav' }),
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        calls.push(input)
        return { user_id: 'gh:1', voice_id: 'designed-voice-1', name: 'Designed Guide', description: 'Designed Guide', created_at: 1, updated_at: 1 } as T
      }
    })
    const designed = await provider.design!.createCandidate({
      description: 'Warm documentary narrator',
      previewText: 'A bounded preview.',
      candidateCount: 1,
      creationModel: 'XiaomiMiMo/MiMo-V2.5-tts-voicedesign'
    })
    expect(designed.previews).toEqual([
      expect.objectContaining({ audioBase64: Buffer.from(preview).toString('base64'), mediaType: 'audio/wav' })
    ])
    const published = await provider.design!.materializeCandidate({
      providerCandidateId: designed.previews[0]!.providerCandidateId,
      desiredName: 'Designed Guide',
      localAttemptId: 'attempt-design-1',
      protectedPreview: protectedSample
    })
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/voices/add')
    expect(calls[0]?.body).toBeInstanceOf(FormData)
    expect((calls[0]?.body as FormData).get('name')).toBe('Designed Guide')
    expect(published).toMatchObject({ state: 'ready', providerVoice: { resourceId: 'designed-voice-1', origin: 'designed', ownership: 'project', derivedFrom: { operation: 'designed-from', localAttemptId: 'attempt-design-1' } } })
  })

  test('clones protected samples through multipart create-voice and rejects professional clone', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const provider = createDeepinfraAdvancedProvider({
      apiKey: 'test-key-deepinfra',
      now: () => CHECKED_AT,
      resolveProtectedAsset: async asset => {
        expect(asset).toEqual(protectedSample)
        return { bytes: new Uint8Array([1, 2, 3]), fileName: 'sample.wav', mediaType: 'audio/wav' }
      },
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        calls.push(input)
        return { user_id: 'gh:1', voice_id: 'cloned-voice-1', name: 'Instant Guide', description: 'A clear guide voice.', created_at: 1, updated_at: 1 } as T
      }
    })
    const cloned = await provider.clone!.clone({
      cloneKind: 'instant',
      desiredName: 'Instant Guide',
      localAttemptId: 'attempt-clone-1',
      protectedSamples: [protectedSample],
      consentRecordRef: 'consent:guide',
      provenanceRef: 'project:guide',
      description: 'A clear guide voice.'
    })
    expect(calls[0]).toEqual(expect.objectContaining({ method: 'POST', path: '/v1/voices/add' }))
    expect((calls[0]?.body as FormData).get('name')).toBe('Instant Guide')
    expect((calls[0]?.body as FormData).get('description')).toBe('A clear guide voice.')
    expect(cloned).toMatchObject({ state: 'ready', providerVoice: { resourceId: 'cloned-voice-1', origin: 'instant-clone', derivedFrom: { sourceRef: protectedSample.assetId, operation: 'cloned-from' } } })
    await expect(provider.clone!.clone({
      cloneKind: 'professional',
      desiredName: 'Professional Guide',
      localAttemptId: 'attempt-pro-1',
      protectedSamples: [],
      consentRecordRef: 'consent:guide',
      provenanceRef: 'project:guide'
    })).rejects.toThrow('does not document a professional voice-clone workflow')
    expect(calls).toHaveLength(1)
  })

  test('inspects and deletes only identity-matched project-owned DeepInfra voices', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const provider = createDeepinfraAdvancedProvider({
      apiKey: 'test-key-deepinfra',
      now: () => CHECKED_AT,
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        calls.push(input)
        if (input.method === 'GET') return { user_id: 'gh:1', voice_id: 'voice one', name: 'Voice One', created_at: 1, updated_at: 1 } as T
        return {} as T
      }
    })
    const voice = {
      kind: 'remote-resource' as const,
      provider: 'deepinfra' as const,
      resourceId: 'voice one',
      namespace: 'account' as const,
      accountScopeHash: provider.accountScopeHash,
      origin: 'instant-clone' as const,
      ownership: 'project' as const,
      deletion: { state: 'eligible' as const, checkedAt: CHECKED_AT }
    }
    const inspected = await provider.lifecycle!.inspect(voice)
    expect(inspected).toMatchObject({ state: 'available', providerVoice: voice, sanitizedMetadata: { userId: 'gh:1' } })
    await provider.lifecycle!.delete({ providerVoice: voice, expectedResourceId: voice.resourceId })
    expect(calls).toEqual([
      { method: 'GET', path: '/v1/voices/voice%20one' },
      { method: 'DELETE', path: '/v1/voices/voice%20one' }
    ])
    await expect(provider.lifecycle!.delete({ providerVoice: voice, expectedResourceId: 'another-voice' })).rejects.toThrow('identity does not match')
    expect(calls).toHaveLength(2)
  })
})
