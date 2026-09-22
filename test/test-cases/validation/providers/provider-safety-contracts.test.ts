import { describe, expect, test } from 'bun:test'
import {
  BoundedTextCapture,
  buildCaptureMetadata,
  readBoundedResponseText,
  readBoundedTextStream
} from '~/utils/bounded-capture'
import { exec } from '~/utils/cli-utils'

describe('provider safety contracts', () => {
  test('bounded capture retains only a truncated redacted preview', async () => {
    const response = new Response('x'.repeat(64) + '\nauthorization: Bearer secret-token')
    const captured = await readBoundedResponseText(response, {
      maxBytes: 64,
      previewBytes: 80
    })

    expect(captured.truncated).toBe(true)
    expect(captured.retainedBytes).toBeLessThanOrEqual(64)
    expect(captured.sanitizedPreview).toContain('REDACTED')
    expect(captured.sanitizedPreview).not.toContain('secret-token')
  })

  test('capture metadata exposes counters without raw payload content', () => {
    const capture = new BoundedTextCapture({ maxBytes: 4, previewBytes: 20 })
    capture.append('secret=abc123&value=123')
    const metadata = buildCaptureMetadata(capture.result(), 'body')

    expect(metadata['bodyBytes']).toBeGreaterThan(4)
    expect(metadata['bodyTruncated']).toBe(true)
    expect(String(metadata['bodyPreview'])).not.toContain('abc123')
  })

  test('bounded capture keeps the exact tail and exact counters across many small chunks', () => {
    const maxBytes = 256
    const capture = new BoundedTextCapture({ maxBytes })
    let full = ''
    for (let index = 0; index < 500; index += 1) {
      const chunk = `line-${index};`
      full += chunk
      capture.append(chunk)
    }
    const result = capture.result()

    expect(result.text).toBe(full.slice(-maxBytes))
    expect(result.retainedBytes).toBe(maxBytes)
    expect(result.totalBytes).toBe(full.length)
    expect(result.omittedBytes).toBe(full.length - maxBytes)
    expect(result.truncated).toBe(true)
    expect(capture.result()).toEqual(result)

    capture.append('tail-marker')
    expect(capture.result().text).toBe(`${full}tail-marker`.slice(-maxBytes))
  })

  test('bounded capture stays under the cap on character boundaries for multi-byte text and oversized chunks', () => {
    const capture = new BoundedTextCapture({ maxBytes: 64 })
    let full = ''
    for (let index = 0; index < 200; index += 1) {
      const chunk = `☃${index}🎧`
      full += chunk
      capture.append(chunk)
    }
    const result = capture.result()
    expect(result.retainedBytes).toBeLessThanOrEqual(64)
    expect(result.retainedBytes).toBe(Buffer.byteLength(result.text))
    expect(full.endsWith(result.text)).toBe(true)
    expect(result.text.isWellFormed()).toBe(true)
    expect(result.totalBytes).toBe(Buffer.byteLength(full))

    for (let maxBytes = 1; maxBytes <= 40; maxBytes += 1) {
      const emoji = new BoundedTextCapture({ maxBytes })
      emoji.append('x🎧y🎧🎧z🎧'.repeat(6))
      const tail = emoji.result()
      expect(tail.text.isWellFormed()).toBe(true)
      expect(tail.retainedBytes).toBeLessThanOrEqual(maxBytes)
    }

    const oversized = new BoundedTextCapture({ maxBytes: 8 })
    oversized.append('x'.repeat(1000) + 'end-mark')
    expect(oversized.result()).toMatchObject({ text: 'end-mark', totalBytes: 1008, retainedBytes: 8, omittedBytes: 1000, truncated: true })

    const small = new BoundedTextCapture({ maxBytes: 64 })
    small.append('fits')
    expect(small.result()).toMatchObject({ text: 'fits', truncated: false, omittedBytes: 0 })
    expect(new BoundedTextCapture({ maxBytes: 64 }).result()).toMatchObject({ text: '', totalBytes: 0, truncated: false })
  })

  // Capture bounds what is retained, never how much a producer may write. The former 64 MiB stream
  // limit cancelled the pipe, which killed a subprocess that was succeeding.
  const FORMER_STREAM_LIMIT_MIB = 64
  const mebibyteStream = (mebibytes: number, lastLine: string): ReadableStream<Uint8Array> => {
    let sent = 0
    const block = new Uint8Array(1024 * 1024).fill(0x78)
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent < mebibytes) {
          sent += 1
          controller.enqueue(block)
          return
        }
        controller.enqueue(new TextEncoder().encode(lastLine))
        controller.close()
      }
    })
  }

  test('a subprocess that writes more than the former 64 MiB stream limit still exits 0 with its tail captured', async () => {
    const script = 'const line = "progress " + "x".repeat(1000) + "\\n"; for (let i = 0; i < 70 * 1024; i++) process.stderr.write(line); process.stderr.write("final-line\\n")'
    const result = await exec(process.execPath, ['-e', script])

    expect(result.exitCode).toBe(0)
    expect(result.stderrBytes).toBeGreaterThan(FORMER_STREAM_LIMIT_MIB * 1024 * 1024)
    expect(result.stderrTruncated).toBe(true)
    expect(result.stderr.endsWith('final-line\n')).toBe(true)
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(4 * 1024 * 1024)
  }, 60_000)

  test('stream capture drains past the former limit and reports exact totals', async () => {
    const captured = await readBoundedTextStream(mebibyteStream(FORMER_STREAM_LIMIT_MIB + 2, 'tail-marker'), { maxBytes: 1024 })

    expect(captured.totalBytes).toBe((FORMER_STREAM_LIMIT_MIB + 2) * 1024 * 1024 + 'tail-marker'.length)
    expect(captured.retainedBytes).toBe(1024)
    expect(captured.truncated).toBe(true)
    expect(captured.text.endsWith('tail-marker')).toBe(true)
  }, 60_000)

  test('an error body larger than the diagnostic read limit is reported as truncated instead of thrown', async () => {
    const captured = await readBoundedResponseText(new Response(mebibyteStream(FORMER_STREAM_LIMIT_MIB + 2, 'tail-marker'), { status: 500 }), { maxBytes: 1024 })

    expect(captured.truncated).toBe(true)
    expect(captured.totalBytes).toBe(FORMER_STREAM_LIMIT_MIB * 1024 * 1024)
    expect(captured.retainedBytes).toBeLessThanOrEqual(1024)
  }, 60_000)
})
