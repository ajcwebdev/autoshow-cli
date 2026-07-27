import type { OcrTarget } from '~/types'

export type OcrProviderRunContext = {
  outputDir: string
  requestedTargets: OcrTarget[]
  targetsToRun: OcrTarget[]
}
