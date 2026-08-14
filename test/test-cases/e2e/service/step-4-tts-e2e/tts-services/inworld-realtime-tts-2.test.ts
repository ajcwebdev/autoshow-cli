import { describe, expect, test } from 'bun:test'
import { collectInworldTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-targets'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'

describe('Inworld Realtime TTS 2 Price Test', () => {
  test('collects Inworld target', () => {
    const selection = createTtsTargetSelection({ inworldTtsModel: 'realtime-tts-2' })
    const targets = collectInworldTtsTargets(selection)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.model).toBe('realtime-tts-2')
  })
})
