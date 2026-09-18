import type { ComicImageGenerationDependencies, ComicPageChunk, ComicPanelSource, GenerateComicPagesOptions, ImageGenerationModel, ImagePromptVariation, PromptsConfig } from '~/types'

export type ComicPagePanelSource = ComicPanelSource & { normalizedPrompt: string }

export type ComicPageGroup = ComicPageChunk<ComicPagePanelSource>

export type PageWorkItem = {
  variation: ImagePromptVariation
  model: ImageGenerationModel
  pageChunk: ComicPageGroup
}

export type PageRenderContext = {
  sceneSlug: string
  options: GenerateComicPagesOptions
  useVariationOutputPaths: boolean
  useModelSpecificFilenames: boolean
  prompts?: PromptsConfig | undefined
  requestImage: NonNullable<ComicImageGenerationDependencies['requestImage']>
  writeImage: typeof import('~/cli/commands/visuals/comic/comic-image-services/image-writer').writeGeneratedImage
  judgePage: NonNullable<ComicImageGenerationDependencies['judgePage']>
  qaEnabled: boolean
  judgeModel: string
  maxRepairs: number
  nextHostedIndex: () => number
}

export type { ComicImageRenderResult } from './generate-panel-images-types'
export type PageRenderResult = import('./generate-panel-images-types').ComicImageRenderResult
