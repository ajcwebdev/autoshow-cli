export type ImageRuntimeOptions = {
  imageProviderConcurrency: number
  imageLocalConcurrency: number
  geminiImageModels: string[] | undefined
  openaiImageModels: string[] | undefined
  grokImageModels: string[] | undefined
  bflImageModels: string[] | undefined
  replicateImageModels: string[] | undefined
  lumalabsImageModels: string[] | undefined
  falImageModels: string[] | undefined
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
