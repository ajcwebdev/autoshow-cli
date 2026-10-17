import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { AppError } from '~/utils/error-handler'
import {
  HTTP_PAYLOAD_CLASS_BYTES,
  HTTP_PAYLOAD_MAX_BYTES_ENV,
  resolveHttpPayloadLimit,
  sourceDownloadSignal,
  writeHttpPayloadToFile
} from '~/utils/http-payload'
import { materializeMediaInput } from '~/utils/media-url'
import { downloadDocumentUrlToTempFile } from '~/cli/commands/sources/download/document/resolve-document-source'
import { resolveVideoMediaFileForUpload } from '~/cli/commands/visuals/video/video-utils/video-media-inputs'
import { resolveExtractInputPageCountForPricing } from '~/cli/commands/text/ocr/ocr-pricing/ocr-estimates'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

// Local transport only: a loopback Bun.serve or an in-process Response, never a third-party host.
// These cases establish transfer bounds and partial-file cleanup, not media validity.
const dirs = setupContractSuiteLifecycle({ envKeys: [HTTP_PAYLOAD_MAX_BYTES_ENV], tempPrefix: 'autoshow-source-download-' })
const GIB = 1024 * 1024 * 1024
const SOURCE_CEILING = HTTP_PAYLOAD_CLASS_BYTES.source

const streamOf = (chunks: readonly Uint8Array[], onPull?: () => void): ReadableStream<Uint8Array> => {
  let index = 0
  return new ReadableStream({
    pull(controller) {
      onPull?.()
      const next = chunks[index++]
      if (next) controller.enqueue(next)
      else controller.close()
    }
  }, { highWaterMark: 0 })
}

const captureAppError = async (promise: Promise<unknown>): Promise<AppError> => {
  const error = await promise.then(() => undefined, (failure: unknown) => failure)
  expect(error).toBeInstanceOf(AppError)
  return error as AppError
}

const withSlowServer = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response(new ReadableStream({
      async pull(controller) {
        await Bun.sleep(40)
        controller.enqueue(new Uint8Array(256))
      }
    }))
  })
  try {
    return await run(`http://127.0.0.1:${server.port}/source.bin`)
  } finally {
    server.stop(true)
  }
}

describe('source download ceiling', () => {
  test('the source class defaults to 16 GiB, far above in-memory downloads', () => {
    expect(SOURCE_CEILING).toBe(16 * GIB)
    expect(resolveHttpPayloadLimit({ payloadClass: 'source' })).toEqual({ maxBytes: 16 * GIB, source: 'class', payloadClass: 'source' })
    expect(SOURCE_CEILING).toBeGreaterThan(HTTP_PAYLOAD_CLASS_BYTES.download)
  })

  test('an override sized for memory never lowers the source ceiling but can raise it', () => {
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '2048'
    expect(resolveHttpPayloadLimit({ payloadClass: 'source' })).toEqual({ maxBytes: SOURCE_CEILING, source: 'class', payloadClass: 'source' })
    expect(resolveHttpPayloadLimit({ payloadClass: 'source', maxBytes: 512 })).toEqual({ maxBytes: 512, source: 'call', payloadClass: 'source' })
    expect(resolveHttpPayloadLimit({ payloadClass: 'control' })).toEqual({ maxBytes: 2048, source: 'environment', payloadClass: 'control' })

    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(20 * GIB)
    expect(resolveHttpPayloadLimit({ payloadClass: 'source', maxBytes: 512 })).toEqual({ maxBytes: 20 * GIB, source: 'environment', payloadClass: 'source' })

    delete process.env[HTTP_PAYLOAD_MAX_BYTES_ENV]
    expect(resolveHttpPayloadLimit({ payloadClass: 'source' }).source).toBe('class')
  })
})

describe('bounded source writes', () => {
  test('a chunked body with no Content-Length stops at the budget and leaves no partial file', async () => {
    const path = join(await dirs.make(), 'endless.bin')
    let pulls = 0
    const response = new Response(streamOf(Array.from({ length: 50 }, () => new Uint8Array(512)), () => { pulls += 1 }))

    const error = await captureAppError(writeHttpPayloadToFile(response, path, { payloadClass: 'source', maxBytes: 1024, stage: 'fixture:source' }))

    expect(error.kind).toBe('validation')
    expect(error.stage).toBe('fixture:source')
    expect(error.retryable).toBe(false)
    expect(error.message).toContain('over the 1,024 byte ceiling for source HTTP payloads')
    expect(error.metadata).toMatchObject({ payloadClass: 'source', limitBytes: 1024, observedMeasure: 'streamed', observedBytes: 1536 })
    expect(error.hints.some((hint) => hint.includes('billed'))).toBe(false)
    expect(pulls).toBeLessThan(10)
    expect(await Bun.file(path).exists()).toBe(false)
  })

  test('a declared Content-Length over the budget is rejected before any file is created', async () => {
    const path = join(await dirs.make(), 'declared.bin')
    let pulls = 0
    const response = new Response(streamOf([new Uint8Array(64)], () => { pulls += 1 }), { headers: { 'content-length': '4096' } })

    const error = await captureAppError(writeHttpPayloadToFile(response, path, { payloadClass: 'source', maxBytes: 1024 }))

    expect(error.metadata).toMatchObject({ observedMeasure: 'declared', observedBytes: 4096 })
    expect(pulls).toBe(0)
    expect(await Bun.file(path).exists()).toBe(false)
  })

  test('an active but slow transfer stops at the source deadline and removes its partial file', async () => {
    const path = join(await dirs.make(), 'slow.bin')
    await withSlowServer(async (url) => {
      const started = Date.now()
      const response = await fetch(url, { signal: sourceDownloadSignal(undefined, 200) })
      await expect(writeHttpPayloadToFile(response, path, { payloadClass: 'source' })).rejects.toMatchObject({ name: 'TimeoutError' })
      expect(Date.now() - started).toBeLessThan(2_000)
    })
    expect(await Bun.file(path).exists()).toBe(false)
  })

  test('a caller abort mid-stream closes the writer and removes only the partial file', async () => {
    const root = await dirs.make()
    const path = join(root, 'aborted.bin')
    const sibling = join(root, 'kept.txt')
    await Bun.write(sibling, 'unrelated artifact')
    const controller = new AbortController()
    await withSlowServer(async (url) => {
      const response = await fetch(url, { signal: sourceDownloadSignal(controller.signal) })
      setTimeout(() => controller.abort(new Error('caller cancelled download')), 120)
      await expect(writeHttpPayloadToFile(response, path, { payloadClass: 'source' })).rejects.toThrow('caller cancelled download')
    })
    expect(await Bun.file(path).exists()).toBe(false)
    expect(await Bun.file(sibling).text()).toBe('unrelated artifact')
  })

  test('a valid source completes byte-identical within the budget', async () => {
    const path = join(await dirs.make(), 'valid.bin')
    const bytes = new Uint8Array(3000).map((_, index) => index % 251)
    const response = new Response(streamOf([bytes.slice(0, 1000), bytes.slice(1000)]))

    expect(await writeHttpPayloadToFile(response, path, { payloadClass: 'source', maxBytes: 3000 })).toBe(3000)
    expect(new Uint8Array(await Bun.file(path).arrayBuffer())).toEqual(bytes)
  })

  test('a write without limit options stays unbounded, as paid results require', async () => {
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '1'
    const path = join(await dirs.make(), 'paid-result.bin')
    expect(await writeHttpPayloadToFile(new Response(new Uint8Array(4096)), path)).toBe(4096)
  })
})

describe('source download callers pass the budget and a deadline signal', () => {
  const oversizedSource = (signals: Array<AbortSignal | undefined>, contentType: string) => installMockFetch((_call, _input, init) => {
    signals.push(init?.signal ?? undefined)
    return new Response(streamOf([new Uint8Array(16)]), { headers: { 'content-type': contentType, 'content-length': String(SOURCE_CEILING + 1) } })
  })

  const expectSourceCeiling = (error: unknown): void => {
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).metadata).toMatchObject({ payloadClass: 'source', limitBytes: SOURCE_CEILING, observedMeasure: 'declared' })
  }

  const expectDeadlineSignals = (signals: Array<AbortSignal | undefined>): void => {
    expect(signals.length).toBeGreaterThan(0)
    for (const signal of signals) {
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal?.aborted).toBe(false)
    }
  }

  test('media URL inputs', async () => {
    const signals: Array<AbortSignal | undefined> = []
    oversizedSource(signals, 'video/mp4')
    const error = await materializeMediaInput('https://example.test/video.mp4').then(() => undefined, (failure: unknown) => failure)
    expect((error as AppError).message).toStartWith('Failed to download media URL:')
    expectSourceCeiling((error as AppError).cause)
    expectDeadlineSignals(signals)
  })

  test('direct document URLs', async () => {
    const signals: Array<AbortSignal | undefined> = []
    oversizedSource(signals, 'application/pdf')
    expectSourceCeiling(await downloadDocumentUrlToTempFile('https://example.test/scan.pdf').then(() => undefined, (error: unknown) => error))
    expectDeadlineSignals(signals)
  })

  test('video reference uploads', async () => {
    const signals: Array<AbortSignal | undefined> = []
    oversizedSource(signals, 'video/mp4')
    const root = await dirs.make()
    expectSourceCeiling(await resolveVideoMediaFileForUpload('https://example.test/reference.mp4', root).then(() => undefined, (error: unknown) => error))
    expectDeadlineSignals(signals)
  })

  test('OCR price page counting for remote PDFs', async () => {
    const signals: Array<AbortSignal | undefined> = []
    oversizedSource(signals, 'application/pdf')
    const error = await resolveExtractInputPageCountForPricing('https://example.test/oversized-price-check.pdf').then(() => undefined, (failure: unknown) => failure)
    expect(error).toBeInstanceOf(AppError)
    expectSourceCeiling((error as AppError).cause)
    expectDeadlineSignals(signals)
  })
})
