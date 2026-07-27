import type { MinimaxMusicModel } from '~/types'


export type MinimaxMusicGenerationPayload = {
  model: MinimaxMusicModel
  prompt: string
} & (
  | { lyrics: string, isInstrumental?: false | undefined }
  | { lyrics?: undefined, isInstrumental: true }
)

export type MinimaxLyricsGenerationResult = {
  lyrics: string
  songTitle?: string | undefined
  styleTags?: string | undefined
}
