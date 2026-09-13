import { validateElevenLabsVoiceSettings } from '../tts-services/tts-elevenlabs/elevenlabs-utils'
import { validateCartesiaTtsLanguage } from '../tts-services/cartesia/cartesia-tts-request'
import type { TtsTargetSelection } from '~/types'
import { UsageError } from '~/utils/error-handler'

const requireProviderSelectionMessage = (
  label: string,
  provider: string,
  detail: string
): string =>
  `${label} ${detail} require selecting ${provider} TTS with --provider/--tts ${provider}[=model] or an all-provider TTS run.`

const hasElevenLabsControls = (selection: TtsTargetSelection): boolean => Boolean(
  selection.elevenLabsLanguageCode
  || typeof selection.elevenLabsStability === 'number'
  || typeof selection.elevenLabsSimilarityBoost === 'number'
  || typeof selection.elevenLabsStyle === 'number'
  || selection.elevenLabsUseSpeakerBoost
  || typeof selection.elevenLabsSpeed === 'number'
  || typeof selection.elevenLabsSeed === 'number'
  || selection.elevenLabsTextNormalization
  || (selection.elevenLabsPronunciationDictionaryLocators && selection.elevenLabsPronunciationDictionaryLocators.length > 0)
)

const validateRequiredProviderSelections = (selection: TtsTargetSelection): void => {
  const requirements = [
    { enabled: Boolean(selection.openaiInstructions || typeof selection.openaiSpeed === 'number'), models: selection.openaiModels, label: 'OpenAI TTS', provider: 'openai', detail: 'request control flags' },
    { enabled: Boolean(selection.inworldInstructions || selection.inworldSpeed !== undefined), models: selection.inworldModels, label: 'Inworld TTS', provider: 'inworld', detail: 'request control flags' },
    { enabled: Boolean(selection.grokLanguage || selection.grokTextNormalization || selection.grokSpeed !== undefined), models: selection.grokModels, label: 'Grok TTS', provider: 'grok', detail: 'request control flags' },
    { enabled: hasElevenLabsControls(selection), models: selection.elevenlabsModels, label: 'ElevenLabs TTS', provider: 'elevenlabs', detail: 'request control flags' },
    { enabled: Boolean(selection.speechifyLanguage), models: selection.speechifyModels, label: 'Speechify TTS', provider: 'speechify', detail: 'request control flags' },
    { enabled: Boolean(selection.humeVoice || selection.humeSpeed !== undefined), models: selection.humeModels, label: 'Hume TTS', provider: 'hume', detail: 'voice flags' },
    { enabled: Boolean(selection.cartesiaVoiceId || selection.cartesiaLanguage || selection.cartesiaSpeed !== undefined), models: selection.cartesiaModels, label: 'Cartesia TTS', provider: 'cartesia', detail: 'request control flags' },
  ]
  for (const requirement of requirements) {
    if (requirement.enabled && requirement.models.length === 0) {
      throw UsageError(requireProviderSelectionMessage(requirement.label, requirement.provider, requirement.detail))
    }
  }
}

const validateOpenAiInstructions = (selection: TtsTargetSelection): void => {
  if (!selection.openaiInstructions) return
  const incompatibleModels = selection.openaiModels.filter((model) => model !== 'gpt-4o-mini-tts-2025-12-15')
  if (incompatibleModels.length > 0) {
    throw UsageError(`OpenAI TTS instructions are supported only by gpt-4o-mini-tts-2025-12-15; incompatible selected models: ${incompatibleModels.join(', ')}.`)
  }
}

export const validateTtsProviderOptions = (selection: TtsTargetSelection): void => {
  validateRequiredProviderSelections(selection)
  validateOpenAiInstructions(selection)
  for (const model of selection.elevenlabsModels) validateElevenLabsVoiceSettings(model, { speed: selection.elevenLabsSpeed, similarity_boost: selection.elevenLabsSimilarityBoost, style: selection.elevenLabsStyle, ...(selection.elevenLabsUseSpeakerBoost ? { use_speaker_boost: true } : {}) })
  for (const model of selection.cartesiaModels) validateCartesiaTtsLanguage(model, selection.cartesiaLanguage)
}
