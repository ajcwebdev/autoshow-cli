import type { InferOutput } from 'valibot'
import {
SUPPORTED_GEMINI_IMAGE_MODELS,
SUPPORTED_GROK_IMAGE_MODELS,
SUPPORTED_OPENAI_IMAGE_MODELS,
} from '~/cli/commands/setup-and-utilities/models/image-models'
import { ModelRegistrySchema } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
SUPPORTED_ELEVENLABS_MUSIC_MODELS,
SUPPORTED_GEMINI_MUSIC_MODELS,
SUPPORTED_MINIMAX_MUSIC_MODELS
} from '~/cli/commands/setup-and-utilities/models/music-models'
import {
  SUPPORTED_INWORLD_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/tts-models'
import {
SUPPORTED_GEMINI_VIDEO_MODELS,
SUPPORTED_GROK_VIDEO_MODELS,
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

export type ElevenlabsTtsModel = typeof SUPPORTED_ELEVENLABS_TTS_MODELS[number]
export type SonioxTtsModel = 'tts-rt-v2'
export type GrokTtsModel = typeof SUPPORTED_GROK_TTS_MODELS[number]
export type OpenAITtsModel = typeof SUPPORTED_OPENAI_TTS_MODELS[number]
export type InworldTtsModel = typeof SUPPORTED_INWORLD_TTS_MODELS[number]
export type ElevenlabsMusicModel = typeof SUPPORTED_ELEVENLABS_MUSIC_MODELS[number]
export type MinimaxMusicModel = typeof SUPPORTED_MINIMAX_MUSIC_MODELS[number]
export type GeminiMusicModel = typeof SUPPORTED_GEMINI_MUSIC_MODELS[number]
export type GeminiImageModel = typeof SUPPORTED_GEMINI_IMAGE_MODELS[number]
export type OpenAIImageModel = typeof SUPPORTED_OPENAI_IMAGE_MODELS[number]
export type GrokImageModel = typeof SUPPORTED_GROK_IMAGE_MODELS[number]
export type GeminiVideoModel = typeof SUPPORTED_GEMINI_VIDEO_MODELS[number]
export type GrokVideoModel = typeof SUPPORTED_GROK_VIDEO_MODELS[number]

export type SttBilling = {
  diarizationCostPerHourCents?: number
  roundingIncrementSeconds?: number
  minimumSeconds?: number
}

export type CheapestVideoSelection = {
  provider: 'gemini' | 'grok'
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

export type SetupToolStatus = {
  tool: string
  status: string
  detail?: string
}

export const SETUP_STEP_IDS = [
  'yt-dlp', 'defuddle', 'whisperfile',
  'calibre', 'all',
  'transcription', 'music',
  'toolchain', 'ocr', 'rendering', 'alignment'
] as const

export type SetupStepId = typeof SETUP_STEP_IDS[number]

export type SetupRunOptions = { forceRedownload?: boolean }

export type SetupLifecycleOperations = {
  toolchain: (options: SetupRunOptions) => Promise<void>
  media: (options: SetupRunOptions) => Promise<void>
  documents: (options: SetupRunOptions) => Promise<void>
  ocr: (options: SetupRunOptions) => Promise<void>
  rendering: (options: SetupRunOptions) => Promise<void>
  defuddle: (options: SetupRunOptions) => Promise<void>
  alignment: (options: SetupRunOptions) => Promise<void>
  whisperfile: (model: string, options: SetupRunOptions) => Promise<void>
  migrateState: () => Promise<void>
  verifyRendering: () => Promise<void>
  summarize: (startedAtMs: number, providerSummary: import('~/types').HostedProviderConfigurationSummary) => Promise<boolean>
}

export type SetupInstallationComponent = 'toolchain' | 'media' | 'documents' | 'ocr' | 'rendering' | 'defuddle' | 'alignment' | 'whisperfile'

export type SetupInstallationPlanTask = {
  component: SetupInstallationComponent
  dependsOn: SetupInstallationComponent[]
  target: string
  action: 'verify-or-repair' | 'install' | 'replace'
}

export type SetupInstallationPlan = {
  schemaVersion: 1
  dryRun: true
  step: SetupStepId
  platform: string
  architecture: string
  runtimeRoot: string
  forceRedownload: boolean
  tasks: SetupInstallationPlanTask[]
  dependencies: { name: string, version: string, url?: string, sha256?: string, lockfile?: string }[]
  models: string[]
  estimates: { downloadBytes: null, additionalDiskBytes: null, reason: string }
}
