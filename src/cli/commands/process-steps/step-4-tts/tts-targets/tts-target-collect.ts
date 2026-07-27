import type { TtsOptions, TtsTarget } from '~/types'
import { collectDeepgramTtsTargets } from '../tts-services/tts-deepgram/deepgram-tts-targets'
import { collectElevenLabsTtsTargets } from '../tts-services/tts-elevenlabs/elevenlabs-tts-targets'
import { collectCartesiaTtsTargets } from '../tts-services/cartesia/cartesia-tts-targets'
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

export const collectTtsTargets = (options: TtsOptions): TtsTarget[] => {
  const selection = createTtsTargetSelection(options)
  validateTtsTargetSelection(options, selection)

  const targets: TtsTarget[] = [
    ...collectKittenTtsTargets(options, selection),
    ...collectElevenLabsTtsTargets(selection),
    ...collectMinimaxTtsTargets(selection),
    ...collectGroqTtsTargets(selection),
    ...collectGrokTtsTargets(selection),
    ...collectMistralTtsTargets(selection),
    ...collectOpenAITtsTargets(selection),
    ...collectGeminiTtsTargets(selection),
    ...collectDeepgramTtsTargets(selection),
    ...collectSpeechifyTtsTargets(selection),
    ...collectHumeTtsTargets(selection),
    ...collectCartesiaTtsTargets(selection)
  ]

  if (selection.multiSpeakerRequested) {
    for (const target of targets) {
      const strategy = getMultiSpeakerStrategy(target.service)
      if (strategy) {
        target.multiSpeakerStrategy = strategy
      }
    }
  }

  return targets
}
