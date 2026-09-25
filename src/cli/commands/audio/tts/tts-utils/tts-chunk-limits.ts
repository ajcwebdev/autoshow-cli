import type { TtsProvider } from '~/types'
import { getTtsMaxInputCharacters } from '~/cli/commands/setup-and-utilities/models/model-loader'

export const TTS_CHUNK_CHARACTER_LIMITS = {
  gemini: 2000,
  elevenlabs: 2000,
  openai: 2000,
  soniox: 500,
  grok: 2000,
  inworld: 2000,
} as const satisfies Record<TtsProvider, number | undefined>

export const resolveTtsChunkCharacterLimit = (
  provider: TtsProvider,
  model: string | undefined
): number | undefined =>
  model ? getTtsMaxInputCharacters(provider, model) ?? TTS_CHUNK_CHARACTER_LIMITS[provider] : TTS_CHUNK_CHARACTER_LIMITS[provider]
