import { describe, expect, test } from 'bun:test'
import { collectInworldTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-targets'
import { parseInworldMarkups, runInworldTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/run-inworld-tts'
import { createInworldAdvancedProvider, INWORLD_ADVANCED_CAPABILITY_FIXTURE } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-advanced-provider'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'

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

  test('rejects missing credentials instead of fabricating offline audio', async () => {
    await expect(runInworldTts('Hello from Inworld AI test [happy]', 'test-out', {
      model: 'realtime-tts-2',
      apiKey: '',
    })).rejects.toThrow('Inworld AI API key is required')
  })

  test('advanced provider declares unsupported management facets without fake catalog entries', () => {
    expect(INWORLD_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createInworldAdvancedProvider({ apiKey: 'test-key-inworld' })
    expect(provider.catalog).toBeUndefined()
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'voice-catalog')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'native-dialogue')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
  })
})
