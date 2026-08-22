import type { CostEstimateBase, HostedConcurrencyRuntimeOptions, ImageProvider, ImageRuntimeOptions, ProviderTargetBase, ResourceGate, Step5Metadata } from '~/types'

export type ImageGenOptions = Partial<ImageRuntimeOptions> & HostedConcurrencyRuntimeOptions & {
  generationResourceGate?: ResourceGate | undefined
}

export type UnsupportedImageFlagSpec = keyof ImageGenOptions | {
  key: keyof ImageGenOptions
  when: (value: ImageGenOptions[keyof ImageGenOptions]) => boolean
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

export type EstimateImageCostOptions = Partial<Pick<ImageRuntimeOptions,
  | 'geminiImageModels' | 'openaiImageModels'
  | 'grokImageModels' | 'bflImageModels'
  | 'replicateImageModels'
  | 'lumalabsImageModels' | 'falImageModels'
  | 'imageSize' | 'imageQuality' | 'imageCount'
>>
