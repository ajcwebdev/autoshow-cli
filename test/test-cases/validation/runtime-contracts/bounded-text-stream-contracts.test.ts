import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import {
  consumeBoundedTextStream,
  TextStreamByteLimitError,
  TextStreamLineLimitError
} from '~/utils/bounded-text-stream'

const streamFromChunks = (
  chunks: Uint8Array[],
  onCancel?: (reason: unknown) => void
): ReadableStream<Uint8Array> => new ReadableStream({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(chunk)
    controller.close()
  },
  cancel(reason) {
    onCancel?.(reason)
  }
})

describe('bounded text stream', () => {
  test('strips one leading BOM and reconstructs UTF-8 split across chunks', async () => {
    const bytes = new TextEncoder().encode('\uFEFFprice € and emoji 🧭')
    const stream = streamFromChunks([
      bytes.subarray(0, 1),
      bytes.subarray(1, 4),
      bytes.subarray(4, 11),
      bytes.subarray(11, 18),
      bytes.subarray(18)
    ])
    const result = await consumeBoundedTextStream(stream, { maxBytes: 1024, retainText: true })

    expect(result.text).toBe('price € and emoji 🧭')
    expect(result.totalBytes).toBe(bytes.byteLength)
    expect(stream.locked).toBe(false)
  })

  test('cancels on a hard byte limit and releases the reader lock', async () => {
    let cancelReason: unknown
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('0123456789'))
      },
      cancel(reason) {
        cancelReason = reason
      }
    })

    await expect(consumeBoundedTextStream(stream, { maxBytes: 5, retainText: true })).rejects.toBeInstanceOf(TextStreamByteLimitError)
    expect(cancelReason).toBeInstanceOf(TextStreamByteLimitError)
    expect(stream.locked).toBe(false)
  })

  test('cancels a blocked reader when its abort signal fires', async () => {
    let cancelReason: unknown
    const stream = new ReadableStream<Uint8Array>({
      cancel(reason) {
        cancelReason = reason
      }
    })
    const controller = new AbortController()
    const read = consumeBoundedTextStream(stream, { maxBytes: 1024, signal: controller.signal })
    controller.abort(new Error('fixture abort'))

    await expect(read).rejects.toThrow('fixture abort')
    expect(cancelReason).toBe(controller.signal.reason)
    expect(stream.locked).toBe(false)
  })

  test('keeps line framing bounded and preserves terminated and trailing lines', async () => {
    const lines: string[] = []
    const stream = streamFromChunks([
      new TextEncoder().encode('abcdefgh'),
      new TextEncoder().encode('ij\nok'),
      new TextEncoder().encode('\ntail')
    ])
    const result = await consumeBoundedTextStream(stream, {
      maxBytes: 1024,
      maxLineCharacters: 5,
      lineOverflow: 'truncate',
      onLine: line => lines.push(line)
    })

    expect(lines).toEqual(['abcde... [line truncated]\n', 'ok\n', 'tail'])
    expect(result.lineCount).toBe(3)
  })

  test('can reject an oversized line instead of silently truncating it', async () => {
    const stream = streamFromChunks([new TextEncoder().encode('too-long')])
    await expect(consumeBoundedTextStream(stream, {
      maxBytes: 1024,
      maxLineCharacters: 3,
      onLine: () => {}
    })).rejects.toBeInstanceOf(TextStreamLineLimitError)
    expect(stream.locked).toBe(false)
  })

  test('the four overlapping decoder loops use the shared primitive', async () => {
    const paths = [
      'src/utils/bounded-capture.ts',
      'test/test-runner/process-execution.ts',
      'test/test-utils/test-helpers.ts'
    ]
    for (const path of paths) {
      const source = await readFile(path, 'utf8')
      expect(`${path}:shared`).toBe(`${path}:${source.includes('consumeBoundedTextStream') ? 'shared' : 'missing'}`)
    }
  })
})
