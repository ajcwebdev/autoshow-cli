import type { GenerationAllShortcutFlag, GenerationModality, GenerationModelEntry, ImageProvider, MusicProvider, VideoProvider } from '~/types'
import {
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_FAL_IMAGE_MODELS,
  SUPPORTED_FAL_VIDEO_MODELS,
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_GEMINI_MUSIC_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_GROK_IMAGE_MODELS,
  SUPPORTED_GROK_VIDEO_MODELS,
  SUPPORTED_LTX_VIDEO_MODELS,
  SUPPORTED_LUMALABS_IMAGE_MODELS,
  SUPPORTED_LUMALABS_VIDEO_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS,
  SUPPORTED_REPLICATE_IMAGE_MODELS,
  SUPPORTED_REPLICATE_VIDEO_MODELS,
  validateElevenlabsMusicModel,
  validateFalImageModel,
  validateFalVideoModel,
  validateGeminiImageModel,
  validateGeminiMusicModel,
  validateGeminiVideoModel,
  validateGrokImageModel,
  validateGrokVideoModel,
  validateLtxVideoModel,
  validateLumalabsImageModel,
  validateLumalabsVideoModel,
  validateMinimaxMusicModel,
  validateOpenAIImageModel,
  validateReplicateImageModel,
  validateReplicateVideoModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import {
  IMAGE_SELECTION_ENTRIES,
  MUSIC_SELECTION_ENTRIES,
  VIDEO_SELECTION_ENTRIES
} from './generation-selection-entries'

type ModelFacts = Pick<GenerationModelEntry, 'supportedModels' | 'validateModel'>

const IMAGE_MODEL_FACTS = {
  gemini: { supportedModels: SUPPORTED_GEMINI_IMAGE_MODELS, validateModel: validateGeminiImageModel },
  openai: { supportedModels: SUPPORTED_OPENAI_IMAGE_MODELS, validateModel: validateOpenAIImageModel },
  grok: { supportedModels: SUPPORTED_GROK_IMAGE_MODELS, validateModel: validateGrokImageModel },
  replicate: { supportedModels: SUPPORTED_REPLICATE_IMAGE_MODELS, validateModel: validateReplicateImageModel },
  lumalabs: { supportedModels: SUPPORTED_LUMALABS_IMAGE_MODELS, validateModel: validateLumalabsImageModel },
  fal: { supportedModels: SUPPORTED_FAL_IMAGE_MODELS, validateModel: validateFalImageModel }
} as const satisfies Record<ImageProvider, ModelFacts>

const VIDEO_MODEL_FACTS = {
  gemini: { supportedModels: SUPPORTED_GEMINI_VIDEO_MODELS, validateModel: validateGeminiVideoModel },
  grok: { supportedModels: SUPPORTED_GROK_VIDEO_MODELS, validateModel: validateGrokVideoModel },
  ltx: { supportedModels: SUPPORTED_LTX_VIDEO_MODELS, validateModel: validateLtxVideoModel },
  replicate: { supportedModels: SUPPORTED_REPLICATE_VIDEO_MODELS, validateModel: validateReplicateVideoModel },
  lumalabs: { supportedModels: SUPPORTED_LUMALABS_VIDEO_MODELS, validateModel: validateLumalabsVideoModel },
  fal: { supportedModels: SUPPORTED_FAL_VIDEO_MODELS, validateModel: validateFalVideoModel }
} as const satisfies Record<VideoProvider, ModelFacts>

const MUSIC_MODEL_FACTS = {
  elevenlabs: { supportedModels: SUPPORTED_ELEVENLABS_MUSIC_MODELS, validateModel: validateElevenlabsMusicModel },
  minimax: { supportedModels: SUPPORTED_MINIMAX_MUSIC_MODELS, validateModel: validateMinimaxMusicModel },
  gemini: { supportedModels: SUPPORTED_GEMINI_MUSIC_MODELS, validateModel: validateGeminiMusicModel }
} as const satisfies Record<MusicProvider, ModelFacts>

const GENERATION_ALL_SHORTCUTS = {
  image: 'all-image',
  video: 'all-video',
  music: 'all-music'
} as const satisfies Record<GenerationModality, GenerationAllShortcutFlag>

export const IMAGE_MODEL_ENTRIES: readonly GenerationModelEntry<ImageProvider>[] = IMAGE_SELECTION_ENTRIES.map(entry => ({
  ...entry, ...IMAGE_MODEL_FACTS[entry.service], allShortcut: GENERATION_ALL_SHORTCUTS.image
}))

export const VIDEO_MODEL_ENTRIES: readonly GenerationModelEntry<VideoProvider>[] = VIDEO_SELECTION_ENTRIES.map(entry => ({
  ...entry, ...VIDEO_MODEL_FACTS[entry.service], allShortcut: GENERATION_ALL_SHORTCUTS.video
}))

export const MUSIC_MODEL_ENTRIES: readonly GenerationModelEntry<MusicProvider>[] = MUSIC_SELECTION_ENTRIES.map(entry => ({
  ...entry, ...MUSIC_MODEL_FACTS[entry.service], allShortcut: GENERATION_ALL_SHORTCUTS.music
}))

export const GENERATION_MODEL_ENTRIES: readonly GenerationModelEntry[] = [
  ...IMAGE_MODEL_ENTRIES,
  ...VIDEO_MODEL_ENTRIES,
  ...MUSIC_MODEL_ENTRIES
]

export const getGenerationModelEntry = (
  flagName: string
): GenerationModelEntry | undefined => GENERATION_MODEL_ENTRIES.find(entry => entry.flagName === flagName)

/** Drives `--all-image`, `--all-video` and `--all-music` expansion from the same entries the flags come from. */
export const getGenerationAllShortcutModelExpansions = (): Record<string, { shortcut: GenerationAllShortcutFlag, supported: readonly string[] }> =>
  Object.fromEntries(GENERATION_MODEL_ENTRIES.map(entry => [
    entry.flagName,
    { shortcut: entry.allShortcut, supported: entry.supportedModels }
  ]))
