export type TtsRuntimeOptions = {
  ttsAllowAmbiguousRedispatch: boolean
  groqTtsModels: string[] | undefined
  groqTtsModel: string | undefined
  groqVoiceId: string | undefined
  grokTtsModels: string[] | undefined
  grokTtsModel: string | undefined
  grokTtsVoice: string | undefined
  grokTtsLanguage: string | undefined
  grokTtsTextNormalization: boolean
  mistralTtsModels: string[] | undefined
  mistralTtsModel: string | undefined
  mistralTtsVoice: string | undefined
  ttsDialogueFormat: 'screenplay' | 'labeled' | undefined
  ttsSpeakers: string[] | undefined
  openaiTtsModels: string[] | undefined
  openaiTtsModel: string | undefined
  openaiVoiceId: string | undefined
  openaiTtsInstructions: string | undefined
  openaiTtsSpeed: number | undefined
  geminiTtsModels: string[] | undefined
  geminiTtsModel: string | undefined
  geminiVoiceId: string | undefined
  elevenlabsTtsModels: string[] | undefined
  elevenlabsTtsModel: string | undefined
  elevenlabsVoiceId: string | undefined
  elevenlabsTtsLanguageCode: string | undefined
  elevenlabsTtsStability: number | undefined
  elevenlabsTtsSimilarityBoost: number | undefined
  elevenlabsTtsStyle: number | undefined
  elevenlabsTtsUseSpeakerBoost: boolean
  elevenlabsTtsSpeed: number | undefined
  elevenlabsTtsSeed: number | undefined
  elevenlabsTtsTextNormalization: string | undefined
  elevenlabsTtsPronunciationDictionaryLocators: string[] | undefined
  deepgramTtsModels: string[] | undefined
  deepgramTtsModel: string | undefined
  deepgramVoiceId: string | undefined
  deepgramTtsSpeed: number | undefined
  minimaxTtsModels: string[] | undefined
  minimaxTtsModel: string | undefined
  minimaxTtsVoice: string | undefined
  minimaxTtsLanguageBoost: string | undefined
  minimaxTtsSpeed: number | undefined
  minimaxTtsVolume: number | undefined
  minimaxTtsPitch: number | undefined
  minimaxTtsEmotion: string | undefined
  minimaxTtsEnglishNormalization: boolean
  minimaxTtsPronunciations: string[] | undefined
  speechifyTtsModels: string[] | undefined
  speechifyTtsModel: string | undefined
  speechifyVoice: string | undefined
  speechifyTtsLanguage: string | undefined
  humeTtsModels: string[] | undefined
  humeTtsModel: string | undefined
  humeTtsVoice: string | undefined
  cartesiaTtsModels: string[] | undefined
  cartesiaTtsModel: string | undefined
  cartesiaTtsVoice: string | undefined
  cartesiaTtsLanguage: string | undefined
  fishTtsModels: string[] | undefined
  fishTtsModel: string | undefined
  fishTtsVoice: string | undefined
  inworldTtsModels: string[] | undefined
  inworldTtsModel: string | undefined
  inworldTtsVoice: string | undefined
  inworldTtsInstructions: string | undefined
  deepinfraTtsModels: string[] | undefined
  deepinfraTtsModel: string | undefined
  deepinfraTtsVoice: string | undefined
  replicateTtsModels: string[] | undefined
  replicateTtsModel: string | undefined
  replicateTtsVoice: string | undefined
  falTtsModels: string[] | undefined
  falTtsModel: string | undefined
  falTtsVoice: string | undefined
  falTtsInstructions: string | undefined
}

export type TtsRuntimeOptionKey = keyof TtsRuntimeOptions

export type TtsOptionResolutionAuthority = Readonly<{
  cliReferenceInput?: 'standalone-mistral' | undefined
  mistralSpeakerReferences?: 'sanitized' | undefined
}>
