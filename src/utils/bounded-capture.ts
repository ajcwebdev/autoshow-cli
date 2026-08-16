import { sanitizeLogMetadata, sanitizeLogText } from '~/utils/app-logger/redaction'
import type { BoundedCaptureOptions, BoundedCaptureResult } from '~/types'

const DEFAULT_PROCESS_CAPTURE_BYTES = 4 * 1024 * 1024
const DEFAULT_HTTP_CAPTURE_BYTES = 16 * 1024 * 1024
const DEFAULT_PREVIEW_BYTES = 8 * 1024

const encoder = new TextEncoder()

const normalizePositiveBytes = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : fallback

const byteLength = (value: string): number => encoder.encode(value).byteLength

const trimToLastBytes = (value: string, maxBytes: number): string => {
  if (byteLength(value) <= maxBytes) {
    return value
  }

  let start = Math.max(0, value.length - maxBytes)
  let trimmed = value.slice(start)
  while (trimmed.length > 0 && byteLength(trimmed) > maxBytes) {
    start += Math.max(1, Math.ceil((byteLength(trimmed) - maxBytes) / 2))
    trimmed = value.slice(start)
  }
  return trimmed
}

export class BoundedTextCapture {
  private text = ''
  private readonly maxBytes: number
  private readonly previewBytes: number
  private total = 0

  constructor(options: BoundedCaptureOptions = {}, defaultMaxBytes = DEFAULT_PROCESS_CAPTURE_BYTES) {
    this.maxBytes = normalizePositiveBytes(options.maxBytes, defaultMaxBytes)
    this.previewBytes = normalizePositiveBytes(options.previewBytes, Math.min(DEFAULT_PREVIEW_BYTES, this.maxBytes))
  }

  append(chunk: string): void {
    if (chunk.length === 0) {
      return
    }

    this.total += byteLength(chunk)
    this.text = trimToLastBytes(`${this.text}${chunk}`, this.maxBytes)
  }

  result(): BoundedCaptureResult {
    const retainedBytes = byteLength(this.text)
    const truncated = this.total > retainedBytes
    const omittedBytes = Math.max(0, this.total - retainedBytes)
    const preview = trimToLastBytes(this.text, this.previewBytes)
    return {
      text: this.text,
      totalBytes: this.total,
      retainedBytes,
      truncated,
      omittedBytes,
      sanitizedPreview: sanitizeLogText(preview)
    }
  }
}

export const readBoundedTextStream = async (
  stream: ReadableStream<Uint8Array> | null,
  options: BoundedCaptureOptions = {},
  defaultMaxBytes = DEFAULT_PROCESS_CAPTURE_BYTES,
  onText?: (chunk: string) => void
): Promise<BoundedCaptureResult> => {
  const capture = new BoundedTextCapture(options, defaultMaxBytes)
  if (!stream) {
    return capture.result()
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      capture.append(chunk)
      onText?.(chunk)
    }

    const trailing = decoder.decode()
    capture.append(trailing)
    onText?.(trailing)
  } finally {
    reader.releaseLock()
  }

  return capture.result()
}

let httpCaptureBytesForTests: number | undefined

export const setHttpCaptureBytesForTests = (bytes?: number): void => {
  httpCaptureBytesForTests = bytes
}

export const readBoundedResponseText = async (
  response: Response,
  options: BoundedCaptureOptions = {}
): Promise<BoundedCaptureResult> =>
  await readBoundedTextStream(response.body, options, httpCaptureBytesForTests ?? DEFAULT_HTTP_CAPTURE_BYTES)

export const buildCaptureMetadata = (
  result: BoundedCaptureResult,
  prefix = 'body'
): Record<string, unknown> => sanitizeLogMetadata({
  [`${prefix}Bytes`]: result.totalBytes,
  [`${prefix}RetainedBytes`]: result.retainedBytes,
  [`${prefix}Truncated`]: result.truncated,
  [`${prefix}OmittedBytes`]: result.omittedBytes,
  [`${prefix}Preview`]: result.sanitizedPreview
})

export const redactPayloadPreview = (value: unknown): unknown =>
  sanitizeLogMetadata({ preview: value })['preview']
