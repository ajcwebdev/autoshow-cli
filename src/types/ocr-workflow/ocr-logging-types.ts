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

export type OcrJobProgress = {
  provider: string
  action: string
  remoteId?: string | undefined
  state: string
  pages?: number | string | undefined
  detail?: string | undefined
}

export type KeyValueEntry = readonly [string, unknown]

export type OcrTransferEvent = {
  action: string
  file: string
  destination: string
}
