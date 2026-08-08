import type { CostEstimateBase, ProcessingOptions, ProviderTargetBase, ResourceGate, Step6VideoMetadata, VideoProvider } from '~/types'
export type VideoGenOptions = Pick<
  ProcessingOptions,
  | 'geminiVideoModels' | 'geminiVideoModel'
  | 'minimaxVideoModels' | 'minimaxVideoModel'
  | 'glmVideoModels' | 'glmVideoModel'
  | 'grokVideoModels' | 'grokVideoModel'
  | 'runwayVideoModels' | 'runwayVideoModel'
  | 'ltxVideoModels' | 'ltxVideoModel'
  | 'replicateVideoModels' | 'replicateVideoModel'
  | 'lumalabsVideoModels' | 'lumalabsVideoModel'
  | 'falVideoModels' | 'falVideoModel'
  | 'allVideo'
  | 'videoDuration' | 'videoSize' | 'videoAspectRatio' | 'videoResolution'
  | 'videoMode' | 'videoInputImage' | 'videoLastFrame' | 'videoReferenceImages' | 'videoInputVideo'
  | 'replicateVideoSeed' | 'replicateVideoGenerateAudio'
  | 'replicateVideoReferenceVideos' | 'replicateVideoReferenceAudios'
  | 'replicateVideoNegativePrompt' | 'replicateVideoAudio' | 'replicateVideoPromptExpansion'
  | 'replicateVideoMultiPrompt' | 'replicateVideoMultiClip'
  | 'falVideoGenerateAudio' | 'falVideoReferenceVideos' | 'falVideoReferenceAudios'
  | 'grokVideoStorageFilename' | 'grokVideoStorageExpiresAfter'
  | 'videoProviderConcurrency' | 'videoLocalConcurrency'
> & {
  generationResourceGate?: ResourceGate | undefined
}

export const VIDEO_MODES = ['text', 'image-to-video', 'reference-to-video', 'interpolate', 'extend', 'edit'] as const
export type VideoMode = typeof VIDEO_MODES[number]
export type GeminiResolution = '720p' | '1080p' | '4k'
export type MinimaxResolution = '720p' | '1080p'
export type MinimaxApiResolution = '720P' | '768P' | '1080P'
export type MinimaxDurationSeconds = 6 | 10
export type GrokVideoDurationSeconds = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
export type RunwayDurationSeconds = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type LtxVideoDurationSeconds = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20

export type VideoTarget = ProviderTargetBase<VideoProvider> & {
  run: (prompt: string | undefined, outputDir: string) => Promise<{ videoPath: string, metadata: Step6VideoMetadata }>
}

export type VideoCostEstimate = CostEstimateBase<VideoProvider> & {
  durationSeconds: number
  billedDurationSeconds: number
  costPerSecond: number
}

export type EstimateVideoCostOptions = {
  geminiVideoModels?: string[] | undefined
  geminiVideoModel?: string | undefined
  minimaxVideoModels?: string[] | undefined
  minimaxVideoModel?: string | undefined
  glmVideoModels?: string[] | undefined
  glmVideoModel?: string | undefined
  grokVideoModels?: string[] | undefined
  grokVideoModel?: string | undefined
  runwayVideoModels?: string[] | undefined
  runwayVideoModel?: string | undefined
  ltxVideoModels?: string[] | undefined
  ltxVideoModel?: string | undefined
  replicateVideoModels?: string[] | undefined
  replicateVideoModel?: string | undefined
  lumalabsVideoModels?: string[] | undefined
  lumalabsVideoModel?: string | undefined
  falVideoModels?: string[] | undefined
  falVideoModel?: string | undefined
  videoDuration?: number | undefined
  videoSize?: string | undefined
  videoAspectRatio?: string | undefined
  videoResolution?: string | undefined
  videoMode?: string | undefined
  grokInputImageCount?: number | undefined
  grokInputVideoDurationSeconds?: number | undefined
  replicateVideoReferenceVideoCount?: number | undefined
  replicateVideoGenerateAudio?: boolean | undefined
  replicateInputVideoDurationSeconds?: number | undefined
}
