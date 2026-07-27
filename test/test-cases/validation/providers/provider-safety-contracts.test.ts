import { describe, expect, test } from 'bun:test'
import {
  BoundedTextCapture,
  buildCaptureMetadata,
  readBoundedResponseText
} from '~/utils/bounded-capture'

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
})
