import type { TtsOptions, TtsTarget, TtsTargetSelection } from '~/types'
import { collectElevenLabsTtsTargets } from '../tts-services/tts-elevenlabs/elevenlabs-tts-targets'
import { collectInworldTtsTargets } from '../tts-services/inworld/inworld-tts-targets'
import { collectGeminiTtsTargets } from '../tts-services/tts-gemini/gemini-tts-targets'
import { collectSonioxTtsTargets } from '../tts-services/tts-soniox/soniox-tts-targets'
import { collectGrokTtsTargets } from '../tts-services/tts-grok/grok-tts-targets'
import { collectOpenAITtsTargets } from '../tts-services/tts-openai/openai-tts-targets'
import { createTtsTargetSelection } from './tts-target-selection'
import { validateTtsTargetSelection } from './target-validation'
import { getMultiSpeakerStrategy } from './multi-speaker-capability'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { UsageError } from '~/utils/error-handler'
import { filterModelCostTargets } from '~/cli/commands/pricing-orchestration/model-cost-filter'

const getTtsTransport = (): string => 'hosted-api'

export const preflightTtsTargetSelection = (
  options: TtsOptions
): TtsTargetSelection => {
  if (Object.entries(options).some(([key, value]) => key.startsWith('mistralTts') && value !== undefined)) {
    throw UsageError('Mistral TTS settings are no longer supported. Select an active TTS provider explicitly.')
  }
  const selection = createTtsTargetSelection(options)
  validateTtsTargetSelection(options, selection)
  return selection
}

export const collectTtsTargets = (options: TtsOptions): TtsTarget[] => {
  const selection = preflightTtsTargetSelection(options)

  const collected: TtsTarget[] = [
    ...collectElevenLabsTtsTargets(selection),
    ...collectGeminiTtsTargets(selection),
    ...collectSonioxTtsTargets(selection),
    ...collectGrokTtsTargets(selection),
    ...collectOpenAITtsTargets(selection),
    ...collectInworldTtsTargets(selection)
  ]

  const targets = filterModelCostTargets(collected.map((target): TtsTarget => {
    const operation = 'tts-synthesis' as const
    const transport = target.transport ?? getTtsTransport()
    return Object.assign(target, {
      operation,
      transport,
      targetKey: canonicalTargetKey(operation, target.service, target.model, transport)
    })
  }), options, 'tts')

  const targetKeys = targets.map((target) => target.targetKey)
  if (new Set(targetKeys).size !== targetKeys.length) {
    throw UsageError('Duplicate operation-scoped TTS targets are not allowed.')
  }

  if (selection.multiSpeakerRequested) {
    for (const target of targets) {
      const strategy = getMultiSpeakerStrategy(target.service, target.model)
      if (strategy) {
        target.multiSpeakerStrategy = strategy
      }
    }
  }

  return targets
}
