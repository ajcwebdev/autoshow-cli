import type { ProviderIdentityBase, Step3Metadata, StructuredRequestOptions } from '~/types'

export type TranscribeEngine = 'reverb' | 'deepgram' | 'deepinfra' | 'soniox' | 'speechmatics' | 'rev' | 'groq' | 'grok' | 'mistral' | 'assemblyai' | 'gladia' | 'happyscribe' | 'supadata' | 'scrapecreators' | 'gemini-stt' | 'together' | 'whisper' | 'whisperfile' | 'youtube-captions'

export type ProviderTargetBase<TService extends string> = ProviderIdentityBase<TService>

export type LLMTarget = ProviderTargetBase<Step3Metadata['llmService']> & {
  label: string
  run: (prompt: string, model: string, structuredOpts?: StructuredRequestOptions) => Promise<{ result: string; metadata: Step3Metadata }>
}
