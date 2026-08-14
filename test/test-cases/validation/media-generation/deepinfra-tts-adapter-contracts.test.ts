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

  test('runs offline synthesis mock and generates valid WAV metadata', async () => {
    const res = await runDeepinfraTts('Hello from DeepInfra Chatterbox test', 'test-out', {
      model: 'ResembleAI/chatterbox-multilingual',
      apiKey: '',
    })
    expect(res.metadata.ttsService).toBe('deepinfra')
    expect(res.metadata.ttsModel).toBe('ResembleAI/chatterbox-multilingual')
    expect(res.metadata.audioFileName).toBeDefined()
  })

  test('advanced provider declares valid capability fixture and catalog entries', async () => {
    expect(DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createDeepinfraAdvancedProvider({ apiKey: 'test-key-deepinfra' })
    const cat = await provider.catalog!.list({})
    expect(cat.entries.length).toBeGreaterThanOrEqual(3)
  })
})
