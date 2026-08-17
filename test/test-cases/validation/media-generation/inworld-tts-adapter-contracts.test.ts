import { describe, expect, test } from 'bun:test'
import { collectInworldTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-targets'
import { parseInworldMarkups, runInworldTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/run-inworld-tts'
import { createInworldAdvancedProvider, INWORLD_ADVANCED_CAPABILITY_FIXTURE } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-advanced-provider'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'
import type { AdvancedProviderHttpRequest } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/advanced-provider-contracts'
import { buildInworldTtsRequestBody, INWORLD_TTS_SERIALIZER_VERSION, resolveInworldTtsApiModelId } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-request'

describe('Inworld AI Phase 3 Contracts', () => {
  test('collects Inworld TTS targets with correct provider and model', () => {
    const selection = createTtsTargetSelection({ inworldTtsModel: 'realtime-tts-2', inworldTtsVoice: 'voice_inworld_standard_en' })
    const targets = collectInworldTtsTargets(selection)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.service).toBe('inworld')
    expect(targets[0]?.model).toBe('realtime-tts-2')
    expect(targets[0]?.voice).toBe('voice_inworld_standard_en')
  })

  test('parses inline audio markups correctly', () => {
    const { sanitizedText, markups } = parseInworldMarkups('Hello world [happy] [laugh] [breathe]')
    expect(sanitizedText).toBe('Hello world [happy] [laugh] [breathe]')
    expect(markups).toEqual(['happy', 'laugh', 'breathe'])
  })

  test('maps current public selectors to the provider API model IDs', () => {
    expect(INWORLD_TTS_SERIALIZER_VERSION).toBe('inworld.tts.phase-3-v3')
    expect(resolveInworldTtsApiModelId('realtime-tts-2')).toBe('inworld-tts-2')
    expect(buildInworldTtsRequestBody({ model: 'realtime-tts-2', text: 'Hello [laugh]', voiceId: 'Dennis' })).toEqual({ text: 'Hello [laugh]', voiceId: 'Dennis', modelId: 'inworld-tts-2', timestampType: 'WORD', audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 } })
    const targets = collectInworldTtsTargets(createTtsTargetSelection({ inworldTtsModel: 'realtime-tts-2' }))
    expect(targets[0]?.model).toBe('realtime-tts-2')
  })

  test('rejects missing credentials instead of fabricating offline audio', async () => {
    await expect(runInworldTts('Hello from Inworld AI test [happy]', 'test-out', {
      model: 'realtime-tts-2',
      apiKey: '',
    })).rejects.toThrow('Inworld AI API key is required')
  })

  test('advanced provider normalizes the voice catalog and declares Phase 3C capabilities', async () => {
    expect(INWORLD_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createInworldAdvancedProvider({
      apiKey: 'test-key-inworld',
      now: () => '2026-08-14T00:00:00.000Z',
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        expect(input).toEqual({ method: 'GET', path: '/voices/v1/voices', query: { languages: 'EN_US' } })
        return { voices: [
          { voiceId: 'Alex', displayName: 'Alex', description: 'Energetic and expressive.', langCode: 'EN_US', source: 'SYSTEM', tags: ['expressive'] },
          { voiceId: 'workspace__guide', displayName: 'Guide', langCode: 'EN_US', source: 'IVC' },
          { voiceId: 'workspace__professional', displayName: 'Professional', langCode: 'EN_US', source: 'PVC' }
        ] } as T
      }
    })
    const catalog = await provider.catalog?.list()
    expect(catalog?.entries).toEqual([
      expect.objectContaining({ resourceId: 'Alex', source: 'provider-library', origin: 'provider-stock', state: 'available', modelIds: ['realtime-tts-2'] }),
      expect.objectContaining({ resourceId: 'workspace__guide', source: 'account', origin: 'imported-custom', state: 'available', modelIds: ['realtime-tts-2'] }),
      expect.objectContaining({ resourceId: 'workspace__professional', source: 'account', origin: 'professional-clone', state: 'available' })
    ])
    for (const feature of ['voice-catalog', 'voice-design', 'instant-clone', 'voice-delete', 'word-timing', 'phoneme-timing']) {
      expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === feature)).toMatchObject({ adapterSupport: 'implemented', channel: 'api' })
    }
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'professional-clone')).toMatchObject({ maturity: 'preview', adapterSupport: 'planned', channel: 'ui-only' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'native-dialogue')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
  })

  test('designs and publishes a selected Inworld voice without fabricating candidate data', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const provider = createInworldAdvancedProvider({
      apiKey: 'test-key-inworld',
      now: () => '2026-08-14T00:00:00.000Z',
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        calls.push(input)
        if (input.path === '/voices/v1/voices:design') return { previewVoices: [
          { voiceId: 'workspace__design-one', previewText: 'First returned preview.', previewAudio: 'AQID' },
          { voiceId: 'workspace__design-two', previewText: 'Second returned preview.', previewAudio: 'BAUG' }
        ] } as T
        if (input.path === '/voices/v1/voices/workspace__design-one:publish') return { voiceId: 'workspace__designed-guide', displayName: 'Designed Guide', source: 'IVC', langCode: 'EN_US' } as T
        throw new Error(`Unexpected request ${input.path}`)
      }
    })
    const designed = await provider.design!.createCandidate({
      description: 'A warm, thoughtful documentary guide with clear diction.',
      previewText: 'Preview this carefully.',
      candidateCount: 2,
      creationModel: 'inworld-voice-design'
    })
    expect(calls[0]).toEqual({ method: 'POST', path: '/voices/v1/voices:design', body: {
      designPrompt: 'A warm, thoughtful documentary guide with clear diction.',
      previewText: 'Preview this carefully.',
      voiceDesignConfig: { numberOfSamples: 2 }
    } })
    expect(designed.previews).toEqual([
      expect.objectContaining({ providerCandidateId: 'workspace__design-one', audioBase64: 'AQID', mediaType: 'audio/mpeg', sanitizedMetadata: { previewText: 'First returned preview.' } }),
      expect.objectContaining({ providerCandidateId: 'workspace__design-two', audioBase64: 'BAUG', mediaType: 'audio/mpeg', sanitizedMetadata: { previewText: 'Second returned preview.' } })
    ])
    const published = await provider.design!.materializeCandidate({ providerCandidateId: 'workspace__design-one', desiredName: 'Designed Guide', localAttemptId: 'attempt-design-1' })
    expect(calls[1]).toEqual({ method: 'POST', path: '/voices/v1/voices/workspace__design-one:publish', body: { displayName: 'Designed Guide' } })
    expect(published).toMatchObject({ state: 'ready', providerVoice: {
      resourceId: 'workspace__designed-guide', namespace: 'account', origin: 'designed', ownership: 'project', accountScopeHash: provider.accountScopeHash,
      deletion: { state: 'eligible' }, derivedFrom: { sourceRef: 'workspace__design-one', operation: 'designed-from', localAttemptId: 'attempt-design-1' }
    } })
  })

  test('clones protected samples through JSON and keeps professional cloning external', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const protectedSample = { storeId: 'voice-store', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64) }
    const provider = createInworldAdvancedProvider({
      apiKey: 'test-key-inworld',
      now: () => '2026-08-14T00:00:00.000Z',
      resolveProtectedAsset: async asset => {
        expect(asset).toEqual(protectedSample)
        return { bytes: new Uint8Array([1, 2, 3]), fileName: 'sample.wav', mediaType: 'audio/wav', transcription: 'A protected sample.' }
      },
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        calls.push(input)
        return { voice: { voiceId: 'workspace__instant-guide', displayName: 'Instant Guide', source: 'IVC' } } as T
      }
    })
    const cloned = await provider.clone!.clone({ cloneKind: 'instant', desiredName: 'Instant Guide', localAttemptId: 'attempt-clone-1', protectedSamples: [protectedSample], consentRecordRef: 'consent:guide', provenanceRef: 'project:guide', description: 'A clear guide voice.' })
    expect(calls).toEqual([{ method: 'POST', path: '/voices/v1/voices:clone', body: {
      displayName: 'Instant Guide',
      voiceSamples: [{ audioData: 'AQID', transcription: 'A protected sample.' }],
      description: 'A clear guide voice.'
    } }])
    expect(cloned).toMatchObject({ state: 'ready', providerVoice: { resourceId: 'workspace__instant-guide', origin: 'instant-clone', derivedFrom: { sourceRef: protectedSample.assetId, sourceIdentityHash: protectedSample.sha256, operation: 'cloned-from' } } })
    const professional = await provider.clone!.clone({ cloneKind: 'professional', desiredName: 'Professional Guide', localAttemptId: 'attempt-pro-1', protectedSamples: [], consentRecordRef: 'consent:guide', provenanceRef: 'project:guide' })
    expect(professional).toMatchObject({ state: 'external-action-required', action: expect.stringContaining('Professional Voice Cloning beta workflow') })
    expect(calls).toHaveLength(1)
  })

  test('inspects and deletes only identity-matched project-owned Inworld voices', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const provider = createInworldAdvancedProvider({
      apiKey: 'test-key-inworld',
      now: () => '2026-08-14T00:00:00.000Z',
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        calls.push(input)
        if (input.method === 'GET') return { voiceId: 'workspace__voice one', displayName: 'Voice One', source: 'IVC', languageCode: 'en-US', tags: ['guide'] } as T
        return {} as T
      }
    })
    const voice = {
      kind: 'remote-resource' as const,
      provider: 'inworld' as const,
      resourceId: 'workspace__voice one',
      namespace: 'account' as const,
      accountScopeHash: provider.accountScopeHash,
      origin: 'instant-clone' as const,
      ownership: 'project' as const,
      deletion: { state: 'eligible' as const, checkedAt: '2026-08-14T00:00:00.000Z' }
    }
    const inspected = await provider.lifecycle!.inspect(voice)
    expect(inspected).toMatchObject({ state: 'available', providerVoice: voice, sanitizedMetadata: { source: 'IVC', languageCode: 'en-US' } })
    await provider.lifecycle!.delete({ providerVoice: voice, expectedResourceId: voice.resourceId })
    expect(calls).toEqual([
      { method: 'GET', path: '/voices/v1/voices/workspace__voice%20one' },
      { method: 'DELETE', path: '/voices/v1/voices/workspace__voice%20one' }
    ])
    await expect(provider.lifecycle!.delete({ providerVoice: voice, expectedResourceId: 'another-voice' })).rejects.toThrow('identity does not match')
    expect(calls).toHaveLength(2)
  })
})
