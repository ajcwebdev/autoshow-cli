import type { BoundedTextStreamOptions, BoundedTextStreamResult } from '~/types'

const LINE_TRUNCATION_MARKER = '... [line truncated]'

const normalizePositiveInteger = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`)
  }
  return Math.floor(value)
}

export class TextStreamByteLimitError extends Error {
  readonly limitBytes: number
  readonly observedBytes: number

  constructor(limitBytes: number, observedBytes: number) {
    super(`Text stream exceeded the ${limitBytes}-byte limit after receiving ${observedBytes} bytes.`)
    this.name = 'TextStreamByteLimitError'
    this.limitBytes = limitBytes
    this.observedBytes = observedBytes
  }
}

export class TextStreamLineLimitError extends Error {
  readonly limitCharacters: number

  constructor(limitCharacters: number) {
    super(`Text stream line exceeded the ${limitCharacters}-character limit.`)
    this.name = 'TextStreamLineLimitError'
    this.limitCharacters = limitCharacters
  }
}

export const consumeBoundedTextStream = async (
  stream: ReadableStream<Uint8Array> | null,
  options: BoundedTextStreamOptions
): Promise<BoundedTextStreamResult> => {
  const maxBytes = normalizePositiveInteger(options.maxBytes, 'maxBytes')
  const maxLineCharacters = options.maxLineCharacters === undefined
    ? undefined
    : normalizePositiveInteger(options.maxLineCharacters, 'maxLineCharacters')
  const lineOverflow = options.lineOverflow ?? 'error'
  const retained: string[] = []
  let totalBytes = 0
  let lineCount = 0
  let pendingLine = ''
  let pendingLineTruncated = false

  if (!stream) {
    return { text: '', totalBytes, lineCount }
  }

  const appendLineSegment = (segment: string): void => {
    if (!options.onLine || segment.length === 0 || pendingLineTruncated) return
    if (maxLineCharacters === undefined || pendingLine.length + segment.length <= maxLineCharacters) {
      pendingLine += segment
      return
    }
    if (lineOverflow === 'error') throw new TextStreamLineLimitError(maxLineCharacters)
    const remaining = Math.max(0, maxLineCharacters - pendingLine.length)
    pendingLine += segment.slice(0, remaining)
    pendingLineTruncated = true
  }

  const emitLine = (terminated: boolean): void => {
    if (!options.onLine) return
    const marker = pendingLineTruncated ? LINE_TRUNCATION_MARKER : ''
    options.onLine(`${pendingLine}${marker}${terminated ? '\n' : ''}`)
    lineCount++
    pendingLine = ''
    pendingLineTruncated = false
  }

  const frameLines = (chunk: string): void => {
    if (!options.onLine || chunk.length === 0) return
    let offset = 0
    while (offset < chunk.length) {
      const newlineIndex = chunk.indexOf('\n', offset)
      if (newlineIndex === -1) {
        appendLineSegment(chunk.slice(offset))
        return
      }
      appendLineSegment(chunk.slice(offset, newlineIndex))
      emitLine(true)
      offset = newlineIndex + 1
    }
  }

  const acceptText = (chunk: string): void => {
    if (chunk.length === 0) return
    if (options.retainText === true) retained.push(chunk)
    options.onText?.(chunk)
    frameLines(chunk)
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false })
  const cancelReader = async (reason: unknown): Promise<void> => {
    try {
      await reader.cancel(reason)
    } catch {
    }
  }
  const abortReader = (): void => {
    void cancelReader(options.signal?.reason)
  }
  options.signal?.addEventListener('abort', abortReader, { once: true })

  try {
    options.signal?.throwIfAborted()
    while (true) {
      const { done, value } = await reader.read()
      options.signal?.throwIfAborted()
      if (done) break

      const observedBytes = totalBytes + value.byteLength
      if (observedBytes > maxBytes) {
        const remaining = maxBytes - totalBytes
        if (remaining > 0) {
          acceptText(decoder.decode(value.subarray(0, remaining), { stream: true }))
          totalBytes += remaining
        }
        const error = new TextStreamByteLimitError(maxBytes, observedBytes)
        await cancelReader(error)
        throw error
      }

      totalBytes = observedBytes
      acceptText(decoder.decode(value, { stream: true }))
    }

    acceptText(decoder.decode())
    if (options.onLine && (pendingLine.length > 0 || pendingLineTruncated)) emitLine(false)
    return {
      text: options.retainText === true ? retained.join('') : '',
      totalBytes,
      lineCount
    }
  } catch (error) {
    await cancelReader(error)
    throw error
  } finally {
    options.signal?.removeEventListener('abort', abortReader)
    reader.releaseLock()
  }
}
