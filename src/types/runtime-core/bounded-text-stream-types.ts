export type BoundedTextStreamLineOverflow = 'error' | 'truncate'

export type BoundedTextStreamOptions = {
  maxBytes: number
  maxLineCharacters?: number | undefined
  lineOverflow?: BoundedTextStreamLineOverflow | undefined
  retainText?: boolean | undefined
  signal?: AbortSignal | undefined
  onText?: ((chunk: string) => void) | undefined
  onLine?: ((line: string) => void) | undefined
}

export type BoundedTextStreamResult = {
  text: string
  totalBytes: number
  lineCount: number
}
