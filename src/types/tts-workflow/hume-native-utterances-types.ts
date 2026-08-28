export type HumeNativeUtteranceTurn = {
  turnId: string
  subjectKey: string
  speaker: string
  canonicalText: string
  voiceId: string
  speed?: number | undefined
  trailingSilence?: number | undefined
  delivery?: string | undefined
}

export type HumeNativeUtteranceBatch = {
  batchIndex: number
  turns: HumeNativeUtteranceTurn[]
  providerText: string
}

export type HumeGenerationResponse = {
  audio?: unknown
  duration?: unknown
  generation_id?: unknown
  snippets?: unknown
}
