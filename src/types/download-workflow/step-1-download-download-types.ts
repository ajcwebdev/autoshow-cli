import type { BatchItem, ExtractRoute, JsonObject } from '~/types'

export type DownloadAudioOptions = {
  url?: string | undefined
  filePath?: string | undefined
  outputDir: string
  directDownload?: boolean | undefined
  keepOriginalMedia?: boolean | undefined
  bestQuality?: boolean | undefined
  ytDlpPassthroughArgs?: string[] | undefined
}

export type Step1SourceRef = {
  url?: string
  filePath?: string
}

export type AudioDownloadSummary = {
  source: 'yt-dlp' | 'direct-audio-url' | 'direct-media-url'
  status: 'started' | 'downloaded'
  target: string
  detail?: string
}

export type AudioNormalizeSummary = {
  status: 'planned'
  inputPath: string
  outputPath: string
  plan: NormalizedAudioPlan
}

export type FfprobeStream = {
  index?: unknown
  codec_type?: unknown
  codec_name?: unknown
  sample_rate?: unknown
  channels?: unknown
  bit_rate?: unknown
  disposition?: unknown
}

export type FfprobeFormat = {
  format_name?: unknown
  duration?: unknown
  bit_rate?: unknown
}

export type FfprobePayload = {
  streams?: unknown
  format?: unknown
}

export type NormalizedAudioExtension = '.mp3' | '.m4a' | '.ogg' | '.flac'
export type NormalizedAudioFormat = 'mp3' | 'ipod' | 'ogg' | 'flac'
export type AudioNormalizationMode = 'copy-file' | 'copy-stream' | 'transcode-aac' | 'transcode-mp3' | 'transcode-flac'
export type AudioNormalizationProfile = 'default' | 'hosted-stt' | 'hosted-stt-mp3'

export type AudioStreamProbe = {
  index: number
  codecName: string
  sampleRate?: number | undefined
  channels?: number | undefined
  bitRate?: number | undefined
}

export type MediaProbe = {
  formatNames: string[]
  durationSeconds?: number | undefined
  bitRate?: number | undefined
  hasVideo: boolean
  hasNonAudioStreams: boolean
  audioStreamCount: number
  audioStream: AudioStreamProbe
}

export type NormalizedAudioPlan = {
  profile: AudioNormalizationProfile
  mode: AudioNormalizationMode
  outputExtension: NormalizedAudioExtension
  outputFormat: NormalizedAudioFormat
  outputCodecName: string
  sourceCodecName: string
  reason: string
  stripMetadata: boolean
  stripChapters: boolean
  targetBitRate?: number | undefined
  targetSampleRate?: number | undefined
  targetChannels?: number | undefined
}


export type MutoolDocInfo = {
  pageCount: number
  title?: string
  author?: string
}

export type BatchItemProcessResult = {
  outputDir?: string
  manifestEntry?: Record<string, unknown>
}


export type BuildOptsDefaults = {
  defaultTtsEngine?: 'kitten'
}

export type RepeatableModelFlag =
  | 'whisper-stt'
  | 'whisperfile-stt'
  | 'deepinfra-stt'
  | 'groq-stt'
  | 'grok-stt'
  | 'deepgram-stt'
  | 'soniox-stt'
  | 'speechmatics-stt'
  | 'rev-stt'
  | 'mistral-stt'
  | 'assemblyai-stt'
  | 'gladia-stt'
  | 'happyscribe-stt'
  | 'supadata-stt'
  | 'scrapecreators-stt'
  | 'gemini-stt'
  | 'together-stt'
  | 'mistral-ocr'
  | 'glm-ocr'
  | 'kimi-ocr'
  | 'openai-ocr'
  | 'grok-ocr'
  | 'anthropic-ocr'
  | 'gemini-ocr'
  | 'deepinfra-ocr'
  | 'llama'
  | 'llamafile'
  | 'openai'
  | 'groq'
  | 'gemini'
  | 'anthropic'
  | 'minimax'
  | 'grok'
  | 'glm'
  | 'kimi'
  | 'together'
  | 'cerebras'
  | 'kitten-tts'
  | 'elevenlabs-tts'
  | 'deepgram-tts'
  | 'minimax-tts'
  | 'groq-tts'
  | 'grok-tts'
  | 'mistral-tts'
  | 'openai-tts'
  | 'gemini-tts'
  | 'speechify-tts'
  | 'hume-tts'
  | 'cartesia-tts'
  | 'gemini-image'
  | 'openai-image'
  | 'grok-image'
  | 'bfl-image'
  | 'recraft-image'
  | 'replicate-image'
  | 'lumalabs-image'
  | 'fal-image'
  | 'elevenlabs-music'
  | 'minimax-music'
  | 'gemini-music'
  | 'gemini-video'
  | 'minimax-video'
  | 'glm-video'
  | 'grok-video'
  | 'runway-video'
  | 'ltx-video'
  | 'replicate-video'
  | 'lumalabs-video'
  | 'fal-video'
  | 'lumalabs-video'

export type FlagOccurrenceValue = string | boolean

export type AllShortcutFlag =
  | 'all-stt'
  | 'all-local-stt'
  | 'all-ocr'
  | 'all-local-ocr'
  | 'all-url'
  | 'all-local-url'
  | 'all-llm'
  | 'all-local-llm'
  | 'all-tts'
  | 'all-local-tts'
  | 'all-image'
  | 'all-local-image'
  | 'all-video'
  | 'all-local-video'
  | 'all-music'
  | 'all-local-music'

export type ExtractChildBatchPlan = {
  route: ExtractRoute
  items: string[]
  selectedItems?: Array<BatchItem | undefined>
  initialEntries: Record<string, unknown>[]
  resultEntryIndexes: number[]
  parentIndexes: number[]
}


export type BatchManifestEntry = JsonObject

export type BatchManifestErrorEntry = {
  service?: string
  model?: string
  message?: string
  skipped?: boolean
}

export type SttManifestProviderSummary = {
  label: string
  status: 'succeeded' | 'missing' | 'failed' | 'skipped'
  message?: string
}
