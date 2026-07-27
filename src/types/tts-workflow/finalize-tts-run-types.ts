import type { TtsProvider } from '~/types'

export type FinalizeTtsRunOptions = {
  service: TtsProvider
  model: string
  speaker?: string | undefined
  audioPath: string
  chunkCount: number
  startTime: number
}
