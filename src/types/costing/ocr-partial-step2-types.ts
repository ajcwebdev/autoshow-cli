import type { OcrProviderFailureSummary, OcrTarget } from '~/types'

export type PartialPageUsage = {
  pageNumber: number
  text: string
  extractionMethod: string
  totalPages: number
  promptTokens?: number | undefined
  completionTokens?: number | undefined
}

export type CollectPartialStep2Options = {
  outputDir: string
  requestedTargets: OcrTarget[]
  failuresByIndex: Map<number, OcrProviderFailureSummary>
  dpi: number
  languages: string
}
