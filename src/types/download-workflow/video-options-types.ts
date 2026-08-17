export type VideoRuntimeOptions = {
  videoProviderConcurrency: number
  videoLocalConcurrency: number
  geminiVideoModels: string[] | undefined
  geminiVideoModel: string | undefined
  grokVideoModels: string[] | undefined
  grokVideoModel: string | undefined
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
  videoAspectRatio: string | undefined
  videoResolution: string | undefined
  videoMode: string | undefined
  videoInputImage: string | undefined
  videoLastFrame: string | undefined
  videoReferenceImages: string[] | undefined
  videoInputVideo: string | undefined
  replicateVideoSeed: number | undefined
  videoGenerateAudio: boolean | undefined
  videoReferenceVideos: string[] | undefined
  videoReferenceAudios: string[] | undefined
  replicateVideoNegativePrompt: string | undefined
  replicateVideoMultiPrompt: string | undefined
  replicateVideoMultiClip: boolean | undefined
}
