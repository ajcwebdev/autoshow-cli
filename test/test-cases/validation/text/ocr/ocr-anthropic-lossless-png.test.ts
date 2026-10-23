import { describe, expect, test } from 'bun:test'
import { deflateSync } from 'node:zlib'
import { join } from 'node:path'
import { assertPngPixelIdentity, decodePngRgba8, losslesslyCompressPng, normalizeOversizedPng } from '~/utils/lossless-png'
import { runAnthropicOcr } from '~/cli/commands/text/ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runHostedOcr } from '~/cli/commands/text/ocr/hosted-ocr'
import type { DocumentMetadata, ExtractionOptions } from '~/types'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const lifecycle = setupContractSuiteLifecycle({ envKeys: ['ANTHROPIC_API_KEY'], tempPrefix: 'autoshow-lossless-png-' })
const limit = 5 * 1024 * 1024
const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)
const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const value = new Uint8Array(data.length + 12), view = new DataView(value.buffer)
  view.setUint32(0, data.length); value.set(Buffer.from(type), 4); value.set(data, 8); view.setUint32(data.length + 8, Bun.hash.crc32(value.subarray(4, data.length + 8)))
  return value
}
const png = (color: number, row: Uint8Array, extra: Array<[string, Uint8Array]> = [], depth = 8): Uint8Array => {
  const channels = color === 6 ? 4 : color === 2 ? 3 : color === 4 ? 2 : 1
  const header = new Uint8Array(13), view = new DataView(header.buffer)
  view.setUint32(0, row.length / channels); view.setUint32(4, 1); header[8] = depth; header[9] = color
  return Buffer.concat([signature, chunk('IHDR', header), ...extra.map(([type, data]) => chunk(type, data)), chunk('IDAT', deflateSync(Buffer.concat([Uint8Array.of(0), row]))), chunk('IEND', new Uint8Array())])
}
const rawOversized = await new Bun.Image(redDotPng).resize(1600, 1000).png({ compressionLevel: 0 }).bytes()

describe('lossless PNG transport sample integrity', () => {
  test('decodes all supported 8-bit color/alpha forms exactly without palette quantization', async () => {
    const examples = [
      { bytes: png(0, Uint8Array.of(8, 19)), rgba: [8, 8, 8, 255, 19, 19, 19, 255] },
      { bytes: png(4, Uint8Array.of(8, 0, 19, 55)), rgba: [8, 8, 8, 0, 19, 19, 19, 55] },
      { bytes: png(2, Uint8Array.of(9, 10, 11, 20, 30, 40)), rgba: [9, 10, 11, 255, 20, 30, 40, 255] },
      { bytes: png(6, Uint8Array.of(9, 10, 11, 0, 20, 30, 40, 55)), rgba: [9, 10, 11, 0, 20, 30, 40, 55] },
      { bytes: png(3, Uint8Array.of(0, 1), [['PLTE', Uint8Array.of(9, 10, 11, 20, 30, 40)], ['tRNS', Uint8Array.of(0, 55)]]), rgba: [9, 10, 11, 0, 20, 30, 40, 55] }
    ]
    for (const example of examples) {
      expect([...decodePngRgba8(example.bytes).pixels]).toEqual(example.rgba)
      const compressed = await losslesslyCompressPng(example.bytes)
      expect([...decodePngRgba8(compressed.bytes).pixels]).toEqual(example.rgba)
      expect(() => assertPngPixelIdentity(example.bytes, compressed.bytes)).not.toThrow()
    }
  })
  test('compression is deterministic and preserves every pixel and original byte buffer', async () => {
    const before = rawOversized.slice(), first = await losslesslyCompressPng(rawOversized), second = await losslesslyCompressPng(rawOversized)
    expect(rawOversized.length).toBeGreaterThan(limit); expect(first.bytes.length).toBeLessThan(limit)
    expect(first.bytes).toEqual(second.bytes); expect(rawOversized).toEqual(before)
    expect(first.originalSha256).not.toBe(first.transportSha256)
    expect(first.pixelSha256).toBe(decodePngRgba8(rawOversized).pixelSha256)
    expect(() => assertPngPixelIdentity(rawOversized, first.bytes)).not.toThrow()
    expect(await normalizeOversizedPng(redDotPng, 'png', limit)).toBe(redDotPng)
    expect(await normalizeOversizedPng(rawOversized, 'jpg', limit)).toBe(rawOversized)
  })
  test('changed pixels, invalid checksums, truncation, animation and unsupported encodings fail closed', async () => {
    expect(() => assertPngPixelIdentity(png(0, Uint8Array.of(1)), png(0, Uint8Array.of(2)))).toThrow('changed decoded pixels')
    const corrupt = rawOversized.slice(); corrupt[corrupt.length - 5] = corrupt[corrupt.length - 5]! ^ 1
    await expect(losslesslyCompressPng(corrupt)).rejects.toThrow('checksum')
    expect(() => decodePngRgba8(rawOversized.subarray(0, 25))).toThrow('Truncated')
    expect(() => decodePngRgba8(png(0, Uint8Array.of(1), [['acTL', new Uint8Array(8)]]))).toThrow('Animated PNG')
    expect(() => decodePngRgba8(png(0, Uint8Array.of(1), [], 16))).toThrow('noninterlaced 8-bit')
  })
})

describe('Anthropic native lossless PNG admission and Messages dispatch', () => {
  const metadata = (format: DocumentMetadata['format'], size: number): DocumentMetadata => ({ format, fileSize: size, slug: 'synthetic', pageCount: 1 })
  const response = () => Response.json({ model: 'claude-haiku-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ pages: [{ pageNumber: 1, text: 'Mock OCR text' }] }) }], usage: { input_tokens: 100, output_tokens: 20 } })
  const sentImage = (body: Record<string, unknown> | undefined): Uint8Array => {
    const messages = body?.['messages'] as Array<{ content: Array<{ type: string, source?: { type: string, media_type: string, data: string } }> }>
    const source = messages[0]!.content.find(block => block.type === 'image')!.source!
    expect(source.type).toBe('base64'); expect(source.media_type).toBe('image/png')
    return Buffer.from(source.data, 'base64')
  }
  test('actual hosted prelimit plus native adapter dispatch compressed bytes with identical pixels and retain original input identity', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'nonbillable-test-key'
    const calls = installMockFetch(() => response())
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'oversized.png'); await Bun.write(path, rawOversized)
      const result = await runHostedOcr(path, metadata('png', rawOversized.length), { filePath: path, dpi: 300, outputDir: dir, anthropicOcrModel: 'claude-haiku-5-5' } as ExtractionOptions)
      expect(calls).toHaveLength(1); expect(calls[0]!.url).toBe('https://api.anthropic.com/v1/messages')
      const transport = sentImage(calls[0]!.bodyJson)
      expect(transport.length).toBeLessThan(limit); expect(transport).not.toEqual(rawOversized)
      expect(() => assertPngPixelIdentity(rawOversized, transport)).not.toThrow()
      expect(new Uint8Array(await Bun.file(path).arrayBuffer())).toEqual(new Uint8Array(rawOversized))
      expect(result.inputSha256).toBe(new Bun.CryptoHasher('sha256').update(rawOversized).digest('hex'))
      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'Mock OCR text' }])
      expect(calls[0]!.bodyJson).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 64000, output_config: { format: { type: 'json_schema' } } })
    })
  })
  test('default small input, oversized normalization and reset keep Messages image bytes and native controls honest', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'nonbillable-test-key'
    const calls = installMockFetch(() => response())
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'image.png')
      for (const bytes of [redDotPng, rawOversized, redDotPng]) { await Bun.write(path, bytes); await runAnthropicOcr(path, metadata('png', bytes.length), 'claude-haiku-5-5') }
      expect(sentImage(calls[0]!.bodyJson)).toEqual(redDotPng)
      expect(sentImage(calls[1]!.bodyJson)).not.toEqual(rawOversized)
      expect(sentImage(calls[2]!.bodyJson)).toEqual(redDotPng)
      expect(calls.every(call => call.bodyJson?.['max_tokens'] === 64000)).toBe(true)
    })
  })
  test('oversized non-PNG and corrupt PNG reject before fetch in both native and hosted prelimit paths', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'nonbillable-test-key'
    const calls = installMockFetch(() => { throw new Error('Unexpected provider dispatch') })
    await lifecycle.withDir(async dir => {
      const corrupt = rawOversized.slice(); corrupt[corrupt.length - 5] = corrupt[corrupt.length - 5]! ^ 1
      for (const [format, bytes] of [['jpg', rawOversized], ['png', corrupt]] as const) {
        const path = join(dir, `invalid.${format}`); await Bun.write(path, bytes)
        await expect(runAnthropicOcr(path, metadata(format, bytes.length), 'claude-haiku-5-5')).rejects.toThrow(format === 'png' ? 'losslessly normalize' : '5 MB per-image')
        await expect(runHostedOcr(path, metadata(format, bytes.length), { filePath: path, dpi: 300, outputDir: dir, anthropicOcrModel: 'claude-haiku-5-5' } as ExtractionOptions)).rejects.toThrow(format === 'png' ? 'losslessly normalize' : 'supports image inputs up to')
      }
      expect(calls).toHaveLength(0)
    })
  })
  test('lossless normalization never bypasses the unchanged cap when incompressible PNG pixels still exceed it', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'nonbillable-test-key'
    const calls = installMockFetch(() => { throw new Error('Unexpected provider dispatch') })
    const width = 1400, height = 1000, header = new Uint8Array(13), view = new DataView(header.buffer)
    view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 6
    const rows = new Uint8Array(height * (width * 4 + 1))
    let seed = 987654321
    for (let y = 0; y < height; y++) for (let x = 1; x <= width * 4; x++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
      rows[y * (width * 4 + 1) + x] = seed & 255
    }
    const source = Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 0 })), chunk('IEND', new Uint8Array())])
    expect(source.length).toBeGreaterThan(limit)
    expect((await losslesslyCompressPng(source)).bytes.length).toBeGreaterThan(limit)
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'noise.png'); await Bun.write(path, source)
      await expect(runAnthropicOcr(path, metadata('png', source.length), 'claude-haiku-5-5')).rejects.toThrow('5 MB per-image limit')
      await expect(runHostedOcr(path, metadata('png', source.length), { filePath: path, dpi: 300, outputDir: dir, anthropicOcrModel: 'claude-haiku-5-5' } as ExtractionOptions)).rejects.toThrow('supports image inputs up to')
      expect(calls).toHaveLength(0)
    })
  })
})
