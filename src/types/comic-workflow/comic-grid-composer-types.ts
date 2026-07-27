import type { ComicGridSpec } from '~/types'

export type ComicGridCellSize = {
  width: number
  height: number
}

export type ComposeComicGridPageInput = {
  sources: string[]
  outputPath: string
  grid: ComicGridSpec
  cellSize?: ComicGridCellSize
}
