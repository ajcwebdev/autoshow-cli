export type VoiceQualityScoreInput = {
  key: string
  score: number | null
  weight: number
}


export type VoiceQualityRankable = {
  providerKey: string
  humanSpeechScore: number | null
  naturalnessScore: number | null
  speechQualityScore: number | null
  scoreCoverage?: {
    humanSpeech?: { availableWeight: number; totalWeight: number }
  }
}


export type VoiceQualityAggregate = {
  score: number | null
  availableWeight: number
  totalWeight: number
  missingKeys: string[]
}

export type VoiceQualityRanked<T extends VoiceQualityRankable> = T & {
  rank: number
}
