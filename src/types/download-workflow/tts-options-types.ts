export type TtsRuntimeOptions = {
  geminiTtsModels?: string[] | undefined
  geminiTtsVoice?: string | undefined
  geminiTtsInstructions?: string | undefined
  geminiTtsResponseFormat?: string | undefined
  geminiTtsMode?: 'unary' | 'stream' | 'batch' | undefined
  geminiTtsBatchWaitSeconds?: number | undefined

  ttsAllProvidersSelected: boolean
  ttsAllowAmbiguousRedispatch: boolean
  sonioxTtsModels?: string[] | undefined
  sonioxTtsVoice?: string | undefined
  sonioxTtsLanguage?: string | undefined
  sonioxTtsSpeed?: number | undefined
  grokTtsModels: string[] | undefined
  grokTtsSpeed?: number | undefined
  grokTtsVoice: string | undefined
  grokTtsLanguage: string | undefined
  grokTtsTextNormalization: boolean
  mistralTtsModels: string[] | undefined
  mistralTtsVoice: string | undefined
  mistralTtsResponseFormat?: string | undefined
  elevenlabsTtsResponseFormat?: string | undefined
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
  inworldTtsModels: string[] | undefined
  inworldTtsVoice: string | undefined
  inworldTtsInstructions: string | undefined
  inworldTtsSpeed: number | undefined
}

export type TtsRuntimeOptionKey = keyof TtsRuntimeOptions

export type TtsOptionResolutionAuthority = Readonly<{
  cliReferenceInput?: 'standalone-mistral' | undefined
  mistralSpeakerReferences?: 'sanitized' | undefined
}>
