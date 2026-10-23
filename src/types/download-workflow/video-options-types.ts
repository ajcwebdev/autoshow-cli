export type VideoRuntimeOptions = {
  videoProviderConcurrency: number
  geminiVideoModels: string[] | undefined
  grokVideoModels: string[] | undefined
  falVideoModels: string[] | undefined
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
  videoGenerateAudio: boolean | undefined
  videoReferenceVideos: string[] | undefined
  videoReferenceAudios: string[] | undefined
}
