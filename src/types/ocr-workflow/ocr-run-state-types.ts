import type { ExtractionMetadata, OcrProviderState, OcrProviderSuccess } from '~/types'

export type OcrProviderErrorLike = Error & {
  cause?: unknown
  status?: unknown
  headers?: unknown
  category?: unknown
  stage?: unknown
}

export type ExistingOcrRun = {
  successes: Array<OcrProviderSuccess | undefined>
  successMetadata: Array<ExtractionMetadata | undefined>
  providerStates: Map<string, OcrProviderState>
}
