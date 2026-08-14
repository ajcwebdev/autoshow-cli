import { describe, expect, test } from 'bun:test'
import { collectReplicateTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/replicate-tts-targets'
import { runReplicateTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/run-replicate-tts'
import { createReplicateAdvancedProvider, REPLICATE_ADVANCED_CAPABILITY_FIXTURE } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/replicate-advanced-provider'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'

describe('Replicate Phase 5 Speech Suite Contracts', () => {
  test('collects Replicate TTS targets with correct provider and model', () => {
    const selection = createTtsTargetSelection({ replicateTtsModel: 'x-lance/f5-tts', replicateTtsVoice: 'standard' })
    const targets = collectReplicateTtsTargets(selection)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.service).toBe('replicate')
    expect(targets[0]?.model).toBe('x-lance/f5-tts')
    expect(targets[0]?.voice).toBe('standard')
  })

  test('rejects missing credentials instead of fabricating offline audio', async () => {
    await expect(runReplicateTts('Hello from Replicate open-source speech suite test', 'test-out', {
      model: 'x-lance/f5-tts',
      apiKey: '',
    })).rejects.toThrow('Replicate API token is required')
  })

  test('advanced provider declares unsupported management facets without fake catalog entries', () => {
    expect(REPLICATE_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createReplicateAdvancedProvider({ apiKey: 'test-key-replicate' })
    expect(provider.catalog).toBeUndefined()
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'voice-catalog')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'native-dialogue')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
  })
})
