import type { PreparedProviderText } from '~/types'

export type ElevenLabsNativeDialogueTurn = {
  turnId: string
  subjectKey: string
  speaker: string
  canonicalText: string
  voiceId: string
  delivery?: string | undefined
}

export type ElevenLabsPreparedDialogueTurn = ElevenLabsNativeDialogueTurn & {
  preparedText: PreparedProviderText
}

export type ElevenLabsNativeDialogueBatch = {
  batchIndex: number
  turns: ElevenLabsPreparedDialogueTurn[]
  providerText: string
}

export type ElevenLabsAlignment = {
  characters?: unknown
  character_start_times_seconds?: unknown
  character_end_times_seconds?: unknown
}

export type ElevenLabsVoiceSegment = {
  start_time_seconds?: unknown
  end_time_seconds?: unknown
  character_start_index?: unknown
  character_end_index?: unknown
  dialogue_input_index?: unknown
}

export type ElevenLabsDialogueTimingResponse = {
  voice_segments?: unknown
  alignment?: ElevenLabsAlignment | null | undefined
  normalized_alignment?: ElevenLabsAlignment | null | undefined
}
