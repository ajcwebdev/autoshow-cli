import type { TtsChunkingOptions } from '~/types'
import { planProviderTtsChunks } from '../../tts-utils/tts-provider-chunk-policy'
import type { GeminiSpeechTurn } from './gemini-tts-request'

export const splitGeminiTtsText = (model: string, turn: GeminiSpeechTurn, chunking?: TtsChunkingOptions): string[] =>
  planProviderTtsChunks({ provider: 'gemini', model, ...turn, chunking }).map(chunk => chunk.text)
