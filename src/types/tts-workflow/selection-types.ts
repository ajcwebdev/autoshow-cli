import type { SpeakerVoiceRegistry } from '~/types'

export type TtsTargetSelection = {
  geminiModels: string[]
  geminiVoice?: string | undefined
  geminiInstructions?: string | undefined
  geminiResponseFormat?: string | undefined
  geminiMode?: 'unary' | 'stream' | 'batch' | undefined
  geminiBatchWaitSeconds?: number | undefined

  elevenlabsModels: string[]
  sonioxModels?: string[] | undefined
  sonioxVoiceId?: string | undefined
  sonioxLanguage?: string | undefined
  sonioxSpeed?: number | undefined
  grokModels: string[]
  mistralModels: string[]
  openaiModels: string[]
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
  inworldVoiceId: string | undefined
  inworldInstructions: string | undefined
  inworldSpeed: number | undefined
  grokVoiceId: string | undefined
  grokSpeed?: number | undefined
  grokLanguage: string | undefined
  grokTextNormalization: boolean
  mistralVoiceId: string | undefined
  mistralResponseFormat?: string | undefined
  elevenLabsResponseFormat?: string | undefined
  dialogueRequested: boolean
}
