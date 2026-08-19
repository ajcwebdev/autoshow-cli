import type { ComicImageGenerationDependencies, GeneratePanelImagesOptions, ImagePromptVariation, ImageRunStats, PageQaEntry, PromptsConfig } from '~/types'

export type PanelRenderContext = {
  sceneSlug: string
  sceneDirectory: string
  options: GeneratePanelImagesOptions
  variations: ImagePromptVariation[]
  useVariationOutputPaths: boolean
  useModelSpecificFilenames: boolean
  prompts?: PromptsConfig | undefined
  requestImage: NonNullable<ComicImageGenerationDependencies['requestImage']>
  writeImage: typeof import('~/cli/commands/process-steps/step-8-comic/comic-image-services/image-writer').writeGeneratedImage
  judge: NonNullable<ComicImageGenerationDependencies['judgePage']>
  qaEnabled: boolean
  judgeModel: string
  maxRepairs: number
  nextHostedIndex: () => number
}

export type PanelRenderResult = {
  stats: ImageRunStats
  qaEntries: Array<{ directory: string; entry: PageQaEntry }>
  error?: unknown | undefined
}
