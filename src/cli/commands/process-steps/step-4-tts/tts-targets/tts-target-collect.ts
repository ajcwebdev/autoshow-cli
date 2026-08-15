import type { TtsOptions, TtsTarget, TtsTargetSelection } from '~/types'
import { collectDeepgramTtsTargets } from '../tts-services/tts-deepgram/deepgram-tts-targets'
import { collectElevenLabsTtsTargets } from '../tts-services/tts-elevenlabs/elevenlabs-tts-targets'
import { collectCartesiaTtsTargets } from '../tts-services/cartesia/cartesia-tts-targets'
import { collectFishTtsTargets } from '../tts-services/fish/fish-tts-targets'
import { collectInworldTtsTargets } from '../tts-services/inworld/inworld-tts-targets'
import { collectDeepinfraTtsTargets } from '../tts-services/tts-deepinfra/deepinfra-tts-targets'
import { collectReplicateTtsTargets } from '../tts-services/tts-replicate/replicate-tts-targets'
import { collectFalTtsTargets } from '../tts-services/tts-fal/fal-tts-targets'
import { collectGeminiTtsTargets } from '../tts-services/tts-gemini/gemini-tts-targets'
import { collectGrokTtsTargets } from '../tts-services/tts-grok/grok-tts-targets'
import { collectGroqTtsTargets } from '../tts-services/tts-groq/groq-tts-targets'
import { collectHumeTtsTargets } from '../tts-services/hume/hume-tts-targets'
import { collectKittenTtsTargets } from '../tts-local/kitten/kitten-tts-targets'
import { collectMinimaxTtsTargets } from '../tts-services/tts-minimax/minimax-tts-targets'
import { collectMistralTtsTargets } from '../tts-services/tts-mistral/mistral-tts-targets'
import { collectOpenAITtsTargets } from '../tts-services/tts-openai/openai-tts-targets'
import { collectSpeechifyTtsTargets } from '../tts-services/speechify/speechify-tts-targets'
import { createTtsTargetSelection } from './tts-target-selection'
import { validateTtsTargetSelection } from './target-validation'
import { getMultiSpeakerStrategy } from './multi-speaker-capability'
import { validateTtsSynthesisCreationOptions } from '../synthesis-creation-guard'
import { resolveGeminiDialogueStrategy } from '../tts-services/tts-gemini/gemini-tts-config'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { CLIUsageError } from '~/utils/error-handler'
import { getMistralProtectedReference, getMistralProtectedSpeakerReferences } from '../voice-assets/mistral-protected-reference-binding'

const getTtsTransport = (service: TtsTarget['service']): string =>
  service === 'kitten' ? 'local-process' : 'hosted-api'

export const preflightTtsTargetSelection = (
  options: TtsOptions
): TtsTargetSelection => {
  validateTtsSynthesisCreationOptions(options)
  const rawMistralReference = (options as { mistralTtsRefAudio?: unknown }).mistralTtsRefAudio
  if (typeof rawMistralReference === 'string' && rawMistralReference.trim()) {
    throw CLIUsageError(
      'Mistral request reference audio must cross the protected ingestion boundary before target collection.',
      'Pass the reference only through the standalone `tts` CLI edge, or create/import a voice with the shared `voice` command or `comic reference-voice` and synthesize with --mistral-tts-voice.'
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
    ...collectKittenTtsTargets(options, selection),
    ...collectElevenLabsTtsTargets(selection),
    ...collectMinimaxTtsTargets(selection),
    ...collectGroqTtsTargets(selection),
    ...collectGrokTtsTargets(selection),
    ...collectMistralTtsTargets(selection, mistralProtectedReference, mistralProtectedSpeakerReferences),
    ...collectOpenAITtsTargets(selection),
    ...collectGeminiTtsTargets(selection),
    ...collectDeepgramTtsTargets(selection),
    ...collectSpeechifyTtsTargets(selection),
    ...collectHumeTtsTargets(selection),
    ...collectCartesiaTtsTargets(selection),
    ...collectFishTtsTargets(selection),
    ...collectInworldTtsTargets(selection),
    ...collectDeepinfraTtsTargets(selection),
    ...collectReplicateTtsTargets(selection),
    ...collectFalTtsTargets(selection)
  ]

  const targets = collected.map((target): TtsTarget => {
    const operation = 'tts-synthesis' as const
    const transport = getTtsTransport(target.service)
    return {
      ...target,
      operation,
      transport,
      targetKey: canonicalTargetKey(operation, target.service, target.model, transport)
    }
  })

  const targetKeys = targets.map((target) => target.targetKey)
  if (new Set(targetKeys).size !== targetKeys.length) {
    throw CLIUsageError('Duplicate operation-scoped TTS targets are not allowed.')
  }

  if (selection.multiSpeakerRequested) {
    for (const target of targets) {
      const strategy = target.service === 'gemini' && selection.speakerVoiceRegistry
        ? resolveGeminiDialogueStrategy(selection.speakerVoiceRegistry.entries.length, 'auto')
        : getMultiSpeakerStrategy(target.service, target.model)
      if (strategy) {
        target.multiSpeakerStrategy = strategy
      }
    }
  }

  return targets
}
