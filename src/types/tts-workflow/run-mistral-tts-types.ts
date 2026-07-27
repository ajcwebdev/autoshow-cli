
export type MistralReferenceAudio = {
  base64: string
  uploadPath: string
  convertedPath?: string | undefined
}

export type MistralSavedVoiceResult = {
  voiceId: string
  voiceName: string
}

export type MistralVoiceSource =
  | { kind: 'voice', value: string, speaker: string }
  | { kind: 'refAudio', path: string, speaker: string }

