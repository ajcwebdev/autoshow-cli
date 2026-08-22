import { describe, expect, test } from 'bun:test'
import { collectDeepinfraTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-tts-targets'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'

describe('DeepInfra Chatterbox Price Test', () => {
  test('collects DeepInfra target', () => {
    const selection = createTtsTargetSelection({ deepinfraTtsModels: ['ResembleAI/chatterbox-turbo'] })
    const targets = collectDeepinfraTtsTargets(selection)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.model).toBe('ResembleAI/chatterbox-turbo')
  })
})
