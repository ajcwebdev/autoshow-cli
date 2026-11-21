import type { ComicImageGenerationDependencies, ComicPanelImageEvidence, GenerateComicPagesOptions, GeneratePanelImagesOptions, ImageGenerationModel, ImageRunStats } from '~/types'

export type ComicImageRequestFn = NonNullable<ComicImageGenerationDependencies['requestImage']>

export type ComicImageWriteFn = typeof import('~/cli/commands/visuals/comic/comic-image-services/image-writer').writeGeneratedImage

export type PanelRenderContext = {
  sceneSlug: string
  sceneDirectory: string
  options: GeneratePanelImagesOptions
  requestImage: ComicImageRequestFn
  writeImage: ComicImageWriteFn
  nextHostedIndex: () => number
}

export type ComicImageRenderResult = {
  stats: ImageRunStats
  error?: unknown | undefined
}

export type PanelRenderResult = ComicImageRenderResult

export type ComicBaseImageRequestInput = {
  kind: 'panel' | 'page'
  itemNumber: number
  outputPath: string
  model: ImageGenerationModel
  prompt: string
  referenceImages: string[]
  sceneSlug: string
  options: GeneratePanelImagesOptions | GenerateComicPagesOptions
  requestImage: ComicImageRequestFn
  writeImage: ComicImageWriteFn
  nextHostedIndex: () => number
  /** Paid usage is recorded here as soon as the provider returns, before the output is written. */
  stats: ImageRunStats
}

export type ComicBaseImageRequestResult = {
  outputPath: string
  /** Prior bytes moved aside when a forced regeneration replaced an existing output in the same run directory. */
  preservedPriorPath?: string | undefined
  mode?: 'generate' | 'edit' | undefined
  durationMs: number
  costLabel?: string | undefined
} & (
  | { status: 'skipped', generatedEvidence?: never }
  | { status: 'generated', generatedEvidence: ComicPanelImageEvidence }
)
