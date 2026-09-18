import type { TtsProvider, VoiceOrigin } from '~/types'


export type CharacterVoiceBrief = {
  subjectKey: string
  profileKey: string
  language?: string | undefined
  locale?: string | undefined
  accent?: { description: string, strength?: 'light' | 'moderate' | 'strong' | undefined } | undefined
  apparentAgeRange?: { minimum: number, maximum: number } | undefined
  genderPresentation?: string | undefined
  pitchRegister?: string | undefined
  timbre?: string | undefined
  resonance?: string | undefined
  pace?: string | undefined
  energy?: string | undefined
  texture?: string | undefined
  mannerisms: string[]
  defaultDelivery?: string | undefined
  prohibitedCaricatures: string[]
  pronunciations: Array<{ term: string, pronunciation: string }>
  allowedOrigins: VoiceOrigin[]
  preferredProviders?: TtsProvider[] | undefined
}

export type CharacterVoiceBriefCatalog = {
  schemaVersion: 1
  briefs: CharacterVoiceBrief[]
}
