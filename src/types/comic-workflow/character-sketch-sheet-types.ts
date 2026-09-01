import type { CharacterSketchView } from '~/types'

export type CharacterSketchSheetSource = {
  view: CharacterSketchView
  path: string
}

export type CharacterSketchSheetSelection = {
  outputPath: string
  sources: CharacterSketchSheetSource[]
}

export type CharacterSketchSheetSourceMetadata = CharacterSketchSheetSource & {
  width: number
  height: number
}
