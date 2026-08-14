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
    expect(sanitizedText).toBe('Hello world')
    expect(markups).toEqual(['happy', 'laugh', 'breathe'])
  })

  test('maps current public selectors to the provider API model IDs', () => {
    expect(INWORLD_TTS_SERIALIZER_VERSION).toBe('inworld.tts.phase-3-v2')
    expect(resolveInworldTtsApiModelId('realtime-tts-2')).toBe('inworld-tts-2')
    expect(resolveInworldTtsApiModelId('realtime-tts-2-flash')).toBe('inworld-tts-2-flash')
    expect(buildInworldTtsRequestBody({ model: 'realtime-tts-2-flash', text: 'Hello', voiceId: 'Dennis', markups: ['happy'] })).toEqual({ text: 'Hello', voiceId: 'Dennis', modelId: 'inworld-tts-2-flash', markups: ['happy'] })
    const targets = collectInworldTtsTargets(createTtsTargetSelection({ inworldTtsModel: 'realtime-tts-2-flash' }))
    expect(targets[0]?.model).toBe('realtime-tts-2-flash')
  })

  test('rejects missing credentials instead of fabricating offline audio', async () => {
    await expect(runInworldTts('Hello from Inworld AI test [happy]', 'test-out', {
      model: 'realtime-tts-2',
      apiKey: '',
    })).rejects.toThrow('Inworld AI API key is required')
  })

  test('advanced provider normalizes the current read-only voice catalog', async () => {
    expect(INWORLD_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createInworldAdvancedProvider({
      apiKey: 'test-key-inworld',
      now: () => '2026-08-14T00:00:00.000Z',
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        expect(input).toEqual({ method: 'GET', path: '/voices/v1/voices', query: { languages: 'EN_US' } })
        return { voices: [
          { voiceId: 'Alex', displayName: 'Alex', description: 'Energetic and expressive.', langCode: 'EN_US', source: 'SYSTEM', tags: ['expressive'] },
          { voiceId: 'workspace__guide', displayName: 'Guide', langCode: 'EN_US', source: 'IVC' }
        ] } as T
      }
    })
    const catalog = await provider.catalog?.list()
    expect(catalog?.entries).toEqual([
      expect.objectContaining({ resourceId: 'Alex', source: 'provider-library', origin: 'provider-stock', state: 'available', modelIds: ['realtime-tts-2', 'realtime-tts-2-flash'] }),
      expect.objectContaining({ resourceId: 'workspace__guide', source: 'account', origin: 'imported-custom', state: 'available', modelIds: ['realtime-tts-2', 'realtime-tts-2-flash'] })
    ])
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'voice-catalog')).toMatchObject({ adapterSupport: 'implemented', channel: 'api' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'native-dialogue')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
  })
})
