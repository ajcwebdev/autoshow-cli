import { rm } from 'node:fs/promises'
import type { HttpPayloadClass, HttpPayloadLimit, HttpPayloadReadOptions, InlineMediaResponseEstimate } from '~/types'
import { AppError, UsageError } from '~/utils/error-handler'

// Contract: successful HTTP bodies are read here, whole or not at all. Bounded capture in
// `bounded-capture.ts` keeps a redacted tail for diagnostics (error bodies, process output) and
// must not be used for a body the caller needs to parse.

export const HTTP_PAYLOAD_MAX_BYTES_ENV = 'AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES'

const MIB = 1024 * 1024

/**
 * Ceilings only stop one response from exhausting memory. A successful body is work a provider
 * was already paid for, so `result` leaves wide headroom over any real deliverable.
 */
export const HTTP_PAYLOAD_CLASS_BYTES = {
  control: 16 * MIB,
  result: 512 * MIB,
  download: 2048 * MIB
} as const satisfies Record<HttpPayloadClass, number>

const DEFAULT_PAYLOAD_CLASS: HttpPayloadClass = 'result'

const readEnvironmentLimit = (): number | undefined => {
  const raw = process.env[HTTP_PAYLOAD_MAX_BYTES_ENV]?.trim()
  if (!raw) return undefined
  const value = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value <= 0) {
    throw UsageError(`${HTTP_PAYLOAD_MAX_BYTES_ENV} must be a positive whole number of bytes, received "${raw}".`, {
      stage: 'http:payload',
      hints: [`Example: ${HTTP_PAYLOAD_MAX_BYTES_ENV}=${1024 * MIB} allows 1 GiB responses.`]
    })
  }
  return value
}

/** Fails on a malformed override before any provider request is dispatched. */
export const validateHttpPayloadEnvironment = (): void => {
  readEnvironmentLimit()
}

export const resolveHttpPayloadLimit = (options: HttpPayloadReadOptions = {}): HttpPayloadLimit => {
  const payloadClass = options.payloadClass ?? DEFAULT_PAYLOAD_CLASS
  const environmentLimit = readEnvironmentLimit()
  if (environmentLimit !== undefined) return { maxBytes: environmentLimit, source: 'environment', payloadClass }
  if (typeof options.maxBytes === 'number' && Number.isFinite(options.maxBytes) && options.maxBytes > 0) {
    return { maxBytes: Math.floor(options.maxBytes), source: 'call', payloadClass }
  }
  return { maxBytes: HTTP_PAYLOAD_CLASS_BYTES[payloadClass], source: 'class', payloadClass }
}

const OBSERVED_SIZE_PHRASES = {
  declared: (bytes: string): string => `response body is ${bytes} bytes`,
  streamed: (bytes: string): string => `response body passed ${bytes} bytes while streaming`,
  estimated: (bytes: string): string => `response body is estimated at ${bytes} bytes`
} as const

const oversizeError = (
  label: string,
  limit: HttpPayloadLimit,
  observed: { bytes: number, measure: keyof typeof OBSERVED_SIZE_PHRASES },
  context: { status?: number | undefined, stage?: string | undefined }
): AppError => {
  const size = OBSERVED_SIZE_PHRASES[observed.measure](observed.bytes.toLocaleString())
  return new AppError(`${label}: ${size}, over the ${limit.maxBytes.toLocaleString()} byte ceiling for ${limit.payloadClass} HTTP payloads. Set ${HTTP_PAYLOAD_MAX_BYTES_ENV} to a larger byte count to raise it.`, {
    kind: 'validation',
    stage: context.stage ?? 'http:payload',
    retryable: false,
    ...(context.status !== undefined ? { status: context.status } : {}),
    hints: [
      `Set ${HTTP_PAYLOAD_MAX_BYTES_ENV} (bytes) above the reported size, then rerun.`,
      ...(observed.measure === 'estimated' ? [] : ['The provider may already have billed this request, so raise the ceiling before retrying.'])
    ],
    metadata: {
      payloadClass: limit.payloadClass,
      limitBytes: limit.maxBytes,
      limitSource: limit.source,
      observedBytes: observed.bytes,
      observedMeasure: observed.measure
    }
  })
}

const declaredContentLength = (response: Response): number | undefined => {
  const raw = response.headers.get('content-length')
  if (!raw || !/^\d+$/.test(raw.trim())) return undefined
  const value = Number(raw.trim())
  return Number.isSafeInteger(value) ? value : undefined
}

const consumePayload = async (
  response: Response,
  label: string,
  options: HttpPayloadReadOptions,
  onChunk: (chunk: Uint8Array) => void
): Promise<number> => {
  const limit = resolveHttpPayloadLimit(options)
  const context = { status: response.status, stage: options.stage }
  const stream = response.body
  if (!stream) return 0

  const declared = declaredContentLength(response)
  if (declared !== undefined && declared > limit.maxBytes) {
    await stream.cancel().catch(() => {})
    throw oversizeError(label, limit, { bytes: declared, measure: 'declared' }, context)
  }

  const reader = stream.getReader()
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return totalBytes
      totalBytes += value.byteLength
      if (totalBytes > limit.maxBytes) {
        const error = oversizeError(label, limit, { bytes: totalBytes, measure: 'streamed' }, context)
        await reader.cancel(error).catch(() => {})
        throw error
      }
      onChunk(value)
    }
  } finally {
    reader.releaseLock()
  }
}

export const readHttpPayloadBytes = async (
  response: Response,
  label: string,
  options: HttpPayloadReadOptions = {}
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = []
  const totalBytes = await consumePayload(response, label, options, chunk => { chunks.push(chunk) })
  if (chunks.length === 1) return chunks[0] as Uint8Array
  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export const readHttpPayloadText = async (
  response: Response,
  label: string,
  options: HttpPayloadReadOptions = {}
): Promise<string> => {
  const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false })
  const parts: string[] = []
  await consumePayload(response, label, options, chunk => { parts.push(decoder.decode(chunk, { stream: true })) })
  parts.push(decoder.decode())
  return parts.join('')
}

/** Drop-in for `response.json()`: a malformed body still throws the native `SyntaxError`. */
export const readHttpPayloadJson = async (
  response: Response,
  label: string,
  options: HttpPayloadReadOptions = {}
): Promise<unknown> => JSON.parse(await readHttpPayloadText(response, label, options)) as unknown

/**
 * Streams a body straight to disk. Nothing is held in memory, so no ceiling applies and a
 * download of any size works. A failed transfer removes the partial file.
 */
export const writeHttpPayloadToFile = async (response: Response, path: string): Promise<number> => {
  const stream = response.body
  if (!stream) {
    await Bun.write(path, new Uint8Array(0))
    return 0
  }

  const writer = Bun.file(path).writer()
  const reader = stream.getReader()
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      await writer.write(value)
    }
    await writer.end()
    return totalBytes
  } catch (error) {
    await reader.cancel(error).catch(() => {})
    await Promise.resolve(writer.end()).catch(() => {})
    await rm(path, { force: true }).catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}

const INLINE_ENCODING_EXPANSION = { base64: 4 / 3, hex: 2 } as const

export const estimateInlineMediaResponseBytes = (estimate: InlineMediaResponseEstimate): number =>
  Math.ceil(Math.max(0, estimate.mediaBytes) * INLINE_ENCODING_EXPANSION[estimate.encoding]) + Math.max(0, estimate.envelopeBytes ?? 0)

/**
 * Rejects a request whose inlined response cannot fit under the active ceiling, so the overflow
 * surfaces before the provider is called rather than after it has billed.
 */
export const assertInlineMediaResponseFits = (
  label: string,
  estimate: InlineMediaResponseEstimate,
  options: HttpPayloadReadOptions = {}
): void => {
  const limit = resolveHttpPayloadLimit(options)
  const estimatedBytes = estimateInlineMediaResponseBytes(estimate)
  if (estimatedBytes <= limit.maxBytes) return
  throw oversizeError(label, limit, { bytes: estimatedBytes, measure: 'estimated' }, { stage: options.stage })
}
