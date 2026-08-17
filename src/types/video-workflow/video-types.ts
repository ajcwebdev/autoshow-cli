import type { CostEstimateBase, HostedConcurrencyRuntimeOptions, ProviderTargetBase, ResourceGate, Step6VideoMetadata, VideoProvider, VideoRuntimeOptions } from '~/types'

export type VideoGenOptions = Partial<VideoRuntimeOptions> & HostedConcurrencyRuntimeOptions & {
  generationResourceGate?: ResourceGate | undefined
}

export const VIDEO_MODES = ['text', 'image-to-video', 'reference-to-video', 'interpolate', 'extend', 'edit'] as const
export type VideoMode = typeof VIDEO_MODES[number]
export type GeminiResolution = '720p' | '1080p' | '4k'
export type GrokVideoDurationSeconds = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
export type LtxVideoDurationSeconds = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20

export type VideoTarget = ProviderTargetBase<VideoProvider> & {
  run: (prompt: string | undefined, outputDir: string) => Promise<{ videoPath: string, metadata: Step6VideoMetadata }>
}

export type VideoCostEstimate = CostEstimateBase<VideoProvider> & {
  durationSeconds: number
  billedDurationSeconds: number
  costPerSecond: number
}

export type EstimateVideoCostOptions = Partial<Pick<VideoRuntimeOptions,
  | 'geminiVideoModels' | 'geminiVideoModel'
  | 'grokVideoModels' | 'grokVideoModel' | 'ltxVideoModels' | 'ltxVideoModel'
  | 'replicateVideoModels' | 'replicateVideoModel' | 'lumalabsVideoModels' | 'lumalabsVideoModel'
  | 'falVideoModels' | 'falVideoModel' | 'videoDuration'
  | 'videoAspectRatio' | 'videoResolution' | 'videoMode' | 'videoGenerateAudio'
>> & {
  grokInputImageCount?: number | undefined
  grokInputVideoDurationSeconds?: number | undefined
  replicateVideoReferenceVideoCount?: number | undefined
  replicateInputVideoDurationSeconds?: number | undefined
}
