import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { probeImage } from '../../../../.codex/skills/consensus/scripts/image/image_eval_lib'
import { withTempDir } from '../../../test-utils/temp-dirs'

// Minimal baseline JPEG header: SOI, JFIF APP0, an optional padding APPn segment, SOF0 with the frame size, EOI.
// The probe reads markers only, so no entropy-coded scan data is needed.
const syntheticJpeg = (width: number, height: number, appPaddingBytes: number): Uint8Array => {
  const segment = (marker: number, payload: number[]): number[] => {
    const length = payload.length + 2
    return [0xff, marker, length >> 8, length & 0xff, ...payload]
  }
  const jfif = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])
  // APP11 is where content-provenance (JUMBF) manifests sit in provider JPEGs; size it past the 4 KB header read.
  const padding = appPaddingBytes > 0 ? segment(0xeb, Array.from({ length: appPaddingBytes }, () => 0x20)) : []
  const sof0 = segment(0xc0, [0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x01, 0x01, 0x11, 0x00])
  return Uint8Array.from([0xff, 0xd8, ...jfif, ...padding, ...sof0, 0xff, 0xd9])
}

describe('consensus image probe', () => {
  test('reads JPEG frame dimensions whether the frame header is inside or beyond the first 4 KB', async () => {
    await withTempDir('autoshow-consensus-image-probe-', async dir => {
      for (const [name, width, height, padding] of [['short.jpg', 720, 1280, 0], ['provenance.jpg', 1376, 768, 7663]] as const) {
        const path = join(dir, name)
        const bytes = syntheticJpeg(width, height, padding)
        await Bun.write(path, bytes)
        if (padding > 0) expect(bytes.length).toBeGreaterThan(4096)
        expect(await probeImage(path)).toMatchObject({ format: 'jpeg', width, height, fileSize: bytes.length })
      }
    })
  })

  test('truncated JPEGs without a frame header report unknown zero dimensions instead of throwing', async () => {
    await withTempDir('autoshow-consensus-image-probe-', async dir => {
      const path = join(dir, 'truncated.jpg')
      await Bun.write(path, syntheticJpeg(1376, 768, 7663).slice(0, 6000))
      expect(await probeImage(path)).toMatchObject({ format: 'jpeg', width: 0, height: 0, megapixels: 0 })
    })
  })
})
