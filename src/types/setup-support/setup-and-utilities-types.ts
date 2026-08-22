import type { InferOutput } from 'valibot'
import {
SUPPORTED_BFL_IMAGE_MODELS,
SUPPORTED_FAL_IMAGE_MODELS,
SUPPORTED_GEMINI_IMAGE_MODELS,
SUPPORTED_GROK_IMAGE_MODELS,
SUPPORTED_LUMALABS_IMAGE_MODELS,
SUPPORTED_OPENAI_IMAGE_MODELS,
SUPPORTED_REPLICATE_IMAGE_MODELS,
} from '~/cli/commands/setup-and-utilities/models/image-models'
import {
SUPPORTED_GROQ_MODELS
} from '~/cli/commands/setup-and-utilities/models/llm-models'
import { ModelRegistrySchema } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
SUPPORTED_ELEVENLABS_MUSIC_MODELS,
SUPPORTED_GEMINI_MUSIC_MODELS,
SUPPORTED_MINIMAX_MUSIC_MODELS
} from '~/cli/commands/setup-and-utilities/models/music-models'
import {
  SUPPORTED_CARTESIA_TTS_MODELS,
  SUPPORTED_FISH_TTS_MODELS,
  SUPPORTED_INWORLD_TTS_MODELS,
  SUPPORTED_DEEPINFRA_TTS_MODELS,
  SUPPORTED_REPLICATE_TTS_MODELS,
  SUPPORTED_FAL_TTS_MODELS,
  SUPPORTED_DEEPGRAM_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_HUME_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_MISTRAL_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_SPEECHIFY_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/tts-models'
import {
SUPPORTED_GEMINI_VIDEO_MODELS,
SUPPORTED_FAL_VIDEO_MODELS,
SUPPORTED_GROK_VIDEO_MODELS,
SUPPORTED_LTX_VIDEO_MODELS,
SUPPORTED_LUMALABS_VIDEO_MODELS,
SUPPORTED_REPLICATE_VIDEO_MODELS
} from '~/cli/commands/setup-and-utilities/models/video-models'
import type { AutoshowConfigSchema, CommandResultBase } from '~/types'

export type AutoshowConfig = InferOutput<typeof AutoshowConfigSchema>

export type ModelRegistry = InferOutput<typeof ModelRegistrySchema>

export type RunResult = CommandResultBase

export type RunOptions = {
  cwd?: string
  env?: Record<string, string | undefined>
  allowFailure?: boolean
}

export type ModelLinksData = Record<string, Record<string, string[]>>

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type GroqModel = typeof SUPPORTED_GROQ_MODELS[number]
export type ElevenlabsTtsModel = typeof SUPPORTED_ELEVENLABS_TTS_MODELS[number]
export type MinimaxTtsModel = typeof SUPPORTED_MINIMAX_TTS_MODELS[number]
export type GroqTtsModel = typeof SUPPORTED_GROQ_TTS_MODELS[number]
export type GrokTtsModel = typeof SUPPORTED_GROK_TTS_MODELS[number]
export type MistralTtsModel = typeof SUPPORTED_MISTRAL_TTS_MODELS[number]
export type OpenAITtsModel = typeof SUPPORTED_OPENAI_TTS_MODELS[number]
export type GeminiTtsModel = typeof SUPPORTED_GEMINI_TTS_MODELS[number]
export type DeepgramTtsModel = typeof SUPPORTED_DEEPGRAM_TTS_MODELS[number]
export type SpeechifyTtsModel = typeof SUPPORTED_SPEECHIFY_TTS_MODELS[number]
export type HumeTtsModel = typeof SUPPORTED_HUME_TTS_MODELS[number]
export type CartesiaTtsModel = typeof SUPPORTED_CARTESIA_TTS_MODELS[number]
export type FishTtsModel = typeof SUPPORTED_FISH_TTS_MODELS[number]
export type InworldTtsModel = typeof SUPPORTED_INWORLD_TTS_MODELS[number]
export type DeepinfraTtsModel = typeof SUPPORTED_DEEPINFRA_TTS_MODELS[number]
export type ReplicateTtsModel = typeof SUPPORTED_REPLICATE_TTS_MODELS[number]
export type FalTtsModel = typeof SUPPORTED_FAL_TTS_MODELS[number]
export type ElevenlabsMusicModel = typeof SUPPORTED_ELEVENLABS_MUSIC_MODELS[number]
export type MinimaxMusicModel = typeof SUPPORTED_MINIMAX_MUSIC_MODELS[number]
export type GeminiMusicModel = typeof SUPPORTED_GEMINI_MUSIC_MODELS[number]
export type GeminiImageModel = typeof SUPPORTED_GEMINI_IMAGE_MODELS[number]
export type OpenAIImageModel = typeof SUPPORTED_OPENAI_IMAGE_MODELS[number]
export type GrokImageModel = typeof SUPPORTED_GROK_IMAGE_MODELS[number]
export type BflImageModel = typeof SUPPORTED_BFL_IMAGE_MODELS[number]
export type ReplicateImageModel = typeof SUPPORTED_REPLICATE_IMAGE_MODELS[number]
export type LumalabsImageModel = typeof SUPPORTED_LUMALABS_IMAGE_MODELS[number]
export type FalImageModel = typeof SUPPORTED_FAL_IMAGE_MODELS[number]
export type GeminiVideoModel = typeof SUPPORTED_GEMINI_VIDEO_MODELS[number]
export type GrokVideoModel = typeof SUPPORTED_GROK_VIDEO_MODELS[number]
export type LtxVideoModel = typeof SUPPORTED_LTX_VIDEO_MODELS[number]
export type ReplicateVideoModel = typeof SUPPORTED_REPLICATE_VIDEO_MODELS[number]
export type LumalabsVideoModel = typeof SUPPORTED_LUMALABS_VIDEO_MODELS[number]
export type FalVideoModel = typeof SUPPORTED_FAL_VIDEO_MODELS[number]

export type SttBilling = {
  roundingIncrementSeconds?: number
  minimumSeconds?: number
}

export type CheapestVideoSelection = {
  provider: 'gemini' | 'grok' | 'ltx' | 'replicate' | 'lumalabs' | 'fal'
  model: string
  duration: number
  size?: string | undefined
  resolution?: string | undefined
  totalCost: number
}

export type CheapestTtsSelection = {
  provider: import('~/types').TtsProvider
  model: string
  totalCost: number
}

export type CheapestLlmSelection = {
  provider: import('~/types').Step3Metadata['llmService']
  model: string
  totalCost: number
}

export type CheckResult = {
  label: string
  ok: boolean
  detail: string
}

export type SetupToolStatus = {
  tool: string
  status: string
  detail?: string
}

export const SETUP_STEP_IDS = [
  'yt-dlp', 'defuddle', 'whisper-binary', 'whisper-model', 'whisperfile',
  'calibre', 'all',
  'transcription', 'music'
] as const

export type SetupStepId = typeof SETUP_STEP_IDS[number]
