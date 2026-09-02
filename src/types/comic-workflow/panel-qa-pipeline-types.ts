import type { BlockingHardKeyPolicy, ComicImageGenerationDependencies, GenerateComicPagesOptions, GeneratePanelImagesOptions, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, PageQaEntry, PageQaRosterCard, PanelBundleData } from '~/types'

export type QaRepairCostEntry = {
  model: ImageGenerationModel
  quality?: ImageGenerationQuality | undefined
  size?: ImageGenerationSize | undefined
}

export type GenerateWithQaRepairInput = {
  kind: 'panel' | 'page'
  itemNumber: number
  outputPath: string
  canonicalExists: boolean
  outputExists: boolean
  force: boolean
  model: ImageGenerationModel
  promptForVariation: string
  referenceImages: string[]
  bundleData: PanelBundleData
  resolvedReferences: {
    primaryCharacterRefs?: string[] | undefined
    secondaryRefs?: string[] | undefined
    designReferences?: Array<{ path: string; key?: string; referenceIndex?: number; usage?: string }> | undefined
    characterReferences?: Array<{ key: string; referenceIndex?: number; description: string }> | undefined
    locationReferences?: Array<{ key: string; referenceIndex?: number; specification: string }> | undefined
    rosterCharacterReferences?: PageQaRosterCard[] | undefined
  }
  sceneSlug: string
  options: GeneratePanelImagesOptions | GenerateComicPagesOptions
  requestImage: NonNullable<ComicImageGenerationDependencies['requestImage']>
  writeImage: typeof import('~/cli/commands/process-steps/step-8-comic/comic-image-services/image-writer').writeGeneratedImage
  judge: NonNullable<ComicImageGenerationDependencies['judgePage']>
  requestRepairComparison?: ComicImageGenerationDependencies['requestRepairComparison']
  qaEnabled: boolean
  judgeModel: string
  maxRepairs: number
  blockingHardKeys?: BlockingHardKeyPolicy | undefined
  nextHostedIndex: () => number
}

export type GenerateWithQaRepairResult = {
  status: 'skipped' | 'generated' | 'failed'
  qaEntry: PageQaEntry | undefined
  imagesGenerated: number
  totalDurationMs: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  imageInputUnits: number
  textInputUnits: number
  imageOutputUnits: number
  costEntries: QaRepairCostEntry[]
}

export type FailedQaRepairEvidence = GenerateWithQaRepairResult & {
  status: 'failed'
  outputDirectory: string
}
