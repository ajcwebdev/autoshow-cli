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

  test('runs offline synthesis mock and generates valid WAV metadata', async () => {
    const res = await runReplicateTts('Hello from Replicate open-source speech suite test', 'test-out', {
      model: 'x-lance/f5-tts',
      apiKey: '',
    })
    expect(res.metadata.ttsService).toBe('replicate')
    expect(res.metadata.ttsModel).toBe('x-lance/f5-tts')
    expect(res.metadata.audioFileName).toBeDefined()
  })

  test('advanced provider declares valid capability fixture and catalog entries', async () => {
    expect(REPLICATE_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createReplicateAdvancedProvider({ apiKey: 'test-key-replicate' })
    const cat = await provider.catalog!.list({})
    expect(cat.entries).toHaveLength(3)
    expect(cat.entries[0]?.resourceId).toBe('x-lance/f5-tts')
  })
})
