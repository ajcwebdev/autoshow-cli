export type TtsDialogueFormat = 'screenplay' | 'labeled'

export type DialogueTurnDelivery = {
  kind: 'parenthetical'
  sourceText: string
  descriptions: string[]
}

export type DialogueTurn = {
  speaker: string
  text: string
  delivery?: DialogueTurnDelivery | undefined
}

export type DialogueNormalization = {
  turns: DialogueTurn[]
  normalizedText: string
  spokenCharacterCount: number
}
