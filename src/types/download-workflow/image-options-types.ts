export type ImageRuntimeOptions = {
  imageProviderConcurrency: number
  imageLocalConcurrency: number
  geminiImageModels: string[] | undefined
  geminiImageModel: string | undefined
  openaiImageModels: string[] | undefined
  openaiImageModel: string | undefined
  grokImageModels: string[] | undefined
  grokImageModel: string | undefined
  bflImageModels: string[] | undefined
  bflImageModel: string | undefined
  recraftImageModels: string[] | undefined
  recraftImageModel: string | undefined
  replicateImageModels: string[] | undefined
  replicateImageModel: string | undefined
  lumalabsImageModels: string[] | undefined
  lumalabsImageModel: string | undefined
  falImageModels: string[] | undefined
  falImageModel: string | undefined
  imageAspectRatio: string | undefined
  imageSize: string | undefined
  imageQuality: string | undefined
  imageFormat: string | undefined
  imageBackground: string | undefined
  imageCount: number | undefined
  imageInputs: string[] | undefined
  imageMask: string | undefined
  imageResponseMode: string | undefined
  geminiSearchGrounding: boolean | undefined
  imageCompression: number | undefined
}
