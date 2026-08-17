import type { OcrProviderMode, OcrTarget } from '~/types'

export type OcrProviderRunContext = {
  outputDir: string
  requestedTargets: OcrTarget[]
  targetsToRun: OcrTarget[]
  ocrProviderMode?: OcrProviderMode | undefined
  reenabledTargets?: OcrTarget[] | undefined
}
