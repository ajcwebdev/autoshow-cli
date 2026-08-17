export type ElevenLabsTtsVoiceSettings = {
  stability?: number | undefined
  similarity_boost?: number | undefined
  style?: number | undefined
  use_speaker_boost?: boolean | undefined
  speed?: number | undefined
}

export type ElevenLabsTtsRequestControls = {
  outputFormat?: string | undefined
  languageCode?: string | undefined
  voiceSettings?: ElevenLabsTtsVoiceSettings | undefined
  seed?: number | undefined
  textNormalization?: string | undefined
  pronunciationDictionaryLocators?: string[] | undefined
}

