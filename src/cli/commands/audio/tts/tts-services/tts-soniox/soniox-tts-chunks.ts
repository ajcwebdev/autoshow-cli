import type { TtsChunkingOptions } from '~/types'
import { planProviderTtsChunks } from '../../tts-utils/tts-provider-chunk-policy'

// The REST duration cap is fixed. This ceiling is a heuristic, not a duration guarantee.
export const splitSonioxTtsText = (text: string, chunking?: TtsChunkingOptions): string[] =>
  planProviderTtsChunks({ provider: 'soniox', model: 'tts-rt-v1', text, chunking }).map(chunk => chunk.text)
