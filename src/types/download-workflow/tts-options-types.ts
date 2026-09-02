export type TtsRuntimeOptions = {
  ttsAllProvidersSelected: boolean
  ttsAllowAmbiguousRedispatch: boolean
  grokTtsModels: string[] | undefined
  grokTtsVoice: string | undefined
  grokTtsLanguage: string | undefined
  grokTtsTextNormalization: boolean
  mistralTtsModels: string[] | undefined
  mistralTtsVoice: string | undefined
  ttsDialogueFormat: 'screenplay' | 'labeled' | undefined
  ttsSpeakers: string[] | undefined
  openaiTtsModels: string[] | undefined
  openaiVoiceId: string | undefined
  openaiTtsInstructions: string | undefined
  openaiTtsSpeed: number | undefined
  elevenlabsTtsModels: string[] | undefined
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
  speechifyTtsModels: string[] | undefined
  speechifyVoice: string | undefined
  speechifyTtsLanguage: string | undefined
  humeTtsModels: string[] | undefined
  humeTtsVoice: string | undefined
  cartesiaTtsModels: string[] | undefined
  cartesiaTtsVoice: string | undefined
  cartesiaTtsLanguage: string | undefined
  inworldTtsModels: string[] | undefined
  inworldTtsVoice: string | undefined
  inworldTtsInstructions: string | undefined
}

export type TtsRuntimeOptionKey = keyof TtsRuntimeOptions

export type TtsOptionResolutionAuthority = Readonly<{
  cliReferenceInput?: 'standalone-mistral' | undefined
  mistralSpeakerReferences?: 'sanitized' | undefined
}>
