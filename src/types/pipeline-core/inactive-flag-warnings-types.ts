import type { OcrModelOverrideOptions } from '~/types'

export type OcrSelectionState = OcrModelOverrideOptions & {
  useTesseract?: boolean | undefined
  mistralOcrModels?: string[] | undefined
  glmOcrModels?: string[] | undefined
  kimiOcrModels?: string[] | undefined
  openaiOcrModels?: string[] | undefined
  grokOcrModels?: string[] | undefined
  anthropicOcrModels?: string[] | undefined
  geminiOcrModels?: string[] | undefined
  deepinfraOcrModels?: string[] | undefined
}
