export type ImageRuntimeOptions = {
  imageProviderConcurrency: number
  geminiImageModels: string[] | undefined
  openaiImageModels: string[] | undefined
  grokImageModels: string[] | undefined
  imageAspectRatio: string | undefined
  imageSize: string | undefined
  imageQuality: string | undefined
  imageFormat: string | undefined
  imageBackground: string | undefined
  imageCount: number | undefined
  imageInputs: string[] | undefined
  imageMask: string | undefined
  imageResponseMode: string | undefined
  imageCompression: number | undefined
}
