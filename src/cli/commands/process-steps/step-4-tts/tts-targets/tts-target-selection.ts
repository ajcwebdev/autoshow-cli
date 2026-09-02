import type { TtsOptions, TtsTargetSelection } from '~/types'
import { isMultiSpeakerRequested, parseSpeakerVoiceMappings } from '../dialogue-normalizer'
const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined

export const createTtsTargetSelection = (options: TtsOptions): TtsTargetSelection => {
  const elevenLabsPronunciationDictionaryLocators = options.elevenlabsTtsPronunciationDictionaryLocators?.map((item) => item.trim()).filter(Boolean)

  const multiSpeaker = isMultiSpeakerRequested(options)
  const speakerVoiceRegistry = multiSpeaker
    ? parseSpeakerVoiceMappings(options.ttsSpeakers)
    : undefined

  return {
    elevenlabsModels: options.elevenlabsTtsModels ?? [],
    grokModels: options.grokTtsModels ?? [],
    mistralModels: options.mistralTtsModels ?? [],
    openaiModels: options.openaiTtsModels ?? [],
    speechifyModels: options.speechifyTtsModels ?? [],
    humeModels: options.humeTtsModels ?? [],
    cartesiaModels: options.cartesiaTtsModels ?? [],
    inworldModels: options.inworldTtsModels ?? [],
    speakerVoiceRegistry,
    multiSpeakerRequested: multiSpeaker,
    openaiVoiceId: trimmed(options.openaiVoiceId),
    openaiInstructions: trimmed(options.openaiTtsInstructions),
    openaiSpeed: options.openaiTtsSpeed,
    elevenLabsVoiceId: trimmed(options.elevenlabsVoiceId),
    elevenLabsLanguageCode: trimmed(options.elevenlabsTtsLanguageCode),
    elevenLabsStability: options.elevenlabsTtsStability,
    elevenLabsSimilarityBoost: options.elevenlabsTtsSimilarityBoost,
    elevenLabsStyle: options.elevenlabsTtsStyle,
    elevenLabsUseSpeakerBoost: options.elevenlabsTtsUseSpeakerBoost === true,
    elevenLabsSpeed: options.elevenlabsTtsSpeed,
    elevenLabsSeed: options.elevenlabsTtsSeed,
    elevenLabsTextNormalization: trimmed(options.elevenlabsTtsTextNormalization),
    elevenLabsPronunciationDictionaryLocators,
    speechifyVoiceId: trimmed(options.speechifyVoice),
    speechifyLanguage: trimmed(options.speechifyTtsLanguage),
    humeVoice: trimmed(options.humeTtsVoice),
    cartesiaVoiceId: trimmed(options.cartesiaTtsVoice),
    cartesiaLanguage: trimmed(options.cartesiaTtsLanguage),
    inworldVoiceId: trimmed(options.inworldTtsVoice),
    inworldInstructions: trimmed(options.inworldTtsInstructions),
    grokVoiceId: trimmed(options.grokTtsVoice),
    grokLanguage: trimmed(options.grokTtsLanguage),
    grokTextNormalization: options.grokTtsTextNormalization === true,
    mistralVoiceId: trimmed(options.mistralTtsVoice),
    dialogueRequested: multiSpeaker
  }
}
