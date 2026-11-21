import type { ComicImageRequestFn, ComicImageWriteFn, ComicPageChunk, ComicPanelSource, GenerateComicPagesOptions } from '~/types'

export type ComicPagePanelSource = ComicPanelSource & { normalizedPrompt: string }

export type ComicPageGroup = ComicPageChunk<ComicPagePanelSource>

export type PageRenderContext = {
  sceneSlug: string
  options: GenerateComicPagesOptions
  requestImage: ComicImageRequestFn
  writeImage: ComicImageWriteFn
  nextHostedIndex: () => number
}

export type { ComicImageRenderResult } from './generate-panel-images-types'
export type PageRenderResult = import('./generate-panel-images-types').ComicImageRenderResult
