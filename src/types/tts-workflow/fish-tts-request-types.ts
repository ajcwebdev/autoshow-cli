import type { PreparedProviderText } from '~/types'

export type FishNativeDialogueTurn = {
  turnId: string
  subjectKey: string
  speaker: string
  canonicalText: string
  voiceId: string
  delivery?: string | undefined
}

export type FishPreparedDialogueTurn = FishNativeDialogueTurn & {
  preparedText: PreparedProviderText
  speakerIndex: number
}

export type FishNativeDialogueBatch = {
  batchIndex: number
  turns: FishPreparedDialogueTurn[]
  providerText: string
  referenceIds: string[]
}
