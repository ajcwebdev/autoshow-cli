export type OcrProviderLifecycle = {
  provider: string
  model: string
  status: string
  elapsedMs?: number | undefined
  reason?: string | undefined
  detail?: string | undefined
}

export type OcrPagesProgress = {
  status: string
  ocrPages: number
  totalPages: number
  renderConcurrency: number
  ocrConcurrency: number
}

export type KeyValueEntry = readonly [string, unknown]
