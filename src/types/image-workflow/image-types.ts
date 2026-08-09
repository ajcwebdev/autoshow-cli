import type { CostEstimateBase, ImageProvider, ImageRuntimeOptionKey, ProcessingOptions, ProviderTargetBase, ResourceGate, Step5Metadata } from '~/types'
export type ImageGenOptions = Pick<ProcessingOptions, ImageRuntimeOptionKey> & {
  generationResourceGate?: ResourceGate | undefined
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

export type EstimateImageCostOptions = Pick<ProcessingOptions,
  | 'geminiImageModels' | 'geminiImageModel' | 'openaiImageModels' | 'openaiImageModel'
  | 'grokImageModels' | 'grokImageModel' | 'bflImageModels' | 'bflImageModel'
  | 'recraftImageModels' | 'recraftImageModel' | 'replicateImageModels' | 'replicateImageModel'
  | 'lumalabsImageModels' | 'lumalabsImageModel' | 'falImageModels' | 'falImageModel'
  | 'imageSize' | 'imageQuality' | 'imageCount'
>
