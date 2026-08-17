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
  itemRecord?: PipelineItemRecord
}


export type BuildOptsDefaults = Record<string, never>

export type RepeatableModelFlag =
  import('~/cli/flags/service-selector-normalization/repeatable-model-flags').RepeatableModelFlag

export type FlagOccurrenceValue = string | boolean

export type AllShortcutFlag =
  | 'all-stt'
  | 'all-local-stt'
  | 'all-ocr'
  | 'all-local-ocr'
  | 'all-url'
  | 'all-local-url'
  | 'all-llm'
  | 'all-tts'
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
  initialRecords: PipelineItemRecord[]
  resultEntryIndexes: number[]
  parentIndexes: number[]
}


export type PipelineItemRecord = JsonObject

export type PipelineItemErrorRecord = {
  service?: string
  model?: string
  message?: string
  skipped?: boolean
}

export type SttProviderSummary = {
  label: string
  status: 'running' | 'succeeded' | 'missing' | 'failed' | 'skipped'
  message?: string
}
