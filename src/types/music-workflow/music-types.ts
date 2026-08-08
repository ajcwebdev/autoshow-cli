import type * as v from 'valibot'
import { MinimaxMusicResponseSchema } from '~/cli/commands/process-steps/step-7-music/music-services/music-minimax/run-minimax-music-gen'
import type { MusicProvider, ProcessingOptions, ProviderModelBase, ProviderTargetBase, ResourceGate, Step7MusicMetadata } from '~/types'

export type MusicGenOptions = Pick<
  ProcessingOptions,
  'elevenlabsMusicModels' | 'elevenlabsMusicModel' | 'minimaxMusicModels' | 'minimaxMusicModel' | 'geminiMusicModels' | 'geminiMusicModel' | 'musicDuration' | 'musicLyricsFile' | 'musicInstrumental' | 'musicProviderConcurrency' | 'musicLocalConcurrency'
> & {
  generationResourceGate?: ResourceGate | undefined
}

export type MusicTarget = ProviderTargetBase<MusicProvider> & {
  run: (prompt: string, outputDir: string) => Promise<{ musicPath: string, metadata: Step7MusicMetadata }>
}

export type MinimaxMusicResponse = v.InferOutput<typeof MinimaxMusicResponseSchema>

export type MusicCostEstimate = ProviderModelBase<MusicProvider> & {
  totalCost: number
  durationSeconds: number
  lyricsSource: 'provided' | 'generated' | 'none'
  note?: string
}

