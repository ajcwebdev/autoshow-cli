import type { TtsOptions, TtsTarget, TtsTargetSelection } from '~/types'
import { collectElevenLabsTtsTargets } from '../tts-services/tts-elevenlabs/elevenlabs-tts-targets'
import { collectCartesiaTtsTargets } from '../tts-services/cartesia/cartesia-tts-targets'
import { collectInworldTtsTargets } from '../tts-services/inworld/inworld-tts-targets'
import { collectGrokTtsTargets } from '../tts-services/tts-grok/grok-tts-targets'
import { collectHumeTtsTargets } from '../tts-services/hume/hume-tts-targets'
import { collectMistralTtsTargets } from '../tts-services/tts-mistral/mistral-tts-targets'
import { collectOpenAITtsTargets } from '../tts-services/tts-openai/openai-tts-targets'
import { collectSpeechifyTtsTargets } from '../tts-services/speechify/speechify-tts-targets'
import { createTtsTargetSelection } from './tts-target-selection'
import { validateTtsTargetSelection } from './target-validation'
import { getMultiSpeakerStrategy } from './multi-speaker-capability'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { UsageError } from '~/utils/error-handler'
import { getMistralProtectedReference, getMistralProtectedSpeakerReferences } from '../voice-assets/mistral-protected-reference-binding'
import { filterModelCostTargets } from '~/cli/commands/pricing-orchestration/model-cost-filter'

const getTtsTransport = (): string => 'hosted-api'

export const preflightTtsTargetSelection = (
  options: TtsOptions
): TtsTargetSelection => {
  const rawMistralReference = (options as { mistralTtsRefAudio?: unknown }).mistralTtsRefAudio
  if (typeof rawMistralReference === 'string' && rawMistralReference.trim()) {
    throw UsageError(
      'Mistral request reference audio must cross the protected ingestion boundary before target collection.',
      { hints: ['Pass the reference only through the standalone `tts` CLI edge, or create/import a voice with the shared `voice` command or `comic reference-voice` and synthesize with --mistral-tts-voice.'] }
    )
  }
  const selection = createTtsTargetSelection(options)
  validateTtsTargetSelection(options, selection)
  return selection
}

export const collectTtsTargets = (options: TtsOptions): TtsTarget[] => {
  const selection = preflightTtsTargetSelection(options)
  const mistralProtectedReference = getMistralProtectedReference(options)
  const mistralProtectedSpeakerReferences = getMistralProtectedSpeakerReferences(options)

  const collected: TtsTarget[] = [
    ...collectElevenLabsTtsTargets(selection),
    ...collectGrokTtsTargets(selection),
    ...collectMistralTtsTargets(selection, mistralProtectedReference, mistralProtectedSpeakerReferences, {
      pricePlanning: options.price === true,
      skipMissingVoice: options.ttsAllProvidersSelected === true
    }),
    ...collectOpenAITtsTargets(selection),
    ...collectSpeechifyTtsTargets(selection),
    ...collectHumeTtsTargets(selection),
    ...collectCartesiaTtsTargets(selection),
    ...collectInworldTtsTargets(selection)
  ]

  const targets = filterModelCostTargets(collected.map((target): TtsTarget => {
    const operation = 'tts-synthesis' as const
    const transport = getTtsTransport()
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
