import type { TtsOptions, TtsTargetSelection } from '~/types'
import { isMultiSpeakerRequested, parseSpeakerVoiceMappings } from '../dialogue-normalizer'
const selectModels = (
  models: string[] | undefined,
  model: string | undefined
): string[] => models ?? (model ? [model] : [])

const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined

export const createTtsTargetSelection = (options: TtsOptions): TtsTargetSelection => {
  const elevenLabsPronunciationDictionaryLocators = options.elevenlabsTtsPronunciationDictionaryLocators?.map((item) => item.trim()).filter(Boolean)

  const multiSpeaker = isMultiSpeakerRequested(options)
  const speakerVoiceRegistry = multiSpeaker
    ? parseSpeakerVoiceMappings(options.ttsSpeakers)
    : undefined

  return {
    kittenModels: selectModels(options.kittenTtsModels, options.kittenTtsModel),
    elevenlabsModels: selectModels(options.elevenlabsTtsModels, options.elevenlabsTtsModel),
    minimaxModels: selectModels(options.minimaxTtsModels, options.minimaxTtsModel),
    groqModels: selectModels(options.groqTtsModels, options.groqTtsModel),
    grokModels: selectModels(options.grokTtsModels, options.grokTtsModel),
    mistralModels: selectModels(options.mistralTtsModels, options.mistralTtsModel),
    openaiModels: selectModels(options.openaiTtsModels, options.openaiTtsModel),
    geminiModels: selectModels(options.geminiTtsModels, options.geminiTtsModel),
    deepgramModels: selectModels(options.deepgramTtsModels, options.deepgramTtsModel),
    speechifyModels: selectModels(options.speechifyTtsModels, options.speechifyTtsModel),
    humeModels: selectModels(options.humeTtsModels, options.humeTtsModel),
    cartesiaModels: selectModels(options.cartesiaTtsModels, options.cartesiaTtsModel),
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
    deepgramEncoding: trimmed(options.deepgramTtsEncoding),
    deepgramContainer: trimmed(options.deepgramTtsContainer),
    deepgramBitRate: options.deepgramTtsBitRate,
    deepgramSampleRate: options.deepgramTtsSampleRate,
    deepgramSpeed: options.deepgramTtsSpeed,
    elevenLabsVoiceId: trimmed(options.elevenlabsVoiceId),
    elevenLabsOutputFormat: trimmed(options.elevenlabsTtsOutputFormat),
    elevenLabsLanguageCode: trimmed(options.elevenlabsTtsLanguageCode),
    elevenLabsStability: options.elevenlabsTtsStability,
    elevenLabsSimilarityBoost: options.elevenlabsTtsSimilarityBoost,
    elevenLabsStyle: options.elevenlabsTtsStyle,
    elevenLabsUseSpeakerBoost: options.elevenlabsTtsUseSpeakerBoost === true,
    elevenLabsSpeed: options.elevenlabsTtsSpeed,
    elevenLabsSeed: options.elevenlabsTtsSeed,
    elevenLabsTextNormalization: trimmed(options.elevenlabsTtsTextNormalization),
    elevenLabsPronunciationDictionaryLocators,
    elevenLabsOptimizeStreamingLatency: options.elevenlabsTtsOptimizeStreamingLatency,
    speechifyVoiceId: trimmed(options.speechifyVoice),
    speechifyAudioFormat: trimmed(options.speechifyTtsAudioFormat),
    speechifyLanguage: trimmed(options.speechifyTtsLanguage),
    humeVoice: trimmed(options.humeTtsVoice),
    humeVoiceProvider: trimmed(options.humeTtsVoiceProvider),
    cartesiaVoiceId: trimmed(options.cartesiaTtsVoice),
    cartesiaLanguage: trimmed(options.cartesiaTtsLanguage),
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
