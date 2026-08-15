import type { SpeakerVoiceRegistry } from '~/types'

export type TtsTargetSelection = {
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
  fishModels: string[]
  inworldModels: string[]
  deepinfraModels: string[]
  replicateModels: string[]
  falModels: string[]
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
  speechifyVoiceId: string | undefined
  speechifyAudioFormat: string | undefined
  speechifyLanguage: string | undefined
  humeVoice: string | undefined
  humeVoiceProvider: string | undefined
  cartesiaVoiceId: string | undefined
  cartesiaLanguage: string | undefined
  fishVoiceId: string | undefined
  inworldVoiceId: string | undefined
  inworldInstructions: string | undefined
  deepinfraVoiceId: string | undefined
  replicateVoiceId: string | undefined
  falVoiceId: string | undefined
  falInstructions: string | undefined
  groqVoiceId: string | undefined
  grokVoiceId: string | undefined
  grokLanguage: string | undefined
  grokTextNormalization: boolean
  mistralVoiceId: string | undefined
  geminiVoiceId: string | undefined
  deepgramVoiceId: string | undefined
  dialogueRequested: boolean
}
