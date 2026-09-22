import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { AppError, isUsageError } from '~/utils/error-handler'
import { setHttpCaptureBytesForTests } from '~/utils/bounded-capture'
import {
  assertInlineMediaResponseFits,
  estimateInlineMediaResponseBytes,
  HTTP_PAYLOAD_CLASS_BYTES,
  HTTP_PAYLOAD_MAX_BYTES_ENV,
  readHttpPayloadBytes,
  readHttpPayloadJson,
  readHttpPayloadText,
  resolveHttpPayloadLimit,
  validateHttpPayloadEnvironment,
  writeHttpPayloadToFile
} from '~/utils/http-payload'
import { readJsonResponse } from '~/utils/rest-client'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: [HTTP_PAYLOAD_MAX_BYTES_ENV],
  tempPrefix: 'autoshow-http-payload-'
})

const MIB = 1024 * 1024
const FORMER_SHARED_CAPTURE_BYTES = 16 * MIB

const chunkedResponse = (chunks: readonly Uint8Array[], init: ResponseInit = {}): { response: Response, pulled: () => number, cancelled: () => boolean } => {
  let pulled = 0
  let cancelled = false
  const response = new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[pulled]
      if (chunk === undefined) {
        controller.close()
        return
      }
      pulled += 1
      controller.enqueue(chunk)
    },
    cancel() {
      cancelled = true
    }
  }), init)
  return { response, pulled: () => pulled, cancelled: () => cancelled }
}

const captureAppError = async (operation: () => Promise<unknown>): Promise<AppError> => {
  try {
    await operation()
  } catch (error) {
    expect(error).toBeInstanceOf(AppError)
    return error as AppError
  }
  throw new Error('Expected the payload read to be rejected.')
}

describe('HTTP payload reader contracts', () => {
  test('an undeclared JSON body larger than the former 16 MiB shared capture is read whole', async () => {
    const inlineAudio = 'A'.repeat(FORMER_SHARED_CAPTURE_BYTES + MIB)
    const body = JSON.stringify({ audioContent: inlineAudio, tail: 'end-marker' })
    expect(Buffer.byteLength(body)).toBeGreaterThan(FORMER_SHARED_CAPTURE_BYTES)

    const parsed = await readJsonResponse(new Response(body), 'Fixture response') as { audioContent: string, tail: string }
    expect(parsed.audioContent.length).toBe(inlineAudio.length)
    expect(parsed.tail).toBe('end-marker')
  })

  test('the diagnostic capture limit no longer governs successful bodies', async () => {
    setHttpCaptureBytesForTests(64)
    try {
      const body = JSON.stringify({ value: 'x'.repeat(4096) })
      expect(await readJsonResponse(new Response(body), 'Fixture response')).toEqual({ value: 'x'.repeat(4096) })
    } finally {
      setHttpCaptureBytesForTests()
    }
  })

  test('payload classes default to result and keep control-plane JSON small', () => {
    expect(resolveHttpPayloadLimit()).toEqual({ maxBytes: HTTP_PAYLOAD_CLASS_BYTES.result, source: 'class', payloadClass: 'result' })
    expect(resolveHttpPayloadLimit({ payloadClass: 'control' }).maxBytes).toBe(16 * MIB)
    expect(HTTP_PAYLOAD_CLASS_BYTES.result).toBeGreaterThanOrEqual(256 * MIB)
    expect(HTTP_PAYLOAD_CLASS_BYTES.download).toBeGreaterThan(HTTP_PAYLOAD_CLASS_BYTES.result)
    expect(resolveHttpPayloadLimit({ payloadClass: 'control', maxBytes: 10 })).toEqual({ maxBytes: 10, source: 'call', payloadClass: 'control' })
  })

  test('a declared Content-Length over the ceiling is rejected before any body byte is read', async () => {
    const fixture = chunkedResponse([new Uint8Array(64)], { status: 200, headers: { 'content-length': '4096' } })
    const error = await captureAppError(async () => await readHttpPayloadText(fixture.response, 'Fixture response', { maxBytes: 1024, stage: 'fixture:stage' }))

    expect(fixture.pulled()).toBeLessThanOrEqual(1)
    expect(error.kind).toBe('validation')
    expect(error.stage).toBe('fixture:stage')
    expect(error.message).toBe(`Fixture response: response body is 4,096 bytes, over the 1,024 byte ceiling for result HTTP payloads. Set ${HTTP_PAYLOAD_MAX_BYTES_ENV} to a larger byte count to raise it.`)
  })

  test('a chunked body without Content-Length is rejected mid-stream, cancelled and never retried', async () => {
    const fixture = chunkedResponse(Array.from({ length: 8 }, () => new Uint8Array(512)), { status: 200 })
    const error = await captureAppError(async () => await readHttpPayloadBytes(fixture.response, 'Fixture audio', { maxBytes: 1024, payloadClass: 'download' }))

    expect(fixture.pulled()).toBeLessThan(8)
    expect(fixture.cancelled()).toBe(true)
    expect(error.message).toContain('Fixture audio: response body passed 1,536 bytes while streaming, over the 1,024 byte ceiling for download HTTP payloads.')
    expect(error.retryable).toBe(false)
    expect(error.status).toBe(200)
    expect(error.hints.join(' ')).toContain(HTTP_PAYLOAD_MAX_BYTES_ENV)
    expect(error.hints.join(' ')).toContain('may already have billed')
    expect(error.metadata).toMatchObject({ payloadClass: 'download', limitBytes: 1024, limitSource: 'call', observedBytes: 1536, observedMeasure: 'streamed' })
  })

  test('a body exactly at the ceiling is accepted', async () => {
    const bytes = await readHttpPayloadBytes(chunkedResponse([new Uint8Array(512).fill(1), new Uint8Array(512).fill(2)]).response, 'Fixture audio', { maxBytes: 1024 })
    expect(bytes.byteLength).toBe(1024)
    expect([bytes[0], bytes[511], bytes[512], bytes[1023]]).toEqual([1, 1, 2, 2])
  })

  test('text decoding survives a multi-byte character split across chunks', async () => {
    const encoded = new TextEncoder().encode('snow ☃ and 🎧 audio')
    const split = encoded.indexOf(0xe2) + 1
    const secondSplit = encoded.indexOf(0xf0) + 2
    const fixture = chunkedResponse([encoded.subarray(0, split), encoded.subarray(split, secondSplit), encoded.subarray(secondSplit)])
    expect(await readHttpPayloadText(fixture.response, 'Fixture text')).toBe('snow ☃ and 🎧 audio')
  })

  test('empty and absent bodies read as empty rather than failing', async () => {
    expect(await readHttpPayloadText(new Response(null, { status: 204 }), 'Fixture response')).toBe('')
    expect((await readHttpPayloadBytes(new Response(''), 'Fixture response')).byteLength).toBe(0)
    expect(await readJsonResponse(new Response(''), 'Fixture response')).toEqual({})
  })

  test('strict JSON keeps the native SyntaxError for malformed bodies and surfaces oversize as AppError', async () => {
    await expect(readHttpPayloadJson(new Response('not json'), 'Fixture response')).rejects.toBeInstanceOf(SyntaxError)
    await expect(readHttpPayloadJson(new Response(''), 'Fixture response')).rejects.toBeInstanceOf(SyntaxError)
    expect(await readHttpPayloadJson(new Response('{"ok":true}'), 'Fixture response')).toEqual({ ok: true })
    const error = await captureAppError(async () => await readHttpPayloadJson(new Response('{"ok":true}'), 'Fixture response', { maxBytes: 4 }))
    expect(error.kind).toBe('validation')
  })

  test('the environment override replaces every ceiling in both directions and beats a per-call limit', async () => {
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '2048'
    expect(resolveHttpPayloadLimit({ payloadClass: 'control' })).toEqual({ maxBytes: 2048, source: 'environment', payloadClass: 'control' })
    expect(resolveHttpPayloadLimit({ payloadClass: 'download', maxBytes: 16 }).maxBytes).toBe(2048)
    expect((await readHttpPayloadBytes(new Response(new Uint8Array(2048)), 'Fixture audio', { maxBytes: 16 })).byteLength).toBe(2048)

    const lowered = await captureAppError(async () => await readHttpPayloadBytes(new Response(new Uint8Array(2049)), 'Fixture audio'))
    expect(lowered.metadata).toMatchObject({ limitBytes: 2048, limitSource: 'environment' })

    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '   '
    expect(resolveHttpPayloadLimit().source).toBe('class')
  })

  test('a malformed environment override is a usage error that startup validation raises before dispatch', () => {
    for (const value of ['0', '-1', '1.5', '64MiB', 'abc', '1e9']) {
      process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = value
      let thrown: unknown
      try {
        validateHttpPayloadEnvironment()
      } catch (error) {
        thrown = error
      }
      expect(isUsageError(thrown)).toBe(true)
      expect((thrown as Error).message).toContain(HTTP_PAYLOAD_MAX_BYTES_ENV)
      expect((thrown as Error).message).toContain(value)
    }
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '1073741824'
    expect(() => validateHttpPayloadEnvironment()).not.toThrow()
  })

  test('streaming to disk writes every byte, handles empty bodies and removes a partial file on failure', async () => {
    const root = await tempDirs.make()
    const chunks = Array.from({ length: 6 }, (_, index) => new Uint8Array(1024).fill(index + 1))
    const target = join(root, 'download.bin')
    expect(await writeHttpPayloadToFile(chunkedResponse(chunks).response, target)).toBe(6 * 1024)
    const written = new Uint8Array(await Bun.file(target).arrayBuffer())
    expect(written.byteLength).toBe(6 * 1024)
    expect([written[0], written[written.byteLength - 1]]).toEqual([1, 6])

    const empty = join(root, 'empty.bin')
    expect(await writeHttpPayloadToFile(new Response(null), empty)).toBe(0)
    expect(await Bun.file(empty).exists()).toBe(true)

    let sent = 0
    const broken = new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1
        if (sent > 2) controller.error(new Error('socket closed mid-download'))
        else controller.enqueue(new Uint8Array(1024))
      }
    }))
    const partial = join(root, 'partial.bin')
    await expect(writeHttpPayloadToFile(broken, partial)).rejects.toThrow('socket closed mid-download')
    expect(await Bun.file(partial).exists()).toBe(false)
  })

  test('streaming to disk is not bound by any ceiling', async () => {
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '1024'
    const root = await tempDirs.make()
    const target = join(root, 'large.bin')
    expect(await writeHttpPayloadToFile(new Response(new Uint8Array(64 * 1024)), target)).toBe(64 * 1024)
  })

  test('inline media estimates account for base64 and hex expansion plus the JSON envelope', () => {
    expect(estimateInlineMediaResponseBytes({ mediaBytes: 3_000_000, encoding: 'base64' })).toBe(4_000_000)
    expect(estimateInlineMediaResponseBytes({ mediaBytes: 3_000_000, encoding: 'hex', envelopeBytes: 500 })).toBe(6_000_500)
  })

  test('an inlined response that cannot fit is rejected before dispatch without a billing hint', () => {
    expect(() => assertInlineMediaResponseFits('Fixture TTS chunk 1 of 1', { mediaBytes: 24 * MIB, encoding: 'base64' })).not.toThrow()

    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(FORMER_SHARED_CAPTURE_BYTES)
    let thrown: unknown
    try {
      assertInlineMediaResponseFits('Fixture TTS chunk 1 of 1', { mediaBytes: 24 * MIB, encoding: 'base64' }, { stage: 'tts:fixture' })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(AppError)
    const error = thrown as AppError
    expect(error.message).toContain('Fixture TTS chunk 1 of 1: response body is estimated at 33,554,432 bytes, over the 16,777,216 byte ceiling')
    expect(error.stage).toBe('tts:fixture')
    expect(error.metadata).toMatchObject({ observedMeasure: 'estimated', limitSource: 'environment' })
    expect(error.hints.join(' ')).not.toContain('billed')
  })
})

describe('HTTP payload override at CLI startup', () => {
  const runCli = (value: string): { exitCode: number, stderr: string } => {
    const child = Bun.spawnSync([process.execPath, '--no-env-file', 'src/cli/create-cli.ts', '--help'], {
      env: { PATH: process.env['PATH'] ?? '', HOME: process.env['HOME'] ?? '', [HTTP_PAYLOAD_MAX_BYTES_ENV]: value },
      stdout: 'ignore',
      stderr: 'pipe'
    })
    return { exitCode: child.exitCode, stderr: child.stderr.toString() }
  }

  test('a malformed override exits 2 with a usage error before any command runs', () => {
    const result = runCli('64MiB')
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain(`${HTTP_PAYLOAD_MAX_BYTES_ENV} must be a positive whole number of bytes, received "64MiB".`)
  }, 30_000)

  test('a valid override is accepted', () => {
    expect(runCli('1073741824').exitCode).toBe(0)
  }, 30_000)
})
