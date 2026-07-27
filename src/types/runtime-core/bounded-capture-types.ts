export type BoundedCaptureResult = {
  text: string
  totalBytes: number
  retainedBytes: number
  truncated: boolean
  omittedBytes: number
  sanitizedPreview: string
}

export type BoundedCaptureOptions = {
  maxBytes?: number | undefined
  previewBytes?: number | undefined
}
