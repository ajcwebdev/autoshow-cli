import { describe, expect, test } from 'bun:test'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  isBunImagePngNormalizableFormat,
  normalizeImageToPngWithBun
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/bun-image-utils'
import {
  normalizeHostedDirectImageInput,
  resolveHostedDirectImageInputStrategy
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/hosted-ocr'
import type { HostedExtractOcrEngine } from '~/types'
import { pngSignature, redDotPng } from '../../../test-utils/media-fixtures'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const whiteBmp = new Uint8Array([
  0x42, 0x4d, 0x3a, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x36, 0x00, 0x00, 0x00, 0x28, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x13, 0x0b,
  0x00, 0x00, 0x13, 0x0b, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff,
  0xff, 0x00,
])

const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

const redTiff = (): Uint8Array => {
  const bytes = new Uint8Array(143)
  const view = new DataView(bytes.buffer)
  bytes.set([0x49, 0x49], 0)
  view.setUint16(2, 42, true)
  view.setUint32(4, 8, true)
  view.setUint16(8, 10, true)
  const entries: Array<[number, number, number, number]> = [
    [256, 4, 1, 1],
    [257, 4, 1, 1],
    [258, 3, 3, 134],
    [259, 3, 1, 1],
    [262, 3, 1, 2],
    [273, 4, 1, 140],
    [277, 3, 1, 3],
    [278, 4, 1, 1],
    [279, 4, 1, 3],
    [284, 3, 1, 1]
  ]
  entries.forEach(([tag, type, count, value], index) => {
    const offset = 10 + index * 12
    view.setUint16(offset, tag, true)
    view.setUint16(offset + 2, type, true)
    view.setUint32(offset + 4, count, true)
    if (type === 3 && count === 1) view.setUint16(offset + 8, value, true)
    else view.setUint32(offset + 8, value, true)
  })
  view.setUint32(130, 0, true)
  view.setUint16(134, 8, true)
  view.setUint16(136, 8, true)
  view.setUint16(138, 8, true)
  bytes.set([0xff, 0x00, 0x00], 140)
  return bytes
}

const readOutputBytes = async (path: string): Promise<Uint8Array> =>
  new Uint8Array(await Bun.file(path).arrayBuffer())

const writeImageFixture = async (
  dir: string,
  name: string,
  bytes: Uint8Array
): Promise<string> => {
  const path = join(dir, name)
  await Bun.write(path, bytes)
  return path
}

describe('OCR Bun.Image normalization contracts', () => {
  test('Bun.Image helper normalizes BMP, GIF, and WebP inputs to PNG', async () => {
    const dir = await makeTempDir('autoshow-ocr-bun-normalize-')
    const Image = Bun.Image
    const fixtures = [
      { name: 'source.bmp', bytes: whiteBmp },
      { name: 'source.gif', bytes: transparentGif },
      { name: 'source.webp', bytes: await new Image(redDotPng).webp().bytes() },
    ]

    try {
      for (const fixture of fixtures) {
        const inputPath = await writeImageFixture(dir, fixture.name, fixture.bytes)
        const outputPath = join(dir, `${fixture.name}.png`)

        await normalizeImageToPngWithBun(inputPath, outputPath)
        const outputBytes = await readOutputBytes(outputPath)

        expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('Bun.Image helper does not claim TIFF normalization support', async () => {
    expect(isBunImagePngNormalizableFormat('bmp')).toBe(true)
    expect(isBunImagePngNormalizableFormat('gif')).toBe(true)
    expect(isBunImagePngNormalizableFormat('webp')).toBe(true)
    expect(isBunImagePngNormalizableFormat('tif')).toBe(false)
    expect(isBunImagePngNormalizableFormat('tiff')).toBe(false)

    await expect(normalizeImageToPngWithBun('/tmp/source.tif', '/tmp/source.png'))
      .rejects.toThrow('not enabled for tif images')
  })

  test('installed Bun 1.4 declarations replace all local Image constructor shims', async () => {
    const declarations = await readFile('node_modules/.bun/node_modules/bun-types/bun.d.ts', 'utf8')
    expect(declarations).toContain('export class Image')
    expect(declarations).toContain('constructor(input: string | ArrayBuffer | NodeJS.TypedArray | Blob')
    expect(await Bun.file('src/types/image-workflow/bun-image-utils-types.ts').exists()).toBe(false)
    expect(await Bun.file('src/types/image-workflow/image-writer-types.ts').exists()).toBe(false)
    for (const path of [
      'src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/bun-image-utils.ts',
      'src/cli/commands/process-steps/step-8-comic/comic-image-services/image-writer.ts',
      'src/cli/commands/process-steps/step-8-comic/comic-commands/character-sketch/character-sketch-sheet.ts'
    ]) {
      expect(await readFile(path, 'utf8')).not.toContain('as unknown as')
    }
  })

  test('supported desktop hosts decode a golden TIFF pixel and metadata without changing Linux routing', async () => {
    if (process.platform !== 'darwin' && process.platform !== 'win32') return
    const Image = Bun.Image
    const image = new Image(redTiff())
    const metadata = await image.metadata()
    const png = await image.png().bytes()
    const goldenPng = await new Image(redDotPng).png().bytes()
    expect(metadata).toMatchObject({ width: 1, height: 1 })
    expect(png).toEqual(goldenPng)
    expect(isBunImagePngNormalizableFormat('tif')).toBe(false)
  })

  test('hosted OCR strategy uses Bun.Image only for the safe provider format gaps', () => {
    const bunCases: Array<{ engine: HostedExtractOcrEngine; format: string }> = [
      { engine: 'glm-ocr', format: 'webp' },
      { engine: 'glm-ocr', format: 'gif' },
      { engine: 'glm-ocr', format: 'bmp' },
      { engine: 'mistral-ocr', format: 'webp' },
      { engine: 'mistral-ocr', format: 'gif' },
      { engine: 'mistral-ocr', format: 'bmp' },
      { engine: 'anthropic-ocr', format: 'bmp' },
      { engine: 'openai-ocr', format: 'bmp' },
      { engine: 'grok-ocr', format: 'webp' },
      { engine: 'grok-ocr', format: 'gif' },
      { engine: 'grok-ocr', format: 'bmp' },
      { engine: 'kimi-ocr', format: 'bmp' },
      { engine: 'gemini-ocr', format: 'gif' },
      { engine: 'deepinfra-ocr', format: 'bmp' },
      { engine: 'deepinfra-ocr', format: 'gif' },
    ]
    const imageMagickCases: Array<{ engine: HostedExtractOcrEngine; format: string }> = [
      { engine: 'anthropic-ocr', format: 'tif' },
      { engine: 'openai-ocr', format: 'tif' },
      { engine: 'glm-ocr', format: 'tif' },
      { engine: 'glm-ocr', format: 'tiff' },
      { engine: 'grok-ocr', format: 'tif' },
      { engine: 'grok-ocr', format: 'tiff' },
      { engine: 'kimi-ocr', format: 'tif' },
      { engine: 'gemini-ocr', format: 'tif' },
      { engine: 'deepinfra-ocr', format: 'tif' },
    ]
    const directCases: Array<{ engine: HostedExtractOcrEngine; format: string }> = [
      { engine: 'mistral-ocr', format: 'tif' },
      { engine: 'mistral-ocr', format: 'tiff' },
      { engine: 'grok-ocr', format: 'jpg' },
      { engine: 'grok-ocr', format: 'jpeg' },
      { engine: 'grok-ocr', format: 'png' },
      { engine: 'gemini-ocr', format: 'bmp' },
      { engine: 'kimi-ocr', format: 'webp' },
    ]

    for (const entry of bunCases) {
      expect(resolveHostedDirectImageInputStrategy(entry.format, entry.engine)).toBe('bun-png')
    }
    for (const entry of imageMagickCases) {
      expect(resolveHostedDirectImageInputStrategy(entry.format, entry.engine)).toBe('imagemagick-png')
    }
    for (const entry of directCases) {
      expect(resolveHostedDirectImageInputStrategy(entry.format, entry.engine)).toBe('direct')
    }
    expect(resolveHostedDirectImageInputStrategy('svg', 'glm-ocr')).toBe('unsupported')
  })

  test('hosted OCR Bun.Image normalization writes PNG for provider-specific image gaps', async () => {
    const dir = await makeTempDir('autoshow-hosted-ocr-bun-normalize-')
    const Image = Bun.Image
    const fixtures: Array<{ engine: HostedExtractOcrEngine; name: string; bytes: Uint8Array }> = [
      { engine: 'anthropic-ocr', name: 'anthropic.bmp', bytes: whiteBmp },
      { engine: 'grok-ocr', name: 'grok.webp', bytes: await new Image(redDotPng).webp().bytes() },
      { engine: 'gemini-ocr', name: 'gemini.gif', bytes: transparentGif },
    ]

    try {
      for (const fixture of fixtures) {
        const inputPath = await writeImageFixture(dir, fixture.name, fixture.bytes)
        const result = await normalizeHostedDirectImageInput(inputPath, fixture.engine, dir, fixture.name)
        const outputBytes = await readOutputBytes(result.filePath)

        expect(result.format).toBe('png')
        expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
