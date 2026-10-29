export type VideoRuntimeOptions = {
  videoProviderConcurrency: number
  geminiVideoModels: string[] | undefined
  grokVideoModels: string[] | undefined
  allVideo: boolean | undefined
  videoDuration: number | undefined
  videoAspectRatio: string | undefined
  videoResolution: string | undefined
  videoMode: string | undefined
  videoInputImage: string | undefined
  videoLastFrame: string | undefined
  videoReferenceImages: string[] | undefined
  videoInputVideo: string | undefined
  videoPreviousInteractionId: string | undefined
  videoReferenceVideos: string[] | undefined
}
