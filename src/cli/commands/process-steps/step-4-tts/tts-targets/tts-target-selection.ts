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
    minimaxModels: options.minimaxTtsModels ?? [],
    groqModels: options.groqTtsModels ?? [],
    grokModels: options.grokTtsModels ?? [],
    mistralModels: options.mistralTtsModels ?? [],
    openaiModels: options.openaiTtsModels ?? [],
    geminiModels: options.geminiTtsModels ?? [],
    deepgramModels: options.deepgramTtsModels ?? [],
    speechifyModels: options.speechifyTtsModels ?? [],
    humeModels: options.humeTtsModels ?? [],
    cartesiaModels: options.cartesiaTtsModels ?? [],
    fishModels: options.fishTtsModels ?? [],
    inworldModels: options.inworldTtsModels ?? [],
    deepinfraModels: options.deepinfraTtsModels ?? [],
    replicateModels: options.replicateTtsModels ?? [],
    falModels: options.falTtsModels ?? [],
    speakerVoiceRegistry,
    multiSpeakerRequested: multiSpeaker,
    minimaxVoiceId: trimmed(options.minimaxTtsVoice),
    minimaxLanguageBoost: trimmed(options.minimaxTtsLanguageBoost),
    minimaxSpeed: options.minimaxTtsSpeed,
    minimaxVolume: options.minimaxTtsVolume,
    minimaxPitch: options.minimaxTtsPitch,
    minimaxEmotion: trimmed(options.minimaxTtsEmotion),
    minimaxEnglishNormalization: options.minimaxTtsEnglishNormalization === true,
    minimaxPronunciations: options.minimaxTtsPronunciations?.map((item) => item.trim()).filter(Boolean),
    openaiVoiceId: trimmed(options.openaiVoiceId),
    openaiInstructions: trimmed(options.openaiTtsInstructions),
    openaiSpeed: options.openaiTtsSpeed,
    deepgramSpeed: options.deepgramTtsSpeed,
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
    fishVoiceId: trimmed((options as { fishTtsVoice?: string }).fishTtsVoice),
    inworldVoiceId: trimmed(options.inworldTtsVoice),
    inworldInstructions: trimmed(options.inworldTtsInstructions),
    deepinfraVoiceId: trimmed(options.deepinfraTtsVoice),
    replicateVoiceId: trimmed(options.replicateTtsVoice),
    falVoiceId: trimmed(options.falTtsVoice),
    falInstructions: trimmed(options.falTtsInstructions),
    groqVoiceId: trimmed(options.groqVoiceId),
    grokVoiceId: trimmed(options.grokTtsVoice),
    grokLanguage: trimmed(options.grokTtsLanguage),
    grokTextNormalization: options.grokTtsTextNormalization === true,
    mistralVoiceId: trimmed(options.mistralTtsVoice),
    geminiVoiceId: trimmed(options.geminiVoiceId),
    deepgramVoiceId: trimmed(options.deepgramVoiceId),
    dialogueRequested: multiSpeaker
  }
}
