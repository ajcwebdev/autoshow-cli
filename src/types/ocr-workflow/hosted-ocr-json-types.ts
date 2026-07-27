export type HostedOcrPagePayload = {
  pageNumber: number
  text: string
}

export type NormalizeHostedOcrPagesOptions = {
  emptyPagesMessage?: string | undefined
  countMismatchMessage: (actualPageCount: number, expectedPageCount: number) => string
  nonContiguousMessage: string
}
