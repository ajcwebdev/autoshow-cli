import { describe, expect, test } from 'bun:test'
import { collectDeepinfraTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-tts-targets'
import { runDeepinfraTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/run-deepinfra-tts'
import { createDeepinfraAdvancedProvider, DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-advanced-provider'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'

describe('DeepInfra Phase 4 Contracts', () => {
  test('collects DeepInfra TTS targets with correct provider and model', () => {
    const selection = createTtsTargetSelection({ deepinfraTtsModel: 'ResembleAI/chatterbox-multilingual', deepinfraTtsVoice: 'standard' })
    const targets = collectDeepinfraTtsTargets(selection)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.service).toBe('deepinfra')
    expect(targets[0]?.model).toBe('ResembleAI/chatterbox-multilingual')
    expect(targets[0]?.voice).toBe('standard')
  })

  test('rejects missing credentials instead of fabricating offline audio', async () => {
    await expect(runDeepinfraTts('Hello from DeepInfra Chatterbox test', 'test-out', {
      model: 'ResembleAI/chatterbox-multilingual',
      apiKey: '',
    })).rejects.toThrow('DeepInfra API key is required')
  })

  test('advanced provider declares unsupported management facets without fake catalog entries', () => {
    expect(DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createDeepinfraAdvancedProvider({ apiKey: 'test-key-deepinfra' })
    expect(provider.catalog).toBeUndefined()
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'voice-catalog')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'native-dialogue')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
  })
})
