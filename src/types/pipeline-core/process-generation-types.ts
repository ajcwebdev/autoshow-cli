import type { CanonicalAudioProviderProjection, ImageProvider, MusicProvider, ProviderRenderStrategy, TtsProvider, VideoProvider } from '~/types'

type GenerationProviderCostSource = 'provider_usage' | 'provider_quote' | 'registry_fallback'

type TtsMetadataBase<TService extends string = string> = {
  ttsService: TService
  ttsModel: string
  speaker?: string
  language?: string
  processingTime: number
  audioFileName: string
  audioFileSize: number
  chunkCount: number
}

export type Step4Metadata = TtsMetadataBase<TtsProvider> & {
  hostedConcurrency?: import('~/types').HostedConcurrencyTelemetry | undefined
  clonedVoiceId?: string | undefined
  cloneCostCents?: number | undefined
  operation?: 'tts-synthesis' | 'comic-audio' | undefined
  targetKey?: string | undefined
  transport?: string | undefined
  artifactDir?: string | undefined
  renderIdentity?: string | undefined
  resultIdentity?: string | undefined
  audioRunId?: string | undefined
  renderStrategy?: ProviderRenderStrategy | undefined
  generationCheckpoint?: {
    completedGenerationSlotIds: string[]
    remainingGenerationSlotCount: number
  } | undefined
  ttsAudio?: CanonicalAudioProviderProjection | undefined
  comicAudio?: CanonicalAudioProviderProjection | undefined
}

export type Step5Metadata = {
  imageService: ImageProvider
  imageModel: string
  processingTime: number
  imageFileNames: string[]
  imageCount: number
  imageFileSize: number
  imageWidth: number | undefined
  imageHeight: number | undefined
  imageSize?: string | undefined
  imageQuality?: string | undefined
  imageFormat?: string | undefined
  revisedPrompt?: string | undefined
  providerReturnedModel?: string | undefined
  requestMode: 'generation' | 'edit'
  usageCostRaw?: number | undefined
  groundingMetadata?: unknown
  providerModeration?: unknown
  providerCostCents?: number | undefined
  providerCostSource?: GenerationProviderCostSource | undefined
  hostedConcurrency?: import('~/types').HostedConcurrencyTelemetry | undefined
}

export type Step6VideoMetadata = {
  videoGenService: VideoProvider
  videoGenModel: string
  processingTime: number
  videoFileName: string
  videoFileSize: number
  videoDuration: number | undefined
  videoSize?: string | undefined
  requestMode?: string | undefined
  videoResolution?: string | undefined
  videoAspectRatio?: string | undefined
  inputImage?: string | undefined
  lastFrameImage?: string | undefined
  referenceImages?: string[] | undefined
  referenceVideos?: string[] | undefined
  referenceAudios?: string[] | undefined
  inputVideo?: string | undefined
  inputVideoDurationSeconds?: number | undefined
  inputAudio?: string | undefined
  providerRequestId?: string | undefined
  providerModelVersion?: string | undefined
  providerOutputUrl?: string | undefined
  providerStatusTimings?: Array<{
    status: string
    elapsedMs: number
    id?: string | undefined
    createdAt?: string | undefined
    startedAt?: string | undefined
    completedAt?: string | undefined
  }> | undefined
  providerReturnedModel?: string | undefined
  providerVideoUrl?: string | undefined
  providerVideoUri?: string | undefined
  providerProgress?: number | undefined
  providerModeration?: unknown
  providerFileOutput?: unknown
  providerCostCents?: number | undefined
  providerCostSource?: GenerationProviderCostSource | undefined
  hostedConcurrency?: import('~/types').HostedConcurrencyTelemetry | undefined
}

export type ElevenLabsCompositionChunk = {
  text: string
  duration_ms: number
  positive_styles: string[]
  negative_styles: string[]
  context_adherence: 'low' | 'medium' | 'high'
}

export type ElevenLabsCompositionPlan = {
  chunks: ElevenLabsCompositionChunk[]
}

export type Step7MusicMetadata = {
  musicService: MusicProvider
  musicModel: string
  processingTime: number
  musicFileName: string
  musicFileSize: number
  musicDurationMs: number | undefined
  lyricsSource: 'provided' | 'generated' | 'none'
  providerCostCents?: number | undefined
  providerCostSource?: Extract<GenerationProviderCostSource, 'provider_quote' | 'registry_fallback'> | undefined
  providerRequestId?: string | undefined
  providerTraceId?: string | undefined
  audioMimeType?: string | undefined
  audioSampleRate?: number | undefined
  audioChannelCount?: number | undefined
  audioBitrate?: number | undefined
  providerAudioByteSize?: number | undefined
  seed?: number | undefined
  outputFormat?: string | undefined
  generatedLyrics?: string | undefined
  generatedSongTitle?: string | undefined
  generatedStyleTags?: string | undefined
  generatedText?: string | undefined
  compositionPlanChunkCount?: number | undefined
  hostedConcurrency?: import('~/types').HostedConcurrencyTelemetry | undefined
}

export type TimingRateBasis = 'durationSecond' | 'page' | 'section' | '1KTokens' | '1KCharacters' | 'image'
export type TimingThroughputUnit = 'x' | 'tokensPerSecond' | 'charactersPerSecond' | 'pagesPerMinute' | 'sectionsPerMinute' | 'imagesPerMinute'
export type TimingScope = 'estimated' | 'wall'
export type TimingBreakdown = Partial<Record<
  | 'queueWaitMs'
  | 'transcribeMs'
  | 'uploadMs'
  | 'createMs'
  | 'pollMs'
  | 'pollSleepMs'
  | 'transcriptMs'
  | 'remoteProcessingMs'
  | 'cleanupMs',
  number
>>

export type TimingEntryBase<TStep extends string = string, TThroughputUnit extends string = string> = {
  step: TStep
  provider: string
  model: string
  processingTimeMs: number
  inputMetric?: string
  inputValue?: number
  throughputValue?: number
  throughputUnit?: TThroughputUnit
}

export type TimingStepEntry = TimingEntryBase<
  'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music',
  TimingThroughputUnit
> & {
  rateBasis?: TimingRateBasis
  msPerUnit?: number
  timingScope?: TimingScope
  timingBreakdown?: TimingBreakdown
  timingNote?: string
  timingAdjustment?: Record<string, unknown>
}
