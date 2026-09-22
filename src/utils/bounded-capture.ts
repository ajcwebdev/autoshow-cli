import { sanitizeLogMetadata, sanitizeLogText } from '~/utils/app-logger/redaction'
import type { BoundedCaptureOptions, BoundedCaptureResult } from '~/types'
import { consumeBoundedTextStream, TextStreamByteLimitError } from '~/utils/bounded-text-stream'

const DEFAULT_PROCESS_CAPTURE_BYTES = 4 * 1024 * 1024
const DEFAULT_HTTP_CAPTURE_BYTES = 16 * 1024 * 1024
const DEFAULT_PREVIEW_BYTES = 8 * 1024
const MAX_DIAGNOSTIC_BODY_READ_BYTES = 64 * 1024 * 1024

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
  // A cut inside a surrogate pair would leave half a character at the head of the tail.
  const first = trimmed.charCodeAt(0)
  return first >= 0xdc00 && first <= 0xdfff ? trimmed.slice(1) : trimmed
}

export class BoundedTextCapture {
  private parts: string[] = []
  private pendingBytes = 0
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

    const bytes = byteLength(chunk)
    this.total += bytes
    this.parts.push(chunk)
    this.pendingBytes += bytes
    // Trimming re-encodes everything retained, so it waits until a full cap of surplus has built
    // up. That keeps a chatty stream linear instead of re-encoding the cap on every chunk.
    if (this.pendingBytes > this.maxBytes * 2) {
      this.compact()
    }
  }

  private compact(): string {
    const text = trimToLastBytes(this.parts.join(''), this.maxBytes)
    this.parts = text.length > 0 ? [text] : []
    this.pendingBytes = byteLength(text)
    return text
  }

  result(): BoundedCaptureResult {
    const text = this.compact()
    const retainedBytes = this.pendingBytes
    const truncated = this.total > retainedBytes
    const omittedBytes = Math.max(0, this.total - retainedBytes)
    const preview = trimToLastBytes(text, this.previewBytes)
    return {
      text,
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

  // Retention is what bounds memory here. The stream itself is drained to its end, because
  // cancelling a subprocess pipe kills a child that was succeeding.
  await consumeBoundedTextStream(stream, {
    maxBytes: Number.MAX_SAFE_INTEGER,
    onText: (chunk) => {
      capture.append(chunk)
      onText?.(chunk)
    }
  })

  return capture.result()
}

/** Summarizes text that was already read whole, so a diagnostic carries a redacted tail instead of the body. */
export const captureDiagnosticText = (text: string, options: BoundedCaptureOptions = {}): BoundedCaptureResult => {
  const capture = new BoundedTextCapture(options, DEFAULT_PREVIEW_BYTES)
  capture.append(text)
  return capture.result()
}

let httpCaptureBytesForTests: number | undefined

export const setHttpCaptureBytesForTests = (bytes?: number): void => {
  httpCaptureBytesForTests = bytes
}

/**
 * Diagnostic capture of an HTTP body, normally an error body. Reading stops after a fixed amount so
 * an endless body cannot hang the caller, and stopping is reported as truncation rather than thrown,
 * so it never replaces the HTTP failure the body describes.
 */
export const readBoundedResponseText = async (
  response: Response,
  options: BoundedCaptureOptions = {}
): Promise<BoundedCaptureResult> => {
  const defaultMaxBytes = httpCaptureBytesForTests ?? DEFAULT_HTTP_CAPTURE_BYTES
  const capture = new BoundedTextCapture(options, defaultMaxBytes)
  if (!response.body) {
    return capture.result()
  }

  let stoppedEarly = false
  try {
    await consumeBoundedTextStream(response.body, {
      maxBytes: Math.max(MAX_DIAGNOSTIC_BODY_READ_BYTES, normalizePositiveBytes(options.maxBytes, defaultMaxBytes)),
      onText: (chunk) => capture.append(chunk)
    })
  } catch (error) {
    if (!(error instanceof TextStreamByteLimitError)) {
      throw error
    }
    stoppedEarly = true
  }

  const result = capture.result()
  return stoppedEarly ? { ...result, truncated: true } : result
}

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
