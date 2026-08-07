import type { CostEstimateBase, GenerationResourceGate, ImageProvider, ProcessingOptions, ProviderTargetBase, Step5Metadata } from '~/types'
export type ImageGenOptions = Pick<
  ProcessingOptions,
  | 'geminiImageModels'
  | 'geminiImageModel'
  | 'openaiImageModels'
  | 'openaiImageModel'
  | 'grokImageModels'
  | 'grokImageModel'
  | 'bflImageModels'
  | 'bflImageModel'
  | 'recraftImageModels'
  | 'recraftImageModel'
  | 'replicateImageModels'
  | 'replicateImageModel'
  | 'lumalabsImageModels'
  | 'lumalabsImageModel'
  | 'falImageModels'
  | 'falImageModel'
  | 'imageAspectRatio'
  | 'imageSize'
  | 'imageQuality'
  | 'imageFormat'
  | 'imageBackground'
  | 'imageCount'
  | 'imageInputs'
  | 'imageMask'
  | 'imageResponseMode'
  | 'geminiSearchGrounding'
  | 'imageCompression'
  | 'imageProviderConcurrency'
  | 'imageLocalConcurrency'
> & {
  generationResourceGate?: GenerationResourceGate | undefined
}

export type ImageResult = {
  imagePaths: string[]
  metadata: Step5Metadata
}

export type ImageTarget = ProviderTargetBase<ImageProvider> & {
  run: (prompt: string, outputDir: string, opts: ImageGenOptions) => Promise<ImageResult>
}

export type ImageCostEstimate = CostEstimateBase<ImageProvider> & {
  imageCount: number
  costPerImageCents: number
}

export type EstimateImageCostOptions = {
  geminiImageModels?: string[] | undefined
  geminiImageModel?: string | undefined
  openaiImageModels?: string[] | undefined
  openaiImageModel?: string | undefined
  grokImageModels?: string[] | undefined
  grokImageModel?: string | undefined
  bflImageModels?: string[] | undefined
  bflImageModel?: string | undefined
  recraftImageModels?: string[] | undefined
  recraftImageModel?: string | undefined
  replicateImageModels?: string[] | undefined
  replicateImageModel?: string | undefined
  lumalabsImageModels?: string[] | undefined
  lumalabsImageModel?: string | undefined
  falImageModels?: string[] | undefined
  falImageModel?: string | undefined
  imageSize?: string | undefined
  imageQuality?: string | undefined
  imageCount?: number | undefined
}
