export type TtsDialogueFormat = 'screenplay' | 'labeled'

export type DialogueTurn = {
  speaker: string
  text: string
}

export type DialogueNormalization = {
  turns: DialogueTurn[]
  normalizedText: string
  spokenCharacterCount: number
}
