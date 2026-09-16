import type { GenerationModality, GenerationSelectionEntry, ImageProvider, MusicProvider, VideoProvider } from '~/types'

/**
 * The single declarative roster for generation providers. This module stays free of provider
 * implementations so the flag layer can derive its surface without pulling in transport code;
 * `*-providers.ts` attaches validators and collectors to the same entries for dispatch.
 */
export const IMAGE_SELECTION_ENTRIES = [
  { modality: 'image', service: 'gemini', flagName: 'gemini-image', runtimeModelsKey: 'geminiImageModels', credentialDescription: 'Gemini image generation' },
  { modality: 'image', service: 'openai', flagName: 'openai-image', runtimeModelsKey: 'openaiImageModels', credentialDescription: 'OpenAI image generation' },
  { modality: 'image', service: 'grok', flagName: 'grok-image', runtimeModelsKey: 'grokImageModels', credentialDescription: 'Grok image generation' },
  { modality: 'image', service: 'replicate', flagName: 'replicate-image', runtimeModelsKey: 'replicateImageModels', credentialDescription: 'Replicate image generation' },
  { modality: 'image', service: 'lumalabs', flagName: 'lumalabs-image', runtimeModelsKey: 'lumalabsImageModels', credentialDescription: 'Luma Labs image generation' },
  { modality: 'image', service: 'fal', flagName: 'fal-image', runtimeModelsKey: 'falImageModels', credentialDescription: 'fal.ai image generation' }
] as const satisfies readonly GenerationSelectionEntry<ImageProvider>[]

export const VIDEO_SELECTION_ENTRIES = [
  { modality: 'video', service: 'gemini', flagName: 'gemini-video', runtimeModelsKey: 'geminiVideoModels', credentialDescription: 'Gemini video generation' },
  { modality: 'video', service: 'grok', flagName: 'grok-video', runtimeModelsKey: 'grokVideoModels', credentialDescription: 'Grok video generation' },
  { modality: 'video', service: 'ltx', flagName: 'ltx-video', runtimeModelsKey: 'ltxVideoModels', credentialDescription: 'LTX video generation' },
  { modality: 'video', service: 'replicate', flagName: 'replicate-video', runtimeModelsKey: 'replicateVideoModels', credentialDescription: 'Replicate video generation' },
  { modality: 'video', service: 'lumalabs', flagName: 'lumalabs-video', runtimeModelsKey: 'lumalabsVideoModels', credentialDescription: 'Luma Labs video generation' },
  { modality: 'video', service: 'fal', flagName: 'fal-video', runtimeModelsKey: 'falVideoModels', credentialDescription: 'fal.ai video generation' }
] as const satisfies readonly GenerationSelectionEntry<VideoProvider>[]

export const MUSIC_SELECTION_ENTRIES = [
  { modality: 'music', service: 'elevenlabs', flagName: 'elevenlabs-music', runtimeModelsKey: 'elevenlabsMusicModels', credentialDescription: 'ElevenLabs music generation' },
  { modality: 'music', service: 'minimax', flagName: 'minimax-music', runtimeModelsKey: 'minimaxMusicModels', credentialDescription: 'MiniMax music generation' },
  { modality: 'music', service: 'gemini', flagName: 'gemini-music', runtimeModelsKey: 'geminiMusicModels', credentialDescription: 'Gemini music generation' }
] as const satisfies readonly GenerationSelectionEntry<MusicProvider>[]

export const GENERATION_SELECTION_ENTRIES = [
  ...IMAGE_SELECTION_ENTRIES,
  ...VIDEO_SELECTION_ENTRIES,
  ...MUSIC_SELECTION_ENTRIES
] as const satisfies readonly GenerationSelectionEntry[]

export const getGenerationSelectionEntries = (
  modality: GenerationModality
): readonly GenerationSelectionEntry[] =>
  GENERATION_SELECTION_ENTRIES.filter(entry => entry.modality === modality)
