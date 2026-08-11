export type TtsRuntimeOptions = {
  ttsSpeaker: string
  kittenTtsModels: string[] | undefined
  kittenTtsModel: string | undefined
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
  elevenlabsTtsOutputFormat: string | undefined
  elevenlabsTtsLanguageCode: string | undefined
  elevenlabsTtsStability: number | undefined
  elevenlabsTtsSimilarityBoost: number | undefined
  elevenlabsTtsStyle: number | undefined
  elevenlabsTtsUseSpeakerBoost: boolean
  elevenlabsTtsSpeed: number | undefined
  elevenlabsTtsSeed: number | undefined
  elevenlabsTtsTextNormalization: string | undefined
  elevenlabsTtsPronunciationDictionaryLocators: string[] | undefined
  elevenlabsTtsOptimizeStreamingLatency: number | undefined
  deepgramTtsModels: string[] | undefined
  deepgramTtsModel: string | undefined
  deepgramVoiceId: string | undefined
  deepgramTtsEncoding: string | undefined
  deepgramTtsContainer: string | undefined
  deepgramTtsBitRate: number | undefined
  deepgramTtsSampleRate: number | undefined
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
  speechifyTtsAudioFormat: string | undefined
  speechifyTtsLanguage: string | undefined
  humeTtsModels: string[] | undefined
  humeTtsModel: string | undefined
  humeTtsVoice: string | undefined
  humeTtsVoiceProvider: string | undefined
  cartesiaTtsModels: string[] | undefined
  cartesiaTtsModel: string | undefined
  cartesiaTtsVoice: string | undefined
  cartesiaTtsLanguage: string | undefined
}

export type TtsRuntimeOptionKey = keyof TtsRuntimeOptions

// These keys remain readable only long enough to reject legacy CLI/config creation inputs with
// migration guidance. They are deliberately not part of any synthesis runtime option bag.
export type TtsLegacyCreationDiagnosticOptions = {
  mistralTtsVoiceName: string | undefined
  elevenlabsTtsRefAudio: string | undefined
  elevenlabsTtsVoiceName: string | undefined
  elevenlabsTtsCloneRemoveBackgroundNoise: boolean
  speechifyTtsRefAudio: string | undefined
  speechifyTtsVoiceName: string | undefined
  speechifyTtsConsentName: string | undefined
  speechifyTtsConsentEmail: string | undefined
  speechifyTtsVoiceLocale: string | undefined
  speechifyTtsVoiceGender: string | undefined
}

export type TtsLegacyCreationDiagnosticOptionKey = keyof TtsLegacyCreationDiagnosticOptions

export type TtsOptionResolutionAuthority = Readonly<{
  cliReferenceInput?: 'standalone-mistral' | undefined
  mistralSpeakerReferences?: 'sanitized' | undefined
}>
