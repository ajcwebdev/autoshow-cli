import { UsageError } from '~/utils/error-handler'

export const OPENAI_TOKEN_TTS_MODEL = 'gpt-4o-mini-tts-2025-12-15'
export const OPENAI_TTS_MAX_INPUT_TOKENS = 2000
export const OPENAI_TTS_MAX_CHARACTERS = 4096
// Local conservative policy, not a provider tokenizer or documented instruction limit:
// UTF-8 bytes bound byte-pair text tokens; reserve room for request framing and count
// instructions against the same budget until the provider establishes a separate one.
export const OPENAI_TTS_TOKEN_RESERVE = 128

export const validateOpenAITtsControls = (instructions?: string, speed = 1): void => {
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) throw UsageError('OpenAI TTS speed must be between 0.25 and 4.')
  if (instructions !== undefined && instructions.length > OPENAI_TTS_MAX_CHARACTERS) throw UsageError('OpenAI TTS instructions exceed the 4,096-character API limit.')
}

export const openAITtsTextByteBudget = (instructions?: string): number => {
  validateOpenAITtsControls(instructions)
  const budget = OPENAI_TTS_MAX_INPUT_TOKENS - OPENAI_TTS_TOKEN_RESERVE - Buffer.byteLength(instructions ?? '')
  if (budget < 1) throw UsageError('OpenAI TTS instructions exhaust the conservative local 2,000-token input budget; shorten the instructions.')
  return budget
}

export const validateOpenAITtsRequest = (text: string, instructions?: string, speed?: number): void => {
  validateOpenAITtsControls(instructions, speed)
  if (!text.trim()) throw UsageError('OpenAI TTS input text is empty.')
  if (text.length > OPENAI_TTS_MAX_CHARACTERS) throw UsageError('OpenAI TTS input exceeds the 4,096-character API limit.')
  if (Buffer.byteLength(text) > openAITtsTextByteBudget(instructions)) throw UsageError('OpenAI TTS input and instructions exceed the conservative local 2,000-token input budget; shorten the text or instructions.')
}
