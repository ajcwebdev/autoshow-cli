import type { SpeakerVoiceRegistry } from '~/types'

export type TtsTargetSelection = {
  elevenlabsModels: string[]
  grokModels: string[]
  mistralModels: string[]
  openaiModels: string[]
  speechifyModels: string[]
  humeModels: string[]
  cartesiaModels: string[]
  inworldModels: string[]
  speakerVoiceRegistry: SpeakerVoiceRegistry | undefined
  multiSpeakerRequested: boolean
  openaiVoiceId: string | undefined
  openaiInstructions: string | undefined
  openaiSpeed: number | undefined
  elevenLabsVoiceId: string | undefined
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
  speechifyLanguage: string | undefined
  humeVoice: string | undefined
  cartesiaVoiceId: string | undefined
  cartesiaLanguage: string | undefined
  inworldVoiceId: string | undefined
  inworldInstructions: string | undefined
  grokVoiceId: string | undefined
  grokLanguage: string | undefined
  grokTextNormalization: boolean
  mistralVoiceId: string | undefined
  dialogueRequested: boolean
}
