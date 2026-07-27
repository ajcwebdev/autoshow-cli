// Structural mirror of the model-loader `ExtractEstimation` returned by
// `getExtractEstimation`; kept here so type-land never imports from src/cli.
export type ExtractTimingEstimation = {
  costMultiplier: number
  msPerPage: number
  singlePagePdfFallbackMsPerPage?: number
  promptTokensPerPage?: number
  completionTokensPerPage?: number
}

export type ExtractStepBuildParams = {
  target: { provider: string, model: string }
  resolvedPageCount: number
  resolvedProcessingTimeMs: number
  estimation: ExtractTimingEstimation
  pageConcurrency: number
  ocrConcurrencyMode: 'auto' | 'fixed'
  hostedOcrProfilePath: string | undefined
  sharedProviderLaneTargetCount: number
  rasterizedPages: number
  singlePagePdfFallbackPages: number
  isPooledOcr: boolean
  isHostedOcr: boolean
}
