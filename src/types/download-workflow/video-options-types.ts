export type VideoRuntimeOptions = {
  videoProviderConcurrency: number
  videoLocalConcurrency: number
  geminiVideoModels: string[] | undefined
  geminiVideoModel: string | undefined
  minimaxVideoModels: string[] | undefined
  minimaxVideoModel: string | undefined
  glmVideoModels: string[] | undefined
  glmVideoModel: string | undefined
  grokVideoModels: string[] | undefined
  grokVideoModel: string | undefined
  runwayVideoModels: string[] | undefined
  runwayVideoModel: string | undefined
  ltxVideoModels: string[] | undefined
  ltxVideoModel: string | undefined
  replicateVideoModels: string[] | undefined
  replicateVideoModel: string | undefined
  lumalabsVideoModels: string[] | undefined
  lumalabsVideoModel: string | undefined
  falVideoModels: string[] | undefined
  falVideoModel: string | undefined
  allVideo: boolean | undefined
  videoDuration: number | undefined
  videoSize: string | undefined
  videoAspectRatio: string | undefined
  videoResolution: string | undefined
  videoMode: string | undefined
  videoInputImage: string | undefined
  videoLastFrame: string | undefined
  videoReferenceImages: string[] | undefined
  videoInputVideo: string | undefined
  replicateVideoSeed: number | undefined
  replicateVideoGenerateAudio: boolean | undefined
  replicateVideoReferenceVideos: string[] | undefined
  replicateVideoReferenceAudios: string[] | undefined
  replicateVideoNegativePrompt: string | undefined
  replicateVideoAudio: string | undefined
  replicateVideoPromptExpansion: boolean | undefined
  replicateVideoMultiPrompt: string | undefined
  replicateVideoMultiClip: boolean | undefined
  falVideoGenerateAudio: boolean | undefined
  falVideoReferenceVideos: string[] | undefined
  falVideoReferenceAudios: string[] | undefined
  grokVideoStorageFilename: string | undefined
  grokVideoStorageExpiresAfter: number | undefined
}
