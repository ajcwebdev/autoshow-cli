import type { GeminiMultiSpeakerConfig, SpeakerVoiceRegistry } from '~/types'

export type TtsTargetSelection = {
  kittenModels: string[]
  elevenlabsModels: string[]
  minimaxModels: string[]
  groqModels: string[]
  grokModels: string[]
  mistralModels: string[]
  openaiModels: string[]
  geminiModels: string[]
  deepgramModels: string[]
  speechifyModels: string[]
  humeModels: string[]
  cartesiaModels: string[]
  geminiMultiSpeakerConfig: GeminiMultiSpeakerConfig | undefined
  speakerVoiceRegistry: SpeakerVoiceRegistry | undefined
  multiSpeakerRequested: boolean
  minimaxVoiceId: string | undefined
  minimaxLanguageBoost: string | undefined
  minimaxSpeed: number | undefined
  minimaxVolume: number | undefined
  minimaxPitch: number | undefined
  minimaxEmotion: string | undefined
  minimaxEnglishNormalization: boolean
  minimaxPronunciations: string[] | undefined
  openaiVoiceId: string | undefined
  openaiInstructions: string | undefined
  openaiSpeed: number | undefined
  deepgramEncoding: string | undefined
  deepgramContainer: string | undefined
  deepgramBitRate: number | undefined
  deepgramSampleRate: number | undefined
  deepgramSpeed: number | undefined
  elevenLabsCloneRefAudioPath: string | undefined
  elevenLabsCloneVoiceName: string | undefined
  elevenLabsCloneRemoveBackgroundNoise: boolean
  elevenLabsVoiceId: string | undefined
  elevenLabsOutputFormat: string | undefined
  elevenLabsLanguageCode: string | undefined
  elevenLabsStability: number | undefined
  elevenLabsSimilarityBoost: number | undefined
  elevenLabsStyle: number | undefined
  elevenLabsUseSpeakerBoost: boolean
  elevenLabsSpeed: number | undefined
  elevenLabsSeed: number | undefined
  elevenLabsTextNormalization: string | undefined
  elevenLabsPronunciationDictionaryLocators: string[] | undefined
  elevenLabsOptimizeStreamingLatency: number | undefined
  speechifyCustomVoiceRefAudioPath: string | undefined
  speechifyCustomVoiceName: string | undefined
  speechifyCustomVoiceConsentName: string | undefined
  speechifyCustomVoiceConsentEmail: string | undefined
  speechifyCustomVoiceLocale: string | undefined
  speechifyCustomVoiceGender: string | undefined
  speechifyVoiceId: string | undefined
  speechifyAudioFormat: string | undefined
  speechifyLanguage: string | undefined
  humeVoice: string | undefined
  humeVoiceProvider: string | undefined
  cartesiaVoiceId: string | undefined
  cartesiaLanguage: string | undefined
  groqVoiceId: string | undefined
  grokVoiceId: string | undefined
  grokLanguage: string | undefined
  grokTextNormalization: boolean
  mistralVoiceId: string | undefined
  mistralRefAudioPath: string | undefined
  mistralVoiceName: string | undefined
  geminiVoiceId: string | undefined
  deepgramVoiceId: string | undefined
  hasElevenLabsCloneFlags: boolean
  hasSpeechifyCustomVoiceFlags: boolean
  hasElevenLabsVoiceNameOnly: boolean
  dialogueRequested: boolean
}
